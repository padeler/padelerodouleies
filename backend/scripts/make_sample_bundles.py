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
        "difficulty": 1,
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
        "difficulty": 2,
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
        "difficulty": 2,
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
        "difficulty": 1,
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
    # --- NEW BUNDLES ---
    {
        "schema_version": 1,
        "id": "syllaves-glwssa",
        "version": 1,
        "title": "Συλλαβές και λέξεις",
        "subject": "language",
        "age_min": 6,
        "age_max": 9,
        "stars": 4,
        "difficulty": 2,
        "exercises": [
            {
                "id": "ex-01",
                "type": "numeric_entry",
                "prompt": "Πόσες συλλαβές έχει η λέξη 'βιβλίο';",
                "prompt_tts": "Πόσες συλλαβές έχει η λέξη βιβλίο;",
                "answer": 3,
                "hint": "Μέτρα τα φωνήεντα: ι, ί, ο.",
            },
            {
                "id": "ex-02",
                "type": "numeric_entry",
                "prompt": "Πόσα γράμματα έχει η λέξη 'σπίτι';",
                "prompt_tts": "Πόσα γράμματα έχει η λέξη σπίτι;",
                "answer": 5,
            },
            {
                "id": "ex-03",
                "type": "multiple_choice",
                "prompt": "Ποια λέξη έχει 3 συλλαβές;",
                "options": [
                    {"id": "a", "text": "σπίτι"},
                    {"id": "b", "text": "άλογο"},
                    {"id": "c", "text": "μήλο"},
                ],
                "answer": "b",
                "hint": "ά-λο-γο.",
            },
            {
                "id": "ex-04",
                "type": "multiple_choice",
                "prompt": "Ποια λέξη αρχίζει από φωνήεν;",
                "options": [
                    {"id": "a", "text": "σπίτι"},
                    {"id": "b", "text": "αστέρι"},
                    {"id": "c", "text": "βουνό"},
                ],
                "answer": "b",
                "hint": "Τα φωνήεντα είναι: α, ε, η, ι, ο, υ, ω.",
            },
        ],
    },
    {
        "schema_version": 1,
        "id": "pollaplasiasmvos",
        "version": 1,
        "title": "Πολλαπλασιασμός",
        "subject": "math",
        "age_min": 8,
        "age_max": 11,
        "stars": 5,
        "difficulty": 4,
        "exercises": [
            {
                "id": "ex-01",
                "type": "numeric_entry",
                "prompt": "2 × 3 = ?",
                "prompt_tts": "δύο επί τρία",
                "answer": 6,
                "hint": "Δύο φορές τρία.",
            },
            {
                "id": "ex-02",
                "type": "numeric_entry",
                "prompt": "5 × 4 = ?",
                "prompt_tts": "πέντε επί τέσσερα",
                "answer": 20,
            },
            {
                "id": "ex-03",
                "type": "multiple_choice",
                "prompt": "Πόσο κάνει 3 × 3;",
                "options": [
                    {"id": "a", "text": "6"},
                    {"id": "b", "text": "9"},
                    {"id": "c", "text": "12"},
                ],
                "answer": "b",
            },
            {
                "id": "ex-04",
                "type": "numeric_entry",
                "prompt": "7 × 2 = ?",
                "prompt_tts": "εφτά επί δύο",
                "answer": 14,
            },
            {
                "id": "ex-05",
                "type": "multiple_choice",
                "prompt": "Ποιο από αυτά είναι πολλαπλάσιο του 5;",
                "options": [
                    {"id": "a", "text": "12"},
                    {"id": "b", "text": "15"},
                    {"id": "c", "text": "22"},
                ],
                "answer": "b",
                "hint": "5, 10, 15, 20...",
            },
        ],
    },
    {
        "schema_version": 1,
        "id": "epoces-fysis",
        "version": 1,
        "title": "Εποχές",
        "subject": "nature",
        "age_min": 5,
        "age_max": 8,
        "stars": 3,
        "difficulty": 1,
        "exercises": [
            {
                "id": "ex-01",
                "type": "multiple_choice",
                "prompt": "Πότε χιονίζει;",
                "options": [
                    {"id": "a", "text": "Άνοιξη"},
                    {"id": "b", "text": "Καλοκαίρι"},
                    {"id": "c", "text": "Χειμώνας"},
                ],
                "answer": "c",
            },
            {
                "id": "ex-02",
                "type": "multiple_choice",
                "prompt": "Ποια εποχή ανθίζουν τα λουλούδια;",
                "options": [
                    {"id": "a", "text": "Φθινόπωρο"},
                    {"id": "b", "text": "Άνοιξη"},
                    {"id": "c", "text": "Χειμώνας"},
                ],
                "answer": "b",
                "hint": "Τα δέντρα γίνονται πράσινα.",
            },
            {
                "id": "ex-03",
                "type": "numeric_entry",
                "prompt": "Πόσες εποχές έχει ο χρόνος;",
                "prompt_tts": "Πόσες εποχές έχει ο χρόνος;",
                "answer": 4,
            },
            {
                "id": "ex-04",
                "type": "multiple_choice",
                "prompt": "Τι κάνουν τα δέντρα το φθινόπωρο;",
                "options": [
                    {"id": "a", "text": "ανθίζουν"},
                    {"id": "b", "text": "χάνουν τα φύλλα"},
                    {"id": "c", "text": "καρπίζουν"},
                ],
                "answer": "b",
            },
        ],
    },
    {
        "schema_version": 1,
        "id": "arithmitika-motiva",
        "version": 1,
        "title": "Αριθμητικά μοτίβα",
        "subject": "logic",
        "age_min": 7,
        "age_max": 10,
        "stars": 4,
        "difficulty": 3,
        "exercises": [
            {
                "id": "ex-01",
                "type": "numeric_entry",
                "prompt": "Τι ακολουθεί; 10, 20, 30, ?",
                "prompt_tts": "Τι ακολουθεί; δέκα, είκοσι, τριάντα",
                "answer": 40,
                "hint": "Προσθέτουμε δέκα κάθε φορά.",
            },
            {
                "id": "ex-02",
                "type": "numeric_entry",
                "prompt": "Τι ακολουθεί; 1, 3, 5, ?",
                "prompt_tts": "Τι ακολουθεί; ένα, τρία, πέντε",
                "answer": 7,
                "hint": "Περιττοί αριθμοί.",
            },
            {
                "id": "ex-03",
                "type": "multiple_choice",
                "prompt": "Ποιος αριθμός λείπει; 5, ?, 15, 20",
                "prompt_tts": "Ποιος αριθμός λείπει; πέντε, ερωτηματικό, δεκαπέντε, είκοσι",
                "options": [
                    {"id": "a", "text": "8"},
                    {"id": "b", "text": "10"},
                    {"id": "c", "text": "12"},
                ],
                "answer": "b",
                "hint": "Προσθέτουμε πέντε κάθε φορά.",
            },
            {
                "id": "ex-04",
                "type": "numeric_entry",
                "prompt": "Τι ακολουθεί; 100, 90, 80, ?",
                "prompt_tts": "Τι ακολουθεί; εκατό, ενενήντα, ογδόντα",
                "answer": 70,
                "hint": "Αφαιρούμε δέκα κάθε φορά.",
            },
        ],
    },
    {
        "schema_version": 1,
        "id": "ellada-geografia",
        "version": 1,
        "title": "Η Ελλάδα μας",
        "subject": "geography",
        "age_min": 8,
        "age_max": 12,
        "stars": 4,
        "difficulty": 3,
        "exercises": [
            {
                "id": "ex-01",
                "type": "multiple_choice",
                "prompt": "Ποια είναι η πρωτεύουσα της Ελλάδας;",
                "options": [
                    {"id": "a", "text": "Θεσσαλονίκη"},
                    {"id": "b", "text": "Αθήνα"},
                    {"id": "c", "text": "Πάτρα"},
                ],
                "answer": "b",
            },
            {
                "id": "ex-02",
                "type": "multiple_choice",
                "prompt": "Ποιο είναι το ψηλότερο βουνό της Ελλάδας;",
                "options": [
                    {"id": "a", "text": "Παρνασσός"},
                    {"id": "b", "text": "Όλυμπος"},
                    {"id": "c", "text": "Ταΰγετος"},
                ],
                "answer": "b",
                "hint": "Εκεί έμεναν οι θεοί της αρχαίας Ελλάδας.",
            },
            {
                "id": "ex-03",
                "type": "multiple_choice",
                "prompt": "Ποιο είναι το μεγαλύτερο νησί της Ελλάδας;",
                "options": [
                    {"id": "a", "text": "Ρόδος"},
                    {"id": "b", "text": "Κέρκυρα"},
                    {"id": "c", "text": "Κρήτη"},
                ],
                "answer": "c",
            },
            {
                "id": "ex-04",
                "type": "multiple_choice",
                "prompt": "Σε ποια ήπειρο βρίσκεται η Ελλάδα;",
                "options": [
                    {"id": "a", "text": "Ασία"},
                    {"id": "b", "text": "Αφρική"},
                    {"id": "c", "text": "Ευρώπη"},
                ],
                "answer": "c",
            },
            {
                "id": "ex-05",
                "type": "numeric_entry",
                "prompt": "Πόσες περιφέρειες έχει η Ελλάδα;",
                "prompt_tts": "Πόσες περιφέρειες έχει η Ελλάδα;",
                "answer": 13,
                "hint": "Η Αττική είναι μία από αυτές.",
            },
        ],
    },
    {
        "schema_version": 1,
        "id": "eyropi-geografia",
        "version": 1,
        "title": "Η Ευρώπη",
        "subject": "geography",
        "age_min": 9,
        "age_max": 13,
        "stars": 5,
        "difficulty": 4,
        "exercises": [
            {
                "id": "ex-01",
                "type": "multiple_choice",
                "prompt": "Ποια είναι η πρωτεύουσα της Γαλλίας;",
                "options": [
                    {"id": "a", "text": "Βερολίνο"},
                    {"id": "b", "text": "Παρίσι"},
                    {"id": "c", "text": "Μαδρίτη"},
                ],
                "answer": "b",
            },
            {
                "id": "ex-02",
                "type": "multiple_choice",
                "prompt": "Ποια είναι η πρωτεύουσα της Γερμανίας;",
                "options": [
                    {"id": "a", "text": "Αμβούργο"},
                    {"id": "b", "text": "Μόναχο"},
                    {"id": "c", "text": "Βερολίνο"},
                ],
                "answer": "c",
            },
            {
                "id": "ex-03",
                "type": "multiple_choice",
                "prompt": "Ποια χώρα είναι η μεγαλύτερη σε έκταση στην Ευρώπη;",
                "options": [
                    {"id": "a", "text": "Γαλλία"},
                    {"id": "b", "text": "Ουκρανία"},
                    {"id": "c", "text": "Ρωσία"},
                ],
                "answer": "c",
                "hint": "Εκτείνεται και στην Ασία.",
            },
            {
                "id": "ex-04",
                "type": "numeric_entry",
                "prompt": "Πόσα κράτη-μέλη έχει η Ευρωπαϊκή Ένωση;",
                "prompt_tts": "Πόσα κράτη μέλη έχει η Ευρωπαϊκή Ένωση;",
                "answer": 27,
                "hint": "Η Ελλάδα είναι ένα από αυτά.",
            },
            {
                "id": "ex-05",
                "type": "multiple_choice",
                "prompt": "Ποιο ποτάμι περνά από τις περισσότερες ευρωπαϊκές χώρες;",
                "options": [
                    {"id": "a", "text": "Σηκουάνας"},
                    {"id": "b", "text": "Τάμεσης"},
                    {"id": "c", "text": "Δούναβης"},
                ],
                "answer": "c",
                "hint": "Περνά από δέκα χώρες.",
            },
        ],
    },
    {
        "schema_version": 1,
        "id": "arxaia-ellada",
        "version": 1,
        "title": "Αρχαία Ελλάδα",
        "subject": "history",
        "age_min": 9,
        "age_max": 13,
        "stars": 5,
        "difficulty": 4,
        "exercises": [
            {
                "id": "ex-01",
                "type": "multiple_choice",
                "prompt": "Πού γεννήθηκαν οι Ολυμπιακοί Αγώνες;",
                "options": [
                    {"id": "a", "text": "Αθήνα"},
                    {"id": "b", "text": "Σπάρτη"},
                    {"id": "c", "text": "Ολυμπία"},
                ],
                "answer": "c",
            },
            {
                "id": "ex-02",
                "type": "numeric_entry",
                "prompt": "Κάθε πόσα χρόνια γίνονταν οι αρχαίοι Ολυμπιακοί Αγώνες;",
                "prompt_tts": "Κάθε πόσα χρόνια γίνονταν οι αρχαίοι Ολυμπιακοί Αγώνες;",
                "answer": 4,
            },
            {
                "id": "ex-03",
                "type": "multiple_choice",
                "prompt": "Ποια πόλη ήταν γνωστή για τους πολεμιστές της;",
                "options": [
                    {"id": "a", "text": "Αθήνα"},
                    {"id": "b", "text": "Κόρινθος"},
                    {"id": "c", "text": "Σπάρτη"},
                ],
                "answer": "c",
                "hint": "Οι πολεμιστές της ήταν οι πιο γενναίοι.",
            },
            {
                "id": "ex-04",
                "type": "multiple_choice",
                "prompt": "Τι ήταν ο Παρθενώνας;",
                "options": [
                    {"id": "a", "text": "Παλάτι"},
                    {"id": "b", "text": "Ναός"},
                    {"id": "c", "text": "Θέατρο"},
                ],
                "answer": "b",
                "hint": "Βρίσκεται στην Ακρόπολη των Αθηνών.",
            },
            {
                "id": "ex-05",
                "type": "multiple_choice",
                "prompt": "Ποιος ήταν ο Αχιλλέας;",
                "options": [
                    {"id": "a", "text": "Θεός"},
                    {"id": "b", "text": "Ήρωας"},
                    {"id": "c", "text": "Βασιλιάς"},
                ],
                "answer": "b",
                "hint": "Πολέμησε στην Τροία.",
            },
        ],
    },
    {
        "schema_version": 1,
        "id": "epanastasi-1821",
        "version": 1,
        "title": "Η Επανάσταση του 1821",
        "subject": "history",
        "age_min": 10,
        "age_max": 14,
        "stars": 5,
        "difficulty": 5,
        "exercises": [
            {
                "id": "ex-01",
                "type": "numeric_entry",
                "prompt": "Πότε άρχισε η Ελληνική Επανάσταση;",
                "prompt_tts": "Πότε άρχισε η Ελληνική Επανάσταση;",
                "answer": 1821,
            },
            {
                "id": "ex-02",
                "type": "multiple_choice",
                "prompt": "Τι γιορτάζουμε στις 25 Μαρτίου;",
                "options": [
                    {"id": "a", "text": "Χριστούγεννα"},
                    {"id": "b", "text": "Πρωτοχρονιά"},
                    {"id": "c", "text": "Την Ελληνική Επανάσταση"},
                ],
                "answer": "c",
            },
            {
                "id": "ex-03",
                "type": "multiple_choice",
                "prompt": "Ποιος ήταν ο Θεόδωρος Κολοκοτρώνης;",
                "options": [
                    {"id": "a", "text": "Ποιητής"},
                    {"id": "b", "text": "Στρατηγός"},
                    {"id": "c", "text": "Ναύαρχος"},
                ],
                "answer": "b",
                "hint": "Πολέμησε για την ελευθερία της Ελλάδας.",
            },
            {
                "id": "ex-04",
                "type": "multiple_choice",
                "prompt": "Ποιος ήταν ο πρώτος κυβερνήτης της Ελλάδας;",
                "options": [
                    {"id": "a", "text": "Αλέξανδρος Υψηλάντης"},
                    {"id": "b", "text": "Ιωάννης Καποδίστριας"},
                    {"id": "c", "text": "Δημήτριος Υψηλάντης"},
                ],
                "answer": "b",
            },
            {
                "id": "ex-05",
                "type": "numeric_entry",
                "prompt": "Σε ποιον αιώνα ξεκίνησε η Ελληνική Επανάσταση;",
                "prompt_tts": "Σε ποιον αιώνα ξεκίνησε η Ελληνική Επανάσταση;",
                "answer": 19,
                "hint": "Το 1821 ανήκει στον...",
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
    # Remove only bundle dirs (named *-v<N>), preserving README.md and other files.
    if OUT_ROOT.exists():
        for child in OUT_ROOT.iterdir():
            if child.is_dir():
                shutil.rmtree(child)
    OUT_ROOT.mkdir(parents=True, exist_ok=True)

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
