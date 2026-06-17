"""Generate ready-to-deploy sample exercise bundles.

Writes a handful of valid bundles under ``samples/exercises/`` (version-
controlled, deployable as-is) covering the two MVP-playable exercise types
(``multiple_choice`` + ``numeric_entry``) across several subject groups and age
bands, so the kid "Ασκήσεις" tab has real content to test against.

Images for the image-option bundle are drawn with Pillow (simple shapes — no
font/emoji dependency), so the asset-serving path is exercised too. Every bundle
is validated with the M1 loader before being kept, so a generated bundle always
loads clean.

Run from the backend dir:  python -m scripts.make_sample_bundles
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw

from app.services.exercise_bundles import load_bundle

REPO_ROOT = Path(__file__).resolve().parents[2]
OUT_ROOT = REPO_ROOT / "samples" / "exercises"

SS = 4  # supersample factor for smooth shapes
SIZE = 256


def _canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGBA", (SIZE * SS, SIZE * SS), (255, 255, 255, 0))
    return img, ImageDraw.Draw(img)


def _save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.resize((SIZE, SIZE), Image.LANCZOS).save(path)


def draw_apple(path: Path) -> None:
    img, d = _canvas()
    s = SS
    d.ellipse([40 * s, 70 * s, 216 * s, 240 * s], fill=(220, 40, 40))
    d.rectangle([120 * s, 40 * s, 136 * s, 90 * s], fill=(120, 70, 30))  # stem
    d.ellipse([136 * s, 45 * s, 190 * s, 80 * s], fill=(70, 160, 60))  # leaf
    _save(img, path)


def draw_sun(path: Path) -> None:
    img, d = _canvas()
    s = SS
    cx, cy, r = 128 * s, 128 * s, 60 * s
    for i in range(12):
        import math
        a = i * math.pi / 6
        x1, y1 = cx + math.cos(a) * r, cy + math.sin(a) * r
        x2, y2 = cx + math.cos(a) * (r + 45 * s), cy + math.sin(a) * (r + 45 * s)
        d.line([x1, y1, x2, y2], fill=(245, 190, 30), width=10 * s)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(250, 205, 40))
    _save(img, path)


def draw_tree(path: Path) -> None:
    img, d = _canvas()
    s = SS
    d.rectangle([116 * s, 160 * s, 140 * s, 230 * s], fill=(120, 75, 35))  # trunk
    d.ellipse([50 * s, 40 * s, 206 * s, 180 * s], fill=(60, 160, 70))  # foliage
    d.ellipse([30 * s, 90 * s, 130 * s, 190 * s], fill=(70, 175, 80))
    d.ellipse([126 * s, 90 * s, 226 * s, 190 * s], fill=(70, 175, 80))
    _save(img, path)


def draw_fish(path: Path) -> None:
    img, d = _canvas()
    s = SS
    d.ellipse([40 * s, 90 * s, 190 * s, 175 * s], fill=(60, 140, 220))  # body
    d.polygon([(185 * s, 132 * s), (230 * s, 95 * s), (230 * s, 170 * s)], fill=(40, 110, 190))  # tail
    d.ellipse([70 * s, 118 * s, 90 * s, 138 * s], fill=(255, 255, 255))  # eye
    d.ellipse([76 * s, 124 * s, 86 * s, 134 * s], fill=(20, 20, 20))
    _save(img, path)


IMAGE_DRAWERS = {
    "apple.png": draw_apple,
    "sun.png": draw_sun,
    "tree.png": draw_tree,
    "fish.png": draw_fish,
}


# -- bundle manifests (MVP-playable types only) -----------------------------

BUNDLES: list[dict[str, Any]] = [
    {
        "schema_version": 1,
        "id": "eikones-glwssa",
        "version": 1,
        "title": "Βρες την εικόνα",
        "subject": "language",
        "age_min": 4,
        "age_max": 6,
        "stars": 3,
        "exercises": [
            {
                "id": "ex-01",
                "type": "multiple_choice",
                "prompt": "Πού είναι το μήλο;",
                "options": [
                    {"id": "apple", "image": "apple.png", "text": "μήλο"},
                    {"id": "sun", "image": "sun.png", "text": "ήλιος"},
                    {"id": "tree", "image": "tree.png", "text": "δέντρο"},
                ],
                "answer": "apple",
                "hint": "Είναι κόκκινο και τρώγεται.",
            },
            {
                "id": "ex-02",
                "type": "multiple_choice",
                "prompt": "Πού είναι ο ήλιος;",
                "options": [
                    {"id": "fish", "image": "fish.png", "text": "ψάρι"},
                    {"id": "sun", "image": "sun.png", "text": "ήλιος"},
                    {"id": "apple", "image": "apple.png", "text": "μήλο"},
                ],
                "answer": "sun",
                "hint": "Λάμπει στον ουρανό την ημέρα.",
            },
            {
                "id": "ex-03",
                "type": "multiple_choice",
                "prompt": "Πού είναι το ψάρι;",
                "options": [
                    {"id": "tree", "image": "tree.png", "text": "δέντρο"},
                    {"id": "apple", "image": "apple.png", "text": "μήλο"},
                    {"id": "fish", "image": "fish.png", "text": "ψάρι"},
                ],
                "answer": "fish",
                "hint": "Ζει μέσα στο νερό.",
            },
        ],
    },
    {
        "schema_version": 1,
        "id": "prosthesi-afairesi",
        "version": 1,
        "title": "Πρόσθεση και αφαίρεση",
        "subject": "math",
        "age_min": 6,
        "age_max": 9,
        "stars": 5,
        "exercises": [
            {
                "id": "ex-01",
                "type": "numeric_entry",
                "prompt": "2 + 3 = ?",
                "prompt_tts": "δύο συν τρία",
                "answer": 5,
                "hint": "Μέτρα με τα δάχτυλά σου.",
            },
            {
                "id": "ex-02",
                "type": "numeric_entry",
                "prompt": "10 - 4 = ?",
                "prompt_tts": "δέκα μείον τέσσερα",
                "answer": 6,
            },
            {
                "id": "ex-03",
                "type": "multiple_choice",
                "prompt": "Πόσο κάνει 5 + 5;",
                "options": [
                    {"id": "a", "text": "8"},
                    {"id": "b", "text": "10"},
                    {"id": "c", "text": "12"},
                ],
                "answer": "b",
            },
            {
                "id": "ex-04",
                "type": "numeric_entry",
                "prompt": "7 + 6 = ?",
                "prompt_tts": "εφτά συν έξι",
                "answer": 13,
            },
        ],
    },
    {
        "schema_version": 1,
        "id": "motiva-logiki",
        "version": 1,
        "title": "Μοτίβα",
        "subject": "logic",
        "age_min": 5,
        "age_max": 8,
        "stars": 4,
        "exercises": [
            {
                "id": "ex-01",
                "type": "multiple_choice",
                "prompt": "Τι ακολουθεί; 2, 4, 6, ?",
                "options": [
                    {"id": "a", "text": "7"},
                    {"id": "b", "text": "8"},
                    {"id": "c", "text": "9"},
                ],
                "answer": "b",
                "hint": "Μετράμε ανά δύο.",
            },
            {
                "id": "ex-02",
                "type": "multiple_choice",
                "prompt": "Ποιο δεν ταιριάζει;",
                "options": [
                    {"id": "a", "text": "γάτα"},
                    {"id": "b", "text": "σκύλος"},
                    {"id": "c", "text": "αυτοκίνητο"},
                ],
                "answer": "c",
                "hint": "Τα δύο είναι ζώα.",
            },
            {
                "id": "ex-03",
                "type": "multiple_choice",
                "prompt": "Τι ακολουθεί; 1, 2, 3, ?",
                "options": [
                    {"id": "a", "text": "4"},
                    {"id": "b", "text": "5"},
                    {"id": "c", "text": "6"},
                ],
                "answer": "a",
            },
        ],
    },
    {
        "schema_version": 1,
        "id": "ta-zwa",
        "version": 1,
        "title": "Τα ζώα",
        "subject": "nature",
        "age_min": 4,
        "age_max": 7,
        "stars": 3,
        "exercises": [
            {
                "id": "ex-01",
                "type": "multiple_choice",
                "prompt": "Ποιο ζώο κάνει νιάου;",
                "options": [
                    {"id": "a", "text": "γάτα"},
                    {"id": "b", "text": "σκύλος"},
                    {"id": "c", "text": "πρόβατο"},
                ],
                "answer": "a",
                "hint": "Είναι μικρό κατοικίδιο.",
            },
            {
                "id": "ex-02",
                "type": "multiple_choice",
                "prompt": "Ποιο ζώο ζει στη θάλασσα;",
                "options": [
                    {"id": "a", "text": "λιοντάρι"},
                    {"id": "b", "text": "δελφίνι"},
                    {"id": "c", "text": "κότα"},
                ],
                "answer": "b",
            },
            {
                "id": "ex-03",
                "type": "multiple_choice",
                "prompt": "Ποιο ζώο πετάει;",
                "options": [
                    {"id": "a", "text": "ψάρι"},
                    {"id": "b", "text": "πουλί"},
                    {"id": "c", "text": "αλεπού"},
                ],
                "answer": "b",
            },
        ],
    },
]


def _images_needed(manifest: dict[str, Any]) -> set[str]:
    refs: set[str] = set()
    for ex in manifest["exercises"]:
        for opt in ex.get("options", []):
            if opt.get("image"):
                refs.add(opt["image"])
    return refs


def main() -> None:
    if OUT_ROOT.exists():
        shutil.rmtree(OUT_ROOT)
    OUT_ROOT.mkdir(parents=True)

    for manifest in BUNDLES:
        bundle_dir = OUT_ROOT / f"{manifest['id']}-v{manifest['version']}"
        bundle_dir.mkdir(parents=True)
        (bundle_dir / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        for ref in _images_needed(manifest):
            drawer = IMAGE_DRAWERS.get(ref)
            if drawer is None:
                raise SystemExit(f"No drawer for image {ref!r}")
            drawer(bundle_dir / "assets" / ref)

        loaded = load_bundle(bundle_dir)  # fail-explicit if anything is wrong
        print(f"OK  {bundle_dir.name}  ({loaded.subject}, {loaded.age_min}-{loaded.age_max}, {len(loaded.exercises)} ex)")

    print(f"\nWrote {len(BUNDLES)} bundles to {OUT_ROOT}")


if __name__ == "__main__":
    main()
