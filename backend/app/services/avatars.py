"""Avatar and chore image upload service."""

import io
import logging
import uuid
from pathlib import Path

from fastapi import UploadFile
from PIL import Image

logger = logging.getLogger(__name__)

AVATAR_DIR = Path(__file__).parent.parent.parent.parent / "data" / "avatars"
CHORE_IMAGE_DIR = Path(__file__).parent.parent.parent.parent / "data" / "chore-images"

MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB


def _ensure_dir(directory: Path) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _read_file_safe(file: UploadFile, max_size: int) -> bytes:
    """Read uploaded file content with size validation."""
    chunks = []
    total_size = 0
    for chunk in iter(lambda: file.file.read(8192), b""):
        total_size += len(chunk)
        if total_size > max_size:
            raise ValueError(f"File too large (max {max_size // (1024 * 1024)}MB)")
        chunks.append(chunk)
    return b"".join(chunks)


def save_avatar(file: UploadFile) -> str:
    """Validate, crop, resize, and save an uploaded avatar. Returns the URL path."""
    if file.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise ValueError("Unsupported image format. Allowed: PNG, JPEG, WebP")

    logger.info("Saving avatar upload: content_type=%s, filename=%s", file.content_type, file.filename)
    contents = _read_file_safe(file, MAX_FILE_SIZE)
    logger.info("Read %d bytes from avatar upload", len(contents))

    img = Image.open(io.BytesIO(contents))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    w, h = img.size
    size = min(w, h)
    left = (w - size) // 2
    top = (h - size) // 2
    img = img.crop((left, top, left + size, top + size))
    img = img.resize((256, 256), Image.LANCZOS)

    dirname = _ensure_dir(AVATAR_DIR)
    filename = f"{uuid.uuid4().hex}.webp"
    img.save(dirname / filename, "WEBP", quality=85)
    logger.info("Saved avatar to %s", filename)
    return f"/avatars/{filename}"


def save_chore_image(file: UploadFile) -> str:
    """Validate, resize, and save a chore icon image. Returns the URL path."""
    if file.content_type not in {"image/png", "image/jpeg", "image/webp", "image/svg+xml"}:
        raise ValueError("Unsupported image format. Allowed: PNG, JPEG, WebP, SVG")

    logger.info("Saving chore image upload: content_type=%s, filename=%s", file.content_type, file.filename)
    contents = _read_file_safe(file, MAX_FILE_SIZE)
    logger.info("Read %d bytes from chore image upload", len(contents))

    dirname = _ensure_dir(CHORE_IMAGE_DIR)

    if file.content_type == "image/svg+xml":
        filename = f"{uuid.uuid4().hex}.svg"
        (dirname / filename).write_bytes(contents)
    else:
        img = Image.open(io.BytesIO(contents))
        if img.mode in ("RGBA", "P"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            bg.paste(img, mask=img.split()[3])
            img = bg

        max_dim = 512
        w, h = img.size
        if max(w, h) > max_dim:
            ratio = max_dim / max(w, h)
            img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

        filename = f"{uuid.uuid4().hex}.webp"
        img.save(dirname / filename, "WEBP", quality=85)

    logger.info("Saved chore image to %s", filename)
    return f"/chore-images/{filename}"


def delete_avatar(url_path: str) -> None:
    """Delete an uploaded avatar file from disk."""
    if not url_path.startswith("/avatars/"):
        return
    filename = url_path.split("/")[-1]
    target = AVATAR_DIR / filename
    if target.exists():
        target.unlink()
