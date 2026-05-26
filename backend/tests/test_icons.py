"""Tests for icon catalog."""

import json
from pathlib import Path

from app.api.icons import CATALOG_PATH, ICONS_DIR


def test_catalog_schema_conformance() -> None:
    with open(CATALOG_PATH, encoding="utf-8") as f:
        catalog = json.load(f)

    allowed_categories = {"hygiene", "meals", "tidying", "school", "pets", "avatars", "parent", "rewards"}
    names = set()

    for entry in catalog:
        # All five fields present
        assert "name" in entry
        assert "category" in entry
        assert "svg_ref" in entry
        assert "keywords_en" in entry
        assert "keywords_el" in entry

        # Unique name
        assert entry["name"] not in names
        names.add(entry["name"])

        # Category in allowed enum
        assert entry["category"] in allowed_categories

        # Non-empty keyword lists
        assert len(entry["keywords_en"]) > 0
        assert len(entry["keywords_el"]) > 0

        # SVG ref resolves to real file
        svg_file = ICONS_DIR.parent / entry["svg_ref"]
        assert svg_file.exists(), f"Missing SVG: {svg_file}"


def test_catalog_not_empty() -> None:
    with open(CATALOG_PATH, encoding="utf-8") as f:
        catalog = json.load(f)
    assert len(catalog) >= 5
