"""Avatar upload and cleanup service."""

import io
import uuid
from pathlib import Path

from fastapi import UploadFile
from PIL import Image

AVATAR_DIR = Path(__file__).parent.parent.parent.parent / "data" / "avatars"


def _ensure_dir() -> Path:
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    return AVATAR_DIR


def save_avatar(file: UploadFile) -> str:
    """Validate, crop, resize, and save an uploaded avatar. Returns the URL path."""
    if file.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise ValueError("Unsupported image format")

    contents = file.file.read(2 * 1024 * 1024 + 1)
    if len(contents) > 2 * 1024 * 1024:
        raise ValueError("File too large (max 2MB)")

    img = Image.open(io.BytesIO(contents))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    w, h = img.size
    size = min(w, h)
    left = (w - size) // 2
    top = (h - size) // 2
    img = img.crop((left, top, left + size, top + size))
    img = img.resize((256, 256), Image.LANCZOS)

    dirname = _ensure_dir()
    filename = f"{uuid.uuid4().hex}.webp"
    img.save(dirname / filename, "WEBP", quality=85)
    return f"/avatars/{filename}"


def delete_avatar(url_path: str) -> None:
    """Delete an uploaded avatar file from disk."""
    if not url_path.startswith("/avatars/"):
        return
    filename = url_path.split("/")[-1]
    target = AVATAR_DIR / filename
    if target.exists():
        target.unlink()
