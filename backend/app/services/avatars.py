"""Avatar and chore image upload service."""

import io
import logging
import re
import uuid
from pathlib import Path

from fastapi import UploadFile
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

logger = logging.getLogger(__name__)

# Active-content constructs that make an SVG a stored-XSS vector. We reject any
# SVG containing one rather than attempt lossy sanitization (fail-explicit) —
# valid icon/photo SVGs never need scripts, event handlers, foreign HTML, or
# external entities. Defense-in-depth: uploads are also served with a locked-down
# CSP + nosniff + attachment disposition (see app/main.py).
_DANGEROUS_SVG_PATTERNS = re.compile(
    r"<\s*script"          # inline script element
    r"|<\s*foreignObject"  # embedded (script-capable) HTML
    r"|<!ENTITY"           # entity declaration (XXE / billion-laughs)
    r"|<!DOCTYPE"          # doctype often used to declare entities
    r"|javascript:"        # javascript: URIs in href/xlink:href
    r"|\son\w+\s*=",       # inline event handlers (onload=, onclick=, ...)
    re.IGNORECASE,
)


def _reject_dangerous_svg(contents: bytes) -> None:
    """Raise ValueError if an uploaded SVG carries active/dangerous content."""
    text = contents.decode("utf-8", errors="replace")
    if _DANGEROUS_SVG_PATTERNS.search(text):
        raise ValueError("SVG contains disallowed active content (script/handlers/entities)")

# Enable Pillow to decode HEIC/HEIF photos (the iOS camera default format).
register_heif_opener()

AVATAR_DIR = Path(__file__).parent.parent.parent.parent / "data" / "avatars"
CHORE_IMAGE_DIR = Path(__file__).parent.parent.parent.parent / "data" / "chore-images"

# Phone cameras routinely produce 4-12MB photos; the server downscales every
# upload to a small WebP, so a generous inbound limit is safe.
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB


def _ensure_dir(directory: Path) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    return directory


# Raster formats accepted for photo uploads. HEIC/HEIF covers the iOS camera
# default. Browsers occasionally label HEIC captures with a generic image type,
# so any "image/*" content type is accepted and ultimately validated by Pillow
# attempting to decode the bytes.
_RASTER_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"}


def _is_supported_image(content_type: str | None) -> bool:
    """Return True for raster image content types we attempt to decode."""
    if not content_type:
        return False
    if content_type == "image/svg+xml":
        return False  # vector images are not decodable by Pillow as photos
    return content_type in _RASTER_CONTENT_TYPES or content_type.startswith("image/")


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
    if not _is_supported_image(file.content_type):
        raise ValueError("Unsupported image format. Allowed: PNG, JPEG, WebP, HEIC")

    logger.info("Saving avatar upload: content_type=%s, filename=%s", file.content_type, file.filename)
    contents = _read_file_safe(file, MAX_FILE_SIZE)
    logger.info("Read %d bytes from avatar upload", len(contents))

    img = Image.open(io.BytesIO(contents))
    # Apply the EXIF orientation tag so camera photos are not rotated 90 degrees.
    img = ImageOps.exif_transpose(img) or img
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
    if file.content_type != "image/svg+xml" and not _is_supported_image(file.content_type):
        raise ValueError("Unsupported image format. Allowed: PNG, JPEG, WebP, HEIC, SVG")

    logger.info("Saving chore image upload: content_type=%s, filename=%s", file.content_type, file.filename)
    contents = _read_file_safe(file, MAX_FILE_SIZE)
    logger.info("Read %d bytes from chore image upload", len(contents))

    dirname = _ensure_dir(CHORE_IMAGE_DIR)

    if file.content_type == "image/svg+xml":
        _reject_dangerous_svg(contents)
        filename = f"{uuid.uuid4().hex}.svg"
        (dirname / filename).write_bytes(contents)
    else:
        img = Image.open(io.BytesIO(contents))
        # Respect EXIF orientation so camera photos are not rotated.
        img = ImageOps.exif_transpose(img) or img
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
