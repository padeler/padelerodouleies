"""Expand the padelerodouleies icon catalog with more Lucide icons.

Downloads each wanted SVG from the jsDelivr CDN into
``backend/app/icons/svg/`` and appends a matching entry (with bilingual
search keywords) to ``backend/app/icons/catalog.json``.

Icons that already exist in the catalog are skipped, and any slug that
fails to download (e.g. not a real Lucide icon) is dropped so the catalog
never references a missing SVG.

Usage: python scripts/add_icons.py
"""
from __future__ import annotations

import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

CDN = "https://cdn.jsdelivr.net/npm/lucide-static@0.469.0/icons/{name}.svg"

ICONS_DIR = Path(__file__).parent.parent / "backend" / "app" / "icons"
SVG_DIR = ICONS_DIR / "svg"
CATALOG_PATH = ICONS_DIR / "catalog.json"

# New icons to add: (slug, category, keywords_en, keywords_el).
# Slugs must be valid Lucide icon names; invalid ones are skipped on download.
WANTED: list[tuple[str, str, list[str], list[str]]] = [
    # -- meals --
    ("banana", "meals", ["banana", "fruit", "snack"], ["μπανάνα", "φρούτο", "σνακ"]),
    ("cherry", "meals", ["cherry", "fruit"], ["κεράσι", "φρούτο"]),
    ("grape", "meals", ["grape", "fruit"], ["σταφύλι", "φρούτο"]),
    ("popcorn", "meals", ["popcorn", "snack", "movie"], ["ποπ κορν", "σνακ"]),
    ("popsicle", "meals", ["popsicle", "ice", "treat"], ["παγωτό", "ξυλάκι"]),
    ("dessert", "meals", ["dessert", "sweet", "pudding"], ["επιδόρπιο", "γλυκό"]),
    ("soup", "meals", ["soup", "bowl", "warm"], ["σούπα", "μπολ"]),
    ("beef", "meals", ["meat", "beef", "protein"], ["κρέας", "μοσχάρι"]),
    ("ham", "meals", ["ham", "meat"], ["ζαμπόν", "κρέας"]),
    ("egg-fried", "meals", ["egg", "breakfast", "fried"], ["αυγό", "πρωινό"]),
    ("wheat", "meals", ["wheat", "bread", "grain"], ["σιτάρι", "ψωμί", "δημητριακά"]),
    ("bean", "meals", ["bean", "legume", "vegetable"], ["φασόλι", "όσπριο", "λαχανικό"]),
    # -- hygiene / health --
    ("pill", "hygiene", ["pill", "medicine", "health"], ["χάπι", "φάρμακο", "υγεία"]),
    ("syringe", "hygiene", ["syringe", "vaccine", "doctor"], ["σύριγγα", "ένεση", "εμβόλιο"]),
    ("heart-pulse", "hygiene", ["health", "heartbeat", "pulse"], ["υγεία", "παλμός", "καρδιά"]),
    ("hand-heart", "hygiene", ["care", "love", "kindness"], ["φροντίδα", "αγάπη", "καλοσύνη"]),
    # -- tidying / home --
    ("refrigerator", "tidying", ["fridge", "kitchen", "cold"], ["ψυγείο", "κουζίνα"]),
    ("microwave", "tidying", ["microwave", "kitchen", "heat"], ["φούρνος", "μικροκυμάτων", "κουζίνα"]),
    ("cooking-pot", "tidying", ["pot", "cooking", "kitchen"], ["κατσαρόλα", "μαγείρεμα", "κουζίνα"]),
    ("hammer", "tidying", ["hammer", "fix", "repair"], ["σφυρί", "επισκευή", "μαστόρεμα"]),
    ("wrench", "tidying", ["wrench", "fix", "tool"], ["κλειδί", "εργαλείο", "επισκευή"]),
    ("paint-roller", "tidying", ["paint", "roller", "decorate"], ["βάψιμο", "ρολό", "μπογιά"]),
    # -- school --
    ("book-open", "school", ["book", "read", "study"], ["βιβλίο", "διάβασμα", "μελέτη"]),
    ("microscope", "school", ["microscope", "science", "lab"], ["μικροσκόπιο", "επιστήμη", "εργαστήριο"]),
    ("telescope", "school", ["telescope", "stars", "astronomy"], ["τηλεσκόπιο", "αστέρια", "αστρονομία"]),
    ("flask-conical", "school", ["flask", "chemistry", "lab"], ["φιάλη", "χημεία", "εργαστήριο"]),
    ("piano", "school", ["piano", "music", "instrument"], ["πιάνο", "μουσική", "όργανο"]),
    ("drum", "school", ["drum", "music", "instrument"], ["τύμπανο", "μουσική", "όργανο"]),
    ("languages", "school", ["language", "translate", "speak"], ["γλώσσες", "μετάφραση", "ομιλία"]),
    # -- pets / nature --
    ("snail", "pets", ["snail", "slow", "animal"], ["σαλιγκάρι", "ζώο"]),
    ("squirrel", "pets", ["squirrel", "animal"], ["σκίουρος", "ζώο"]),
    ("rat", "pets", ["rat", "mouse", "animal"], ["ποντίκι", "ζώο"]),
    ("worm", "pets", ["worm", "bug", "animal"], ["σκουλήκι", "έντομο"]),
    ("tree-pine", "pets", ["tree", "pine", "forest"], ["δέντρο", "πεύκο", "δάσος"]),
    ("tree-deciduous", "pets", ["tree", "nature", "forest"], ["δέντρο", "φύση", "δάσος"]),
    # -- rewards / fun --
    ("tent", "rewards", ["tent", "camping", "outdoors"], ["σκηνή", "κάμπινγκ", "εκδρομή"]),
    ("dices", "rewards", ["dice", "game", "play"], ["ζάρια", "παιχνίδι"]),
    ("camera", "rewards", ["camera", "photo", "picture"], ["φωτογραφική", "φωτογραφία"]),
    ("sailboat", "rewards", ["boat", "sail", "sea"], ["βάρκα", "ιστιοφόρο", "θάλασσα"]),
    ("bus", "rewards", ["bus", "trip", "travel"], ["λεωφορείο", "εκδρομή", "ταξίδι"]),
    ("train-front", "rewards", ["train", "trip", "travel"], ["τρένο", "εκδρομή", "ταξίδι"]),
    # -- avatars / fun --
    ("bot", "avatars", ["robot", "bot", "fun"], ["ρομπότ", "μπότ"]),
    ("venetian-mask", "avatars", ["mask", "costume", "play"], ["μάσκα", "μεταμφίεση"]),
    ("drama", "avatars", ["theatre", "masks", "drama"], ["θέατρο", "μάσκες", "δράμα"]),
    ("rainbow", "avatars", ["rainbow", "colors", "happy"], ["ουράνιο τόξο", "χρώματα", "χαρά"]),
    ("snowflake", "avatars", ["snow", "winter", "cold"], ["χιόνι", "χειμώνας", "νιφάδα"]),
    ("wand-sparkles", "avatars", ["magic", "wand", "sparkle"], ["μαγικό", "ραβδί", "λάμψη"]),
    # -- parent --
    ("wallet", "parent", ["wallet", "money", "budget"], ["πορτοφόλι", "χρήματα"]),
    ("calendar-check", "parent", ["calendar", "schedule", "done"], ["ημερολόγιο", "πρόγραμμα"]),
    ("alarm-clock", "parent", ["alarm", "clock", "time"], ["ξυπνητήρι", "ώρα", "ρολόι"]),
    ("banknote", "parent", ["money", "cash", "allowance"], ["χρήματα", "χαρτονόμισμα", "χαρτζιλίκι"]),
    ("badge-check", "parent", ["verified", "approved", "badge"], ["επιβεβαίωση", "έγκριση"]),
    ("phone", "parent", ["phone", "call", "contact"], ["τηλέφωνο", "κλήση", "επικοινωνία"]),
]


def fetch(name: str) -> bytes | None:
    """Return the SVG bytes for a Lucide slug, or None if it does not exist."""
    try:
        with urlopen(CDN.format(name=name), timeout=15) as resp:
            data = resp.read()
    except (HTTPError, URLError, TimeoutError) as e:
        print(f"FAIL {name}: {e}")
        return None
    if b"<svg" not in data:
        print(f"FAIL {name}: not an SVG")
        return None
    return data


def main() -> None:
    SVG_DIR.mkdir(parents=True, exist_ok=True)
    catalog: list[dict[str, object]] = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    existing = {entry["name"] for entry in catalog}

    added = 0
    for name, category, kw_en, kw_el in WANTED:
        if name in existing:
            print(f"SKIP {name}: already in catalog")
            continue
        data = fetch(name)
        if data is None:
            continue
        (SVG_DIR / f"{name}.svg").write_bytes(data)
        catalog.append(
            {
                "name": name,
                "category": category,
                "svg_ref": f"icons/svg/{name}.svg",
                "keywords_en": kw_en,
                "keywords_el": kw_el,
            }
        )
        existing.add(name)
        added += 1
        print(f"OK {name} ({category})")

    catalog.sort(key=lambda e: str(e["name"]))
    CATALOG_PATH.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"\nDone: added {added} icons, catalog now has {len(catalog)} entries")


if __name__ == "__main__":
    main()
