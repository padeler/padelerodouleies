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
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.schemas.exercises import BundleManifest, asset_refs

logger = logging.getLogger(__name__)

MANIFEST_NAME = "manifest.json"
ASSETS_DIRNAME = "assets"

# Where bundles live. Container default is the RAID bind mount; the dev default
# sits under the backend root, mirroring the TTS_DIR env pattern in tts.py.
EXERCISES_DIR = Path(
    os.getenv("EXERCISES_DIR", str(Path(__file__).parents[2] / "data" / "exercises"))
)


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


# -- Discovery (scan-on-request, mtime-cached) ------------------------------


@dataclass(frozen=True)
class DiscoveredBundle:
    """A valid bundle on disk: its directory plus the parsed manifest."""

    dir: Path
    manifest: BundleManifest


@dataclass(frozen=True)
class InvalidBundle:
    """A bundle directory that failed validation, kept for admin surfacing."""

    dir: Path
    error: str


@dataclass(frozen=True)
class Discovery:
    valid: tuple[DiscoveredBundle, ...]
    invalid: tuple[InvalidBundle, ...]


# Per-root cache of (signature, Discovery). Discovery re-runs only when the
# signature (child dir set + mtimes) changes — no background scheduler
# (invariant #2). Bundles are immutable, so a manifest's mtime is a faithful
# identity for its content.
_cache: dict[Path, tuple[Any, Discovery]] = {}


def _signature(root: Path) -> Any:
    """A cheap fingerprint of the bundles root: its mtime + each child's."""
    if not root.is_dir():
        return None
    entries: list[tuple[str, int]] = []
    for child in sorted(root.iterdir()):
        if child.is_dir():
            try:
                entries.append((child.name, child.stat().st_mtime_ns))
            except OSError:
                continue
    return (root.stat().st_mtime_ns, tuple(entries))


def _scan(root: Path) -> Discovery:
    valid: list[DiscoveredBundle] = []
    invalid: list[InvalidBundle] = []
    if not root.is_dir():
        logger.info("exercises dir does not exist: %s", root)
        return Discovery(valid=(), invalid=())
    for child in sorted(root.iterdir()):
        if not child.is_dir():
            continue
        try:
            manifest = load_bundle(child)
            valid.append(DiscoveredBundle(dir=child, manifest=manifest))
        except BundleValidationError as exc:
            logger.warning("invalid bundle %s: %s", child.name, exc)
            invalid.append(InvalidBundle(dir=child, error=str(exc)))
    return Discovery(valid=tuple(valid), invalid=tuple(invalid))


def discover(root: Path | None = None) -> Discovery:
    """Discover all bundles under ``root`` (default ``EXERCISES_DIR``).

    Result is cached on the directory signature and recomputed only when the
    set of bundle dirs or their mtimes change. Invalid bundles are returned
    with their validation error, never silently dropped.
    """
    root = (root or EXERCISES_DIR).resolve()
    signature = _signature(root)
    cached = _cache.get(root)
    if cached is not None and cached[0] == signature:
        return cached[1]
    result = _scan(root)
    _cache[root] = (signature, result)
    logger.info("discovered %d valid / %d invalid bundle(s) in %s", len(result.valid), len(result.invalid), root)
    return result


def clear_cache() -> None:
    """Drop the discovery cache (admin Rescan button / tests)."""
    _cache.clear()


def get_bundle(bundle_id: str, root: Path | None = None) -> DiscoveredBundle | None:
    """The valid bundle for ``bundle_id``, picking the highest ``version``.

    Returns ``None`` when no valid bundle with that id exists (callers 404).
    """
    matches = [b for b in discover(root).valid if b.manifest.id == bundle_id]
    if not matches:
        return None
    return max(matches, key=lambda b: b.manifest.version)
