"""Exercise-bundle loading and (M2) on-disk discovery.

A bundle is a directory: ``manifest.json`` plus an ``assets/`` folder of images.
``load_bundle`` reads, parses and validates one bundle directory, raising an
explicit ``BundleValidationError`` (with the offending path + field) on any
problem — never silently skipping a malformed bundle (fail-explicit convention).
The validator itself lives in ``app.schemas.exercises``; this module adds the
filesystem concerns (reading the file, resolving asset references).
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from pydantic import ValidationError

from app.schemas.exercises import BundleManifest, asset_refs

logger = logging.getLogger(__name__)

MANIFEST_NAME = "manifest.json"
ASSETS_DIRNAME = "assets"


class BundleValidationError(ValueError):
    """A bundle directory failed validation; carries the path and field at fault."""

    def __init__(self, path: Path, field: str, msg: str) -> None:
        self.path = path
        self.field = field
        self.msg = msg
        super().__init__(f"{path} [{field}]: {msg}")


def _first_error(exc: ValidationError) -> tuple[str, str]:
    """Reduce a Pydantic ValidationError to a (field, message) pair."""
    err = exc.errors()[0]
    loc = ".".join(str(part) for part in err["loc"]) or "<root>"
    return loc, err["msg"]


def load_bundle(bundle_dir: Path) -> BundleManifest:
    """Read + validate one bundle directory.

    Raises ``BundleValidationError`` if the manifest is missing, malformed,
    fails schema validation, or references an asset that escapes / does not
    exist under ``assets/``.
    """
    manifest_path = bundle_dir / MANIFEST_NAME
    if not manifest_path.is_file():
        raise BundleValidationError(bundle_dir, MANIFEST_NAME, "manifest.json is missing")

    try:
        raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise BundleValidationError(bundle_dir, MANIFEST_NAME, f"invalid JSON: {exc}") from exc

    try:
        manifest = BundleManifest.model_validate(raw)
    except ValidationError as exc:
        field, msg = _first_error(exc)
        raise BundleValidationError(bundle_dir, field, msg) from exc

    assets_dir = bundle_dir / ASSETS_DIRNAME
    for ref in asset_refs(manifest):
        # Resolve and confirm the asset stays inside assets/ and exists on disk.
        resolved = (assets_dir / ref).resolve()
        if assets_dir.resolve() not in resolved.parents and resolved != assets_dir.resolve():
            raise BundleValidationError(bundle_dir, ref, "asset path escapes assets/")
        if not resolved.is_file():
            raise BundleValidationError(bundle_dir, ref, f"asset file not found: assets/{ref}")

    logger.debug("loaded bundle %s v%s (%d exercises)", manifest.id, manifest.version, len(manifest.exercises))
    return manifest
