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
# Already-present slugs are skipped, so this list is safe to re-run / extend.
WANTED: list[tuple[str, str, list[str], list[str]]] = [
    # -- meals (Lucide has few food icons beyond the existing catalog) --
    ("citrus", "meals", ["citrus", "lemon", "orange", "fruit"], ["εσπεριδοειδές", "λεμόνι", "πορτοκάλι", "φρούτο"]),
    ("donut", "meals", ["donut", "sweet", "treat"], ["ντόνατ", "γλυκό", "λουκουμάς"]),
    ("drumstick", "meals", ["chicken", "meat", "drumstick"], ["κοτόπουλο", "κρέας", "μπούτι"]),
    ("cake-slice", "meals", ["cake", "slice", "dessert"], ["τούρτα", "κομμάτι", "γλυκό"]),
    ("ice-cream-bowl", "meals", ["ice cream", "bowl", "dessert"], ["παγωτό", "μπολ", "γλυκό"]),
    ("nut", "meals", ["nut", "snack", "healthy"], ["ξηρός καρπός", "σνακ", "υγιεινό"]),
    ("vegan", "meals", ["vegan", "plant", "healthy"], ["βίγκαν", "φυτικό", "υγιεινό"]),
    ("fish-symbol", "meals", ["fish", "seafood", "protein"], ["ψάρι", "θαλασσινά", "πρωτεΐνη"]),
    # -- hygiene / health --
    ("activity", "hygiene", ["health", "pulse", "fitness"], ["υγεία", "παλμός", "φυσική κατάσταση"]),
    ("accessibility", "hygiene", ["accessibility", "care", "body"], ["προσβασιμότητα", "φροντίδα", "σώμα"]),
    ("cross", "hygiene", ["first aid", "medical", "cross"], ["πρώτες βοήθειες", "ιατρικό", "σταυρός"]),
    ("hospital", "hygiene", ["hospital", "clinic", "care"], ["νοσοκομείο", "κλινική", "φροντίδα"]),
    ("toilet", "hygiene", ["toilet", "bathroom", "wc"], ["τουαλέτα", "μπάνιο", "λεκάνη"]),
    ("shower-head", "hygiene", ["shower", "wash", "clean"], ["ντους", "πλύσιμο", "καθαριότητα"]),
    ("sparkle", "hygiene", ["clean", "shine", "sparkle"], ["καθαρό", "λάμψη", "γυαλάδα"]),
    ("scan-heart", "hygiene", ["heart", "checkup", "health"], ["καρδιά", "εξέταση", "υγεία"]),
    ("pill-bottle", "hygiene", ["medicine", "pills", "bottle"], ["φάρμακα", "χάπια", "μπουκάλι"]),
    ("tablets", "hygiene", ["pills", "medicine", "tablets"], ["χάπια", "φάρμακα", "δισκία"]),
    ("hand-helping", "hygiene", ["help", "care", "support"], ["βοήθεια", "φροντίδα", "υποστήριξη"]),
    # -- tidying / home --
    ("trash", "tidying", ["trash", "bin", "garbage"], ["σκουπίδια", "κάδος", "απορρίμματα"]),
    ("blinds", "tidying", ["blinds", "window", "curtain"], ["στόρια", "παράθυρο", "κουρτίνα"]),
    ("lamp-ceiling", "tidying", ["lamp", "ceiling", "light"], ["φωτιστικό", "οροφή", "φως"]),
    ("lamp-desk", "tidying", ["lamp", "desk", "light"], ["λάμπα", "γραφείο", "φως"]),
    ("lamp-floor", "tidying", ["lamp", "floor", "light"], ["λαμπατέρ", "δάπεδο", "φως"]),
    ("bed-double", "tidying", ["bed", "bedroom", "sleep"], ["κρεβάτι", "υπνοδωμάτιο", "ύπνος"]),
    ("bed-single", "tidying", ["bed", "single", "sleep"], ["κρεβάτι", "μονό", "ύπνος"]),
    ("rocking-chair", "tidying", ["chair", "rocking", "furniture"], ["καρέκλα", "κουνιστή", "έπιπλο"]),
    ("door-closed", "tidying", ["door", "closed", "room"], ["πόρτα", "κλειστή", "δωμάτιο"]),
    ("flashlight", "tidying", ["flashlight", "torch", "light"], ["φακός", "φως", "λάμπα"]),
    ("drill", "tidying", ["drill", "tool", "repair"], ["τρυπάνι", "εργαλείο", "επισκευή"]),
    ("pocket-knife", "tidying", ["knife", "tool", "fix"], ["σουγιάς", "εργαλείο", "επισκευή"]),
    ("plug", "tidying", ["plug", "power", "socket"], ["πρίζα", "ρεύμα", "βύσμα"]),
    ("lightbulb", "tidying", ["light", "bulb", "lamp"], ["λάμπα", "φως", "γλόμπος"]),
    ("table", "tidying", ["table", "furniture", "desk"], ["τραπέζι", "έπιπλο", "γραφείο"]),
    ("warehouse", "tidying", ["storage", "warehouse", "store"], ["αποθήκη", "χώρος", "φύλαξη"]),
    ("blocks", "tidying", ["blocks", "build", "toys"], ["τουβλάκια", "χτίσιμο", "παιχνίδια"]),
    ("house-plug", "tidying", ["home", "power", "smart"], ["σπίτι", "ρεύμα", "έξυπνο"]),
    ("paintbrush-vertical", "tidying", ["paint", "brush", "decorate"], ["βάψιμο", "πινέλο", "διακόσμηση"]),
    # -- school --
    ("atom", "school", ["atom", "science", "physics"], ["άτομο", "επιστήμη", "φυσική"]),
    ("beaker", "school", ["beaker", "chemistry", "lab"], ["δοχείο", "χημεία", "εργαστήριο"]),
    ("dna", "school", ["dna", "biology", "science"], ["dna", "βιολογία", "επιστήμη"]),
    ("magnet", "school", ["magnet", "physics", "science"], ["μαγνήτης", "φυσική", "επιστήμη"]),
    ("sigma", "school", ["sum", "math", "sigma"], ["άθροισμα", "μαθηματικά", "σίγμα"]),
    ("pi", "school", ["pi", "math", "number"], ["πι", "μαθηματικά", "αριθμός"]),
    ("binary", "school", ["binary", "code", "numbers"], ["δυαδικό", "κώδικας", "αριθμοί"]),
    ("code", "school", ["code", "programming", "computer"], ["κώδικας", "προγραμματισμός", "υπολογιστής"]),
    ("keyboard", "school", ["keyboard", "typing", "computer"], ["πληκτρολόγιο", "γραφή", "υπολογιστής"]),
    ("keyboard-music", "school", ["keyboard", "music", "piano"], ["πληκτρολόγιο", "μουσική", "πιάνο"]),
    ("mic", "school", ["microphone", "sing", "record"], ["μικρόφωνο", "τραγούδι", "ηχογράφηση"]),
    ("music-2", "school", ["music", "note", "song"], ["μουσική", "νότα", "τραγούδι"]),
    ("music-3", "school", ["music", "notes", "song"], ["μουσική", "νότες", "τραγούδι"]),
    ("music-4", "school", ["music", "notes", "song"], ["μουσική", "νότες", "τραγούδι"]),
    ("highlighter", "school", ["highlighter", "marker", "study"], ["μαρκαδόρος", "υπογράμμιση", "μελέτη"]),
    ("pen", "school", ["pen", "write", "note"], ["στυλό", "γραφή", "σημείωση"]),
    ("pencil-ruler", "school", ["pencil", "ruler", "design"], ["μολύβι", "χάρακας", "σχέδιο"]),
    ("drafting-compass", "school", ["compass", "geometry", "draw"], ["διαβήτης", "γεωμετρία", "σχέδιο"]),
    ("test-tube", "school", ["test tube", "chemistry", "lab"], ["δοκιμαστικός σωλήνας", "χημεία", "εργαστήριο"]),
    ("test-tubes", "school", ["test tubes", "science", "lab"], ["δοκιμαστικοί σωλήνες", "επιστήμη", "εργαστήριο"]),
    ("presentation", "school", ["presentation", "board", "lesson"], ["παρουσίαση", "πίνακας", "μάθημα"]),
    ("school", "school", ["school", "education", "building"], ["σχολείο", "εκπαίδευση", "κτίριο"]),
    ("notebook-pen", "school", ["notebook", "write", "homework"], ["τετράδιο", "γραφή", "εργασία"]),
    ("sticky-note", "school", ["note", "reminder", "sticky"], ["σημείωμα", "υπενθύμιση", "χαρτάκι"]),
    ("swatch-book", "school", ["colors", "swatch", "art"], ["χρώματα", "παλέτα", "τέχνη"]),
    # -- pets / nature (Lucide has few animals beyond the existing catalog) --
    ("bone", "pets", ["bone", "dog", "treat"], ["κόκαλο", "σκύλος", "λιχουδιά"]),
    ("feather", "pets", ["feather", "bird", "light"], ["φτερό", "πουλί", "ελαφρύ"]),
    ("mouse", "pets", ["mouse", "rodent", "animal"], ["ποντίκι", "τρωκτικό", "ζώο"]),
    ("shell", "pets", ["shell", "sea", "beach"], ["κοχύλι", "θάλασσα", "παραλία"]),
    ("leafy-green", "pets", ["leaf", "plant", "salad"], ["φύλλο", "φυτό", "σαλάτα"]),
    ("flower", "pets", ["flower", "bloom", "nature"], ["λουλούδι", "άνθος", "φύση"]),
    ("tree-palm", "pets", ["palm", "tree", "tropical"], ["φοίνικας", "δέντρο", "τροπικό"]),
    ("mountain-snow", "pets", ["mountain", "snow", "nature"], ["βουνό", "χιόνι", "φύση"]),
    ("sunrise", "pets", ["sunrise", "morning", "nature"], ["ανατολή", "πρωί", "φύση"]),
    ("origami", "pets", ["origami", "paper", "crane"], ["οριγκάμι", "χαρτί", "γερανός"]),
    # -- rewards / fun --
    ("dice-1", "rewards", ["dice", "one", "game"], ["ζάρι", "ένα", "παιχνίδι"]),
    ("dice-2", "rewards", ["dice", "two", "game"], ["ζάρι", "δύο", "παιχνίδι"]),
    ("dice-3", "rewards", ["dice", "three", "game"], ["ζάρι", "τρία", "παιχνίδι"]),
    ("dice-4", "rewards", ["dice", "four", "game"], ["ζάρι", "τέσσερα", "παιχνίδι"]),
    ("dice-5", "rewards", ["dice", "five", "game"], ["ζάρι", "πέντε", "παιχνίδι"]),
    ("dice-6", "rewards", ["dice", "six", "game"], ["ζάρι", "έξι", "παιχνίδι"]),
    ("gamepad-2", "rewards", ["game", "controller", "play"], ["παιχνίδι", "χειριστήριο", "κονσόλα"]),
    ("ticket-check", "rewards", ["ticket", "pass", "event"], ["εισιτήριο", "πάσο", "εκδήλωση"]),
    ("tickets", "rewards", ["tickets", "passes", "event"], ["εισιτήρια", "πάσα", "εκδήλωση"]),
    ("tickets-plane", "rewards", ["flight", "trip", "tickets"], ["πτήση", "ταξίδι", "εισιτήρια"]),
    ("toy-brick", "rewards", ["toy", "brick", "build"], ["παιχνίδι", "τουβλάκι", "χτίσιμο"]),
    ("cable-car", "rewards", ["cable car", "ride", "trip"], ["τελεφερίκ", "βόλτα", "εκδρομή"]),
    ("caravan", "rewards", ["caravan", "camping", "trip"], ["τροχόσπιτο", "κάμπινγκ", "εκδρομή"]),
    ("car-front", "rewards", ["car", "ride", "trip"], ["αυτοκίνητο", "βόλτα", "ταξίδι"]),
    ("plane-takeoff", "rewards", ["plane", "trip", "travel"], ["αεροπλάνο", "ταξίδι", "απογείωση"]),
    ("ship-wheel", "rewards", ["ship", "sea", "sail"], ["τιμόνι", "θάλασσα", "πλοίο"]),
    ("moon-star", "rewards", ["moon", "star", "night"], ["φεγγάρι", "αστέρι", "νύχτα"]),
    ("wand", "rewards", ["wand", "magic", "wish"], ["ραβδί", "μαγικό", "ευχή"]),
    ("tent-tree", "rewards", ["camping", "tent", "nature"], ["κάμπινγκ", "σκηνή", "φύση"]),
    ("castle", "rewards", ["castle", "fun", "adventure"], ["κάστρο", "διασκέδαση", "περιπέτεια"]),
    ("target", "rewards", ["target", "goal", "aim"], ["στόχος", "σκοπός", "βελάκι"]),
    ("flag", "rewards", ["flag", "finish", "goal"], ["σημαία", "τερματισμός", "στόχος"]),
    ("ribbon", "rewards", ["ribbon", "prize", "award"], ["κορδέλα", "βραβείο", "διάκριση"]),
    # -- avatars / fun --
    ("smile-plus", "avatars", ["smile", "happy", "add"], ["χαμόγελο", "χαρά", "προσθήκη"]),
    ("frown", "avatars", ["frown", "sad", "face"], ["κατσούφης", "λυπημένος", "πρόσωπο"]),
    ("angry", "avatars", ["angry", "mad", "face"], ["θυμωμένος", "οργή", "πρόσωπο"]),
    ("annoyed", "avatars", ["annoyed", "face", "mood"], ["ενοχλημένος", "πρόσωπο", "διάθεση"]),
    ("meh", "avatars", ["meh", "neutral", "face"], ["αδιάφορος", "ουδέτερος", "πρόσωπο"]),
    ("scan-face", "avatars", ["face", "id", "scan"], ["πρόσωπο", "ταυτότητα", "σάρωση"]),
    ("person-standing", "avatars", ["person", "kid", "standing"], ["άτομο", "παιδί", "όρθιος"]),
    ("user-round", "avatars", ["user", "person", "profile"], ["χρήστης", "άτομο", "προφίλ"]),
    ("circle-user-round", "avatars", ["user", "avatar", "profile"], ["χρήστης", "άβαταρ", "προφίλ"]),
    ("club", "avatars", ["club", "card", "symbol"], ["σπαθί", "τράπουλα", "σύμβολο"]),
    ("spade", "avatars", ["spade", "card", "symbol"], ["μπαστούνι", "τράπουλα", "σύμβολο"]),
    ("diamond", "avatars", ["diamond", "gem", "symbol"], ["καρό", "διαμάντι", "σύμβολο"]),
    ("sword", "avatars", ["sword", "hero", "knight"], ["σπαθί", "ήρωας", "ιππότης"]),
    ("axe", "avatars", ["axe", "viking", "tool"], ["τσεκούρι", "βίκινγκ", "εργαλείο"]),
    ("hard-hat", "avatars", ["helmet", "builder", "work"], ["κράνος", "οικοδόμος", "δουλειά"]),
    ("flame-kindling", "avatars", ["fire", "campfire", "warm"], ["φωτιά", "κάμπινγκ", "ζεστασιά"]),
    ("shield-half", "avatars", ["shield", "guard", "hero"], ["ασπίδα", "φύλακας", "ήρωας"]),
    ("biceps-flexed", "avatars", ["strong", "muscle", "power"], ["δυνατός", "μυς", "δύναμη"]),
    ("bot-message-square", "avatars", ["robot", "chat", "bot"], ["ρομπότ", "συνομιλία", "μποτ"]),
    # -- parent --
    ("clock", "parent", ["clock", "time", "schedule"], ["ρολόι", "ώρα", "πρόγραμμα"]),
    ("alarm-clock-check", "parent", ["alarm", "done", "schedule"], ["ξυπνητήρι", "ολοκληρώθηκε", "πρόγραμμα"]),
    ("calendar-clock", "parent", ["calendar", "deadline", "time"], ["ημερολόγιο", "προθεσμία", "ώρα"]),
    ("calendar-heart", "parent", ["calendar", "event", "special"], ["ημερολόγιο", "εκδήλωση", "ξεχωριστό"]),
    ("credit-card", "parent", ["card", "money", "pay"], ["κάρτα", "χρήματα", "πληρωμή"]),
    ("piggy-bank", "parent", ["savings", "money", "bank"], ["κουμπαράς", "χρήματα", "αποταμίευση"]),
    ("wallet-cards", "parent", ["wallet", "cards", "money"], ["πορτοφόλι", "κάρτες", "χρήματα"]),
    ("id-card", "parent", ["id", "card", "identity"], ["ταυτότητα", "κάρτα", "στοιχεία"]),
    ("user-check", "parent", ["user", "approve", "verify"], ["χρήστης", "έγκριση", "επιβεβαίωση"]),
    ("user-plus", "parent", ["user", "add", "new"], ["χρήστης", "προσθήκη", "νέος"]),
    ("user-cog", "parent", ["user", "settings", "manage"], ["χρήστης", "ρυθμίσεις", "διαχείριση"]),
    ("users-round", "parent", ["users", "family", "group"], ["χρήστες", "οικογένεια", "ομάδα"]),
    ("clipboard-check", "parent", ["checklist", "done", "tasks"], ["λίστα", "ολοκληρωμένο", "εργασίες"]),
    ("clipboard-list", "parent", ["list", "tasks", "chores"], ["λίστα", "εργασίες", "δουλειές"]),
    ("folder-open", "parent", ["folder", "files", "open"], ["φάκελος", "αρχεία", "άνοιγμα"]),
    ("mail-open", "parent", ["mail", "message", "note"], ["αλληλογραφία", "μήνυμα", "σημείωμα"]),
    ("handshake", "parent", ["agreement", "deal", "help"], ["συμφωνία", "συνεργασία", "βοήθεια"]),
    ("file-clock", "parent", ["file", "history", "log"], ["αρχείο", "ιστορικό", "καταγραφή"]),
    ("lock-open", "parent", ["unlock", "access", "open"], ["ξεκλείδωμα", "πρόσβαση", "άνοιγμα"]),
    ("key", "parent", ["key", "access", "unlock"], ["κλειδί", "πρόσβαση", "ξεκλείδωμα"]),
    # -- household items & appliances (batch 3: things around the house) --
    ("hand-platter", "meals", ["plate", "dish", "serve", "platter"], ["πιάτο", "σερβίρισμα", "δίσκος", "πιάτα"]),
    ("air-vent", "tidying", ["vent", "air", "ac", "duct"], ["αεραγωγός", "αέρας", "κλιματισμός"]),
    ("heater", "tidying", ["heater", "radiator", "warm"], ["καλοριφέρ", "θερμάστρα", "ζέστη"]),
    ("fan", "tidying", ["fan", "cooling", "air"], ["ανεμιστήρας", "δροσιά", "αέρας"]),
    ("lamp-wall-up", "tidying", ["lamp", "wall", "light", "sconce"], ["απλίκα", "τοίχος", "φως"]),
    ("lamp-wall-down", "tidying", ["lamp", "wall", "light", "sconce"], ["απλίκα", "τοίχος", "φως"]),
    ("tv-minimal", "tidying", ["tv", "television", "screen"], ["τηλεόραση", "οθόνη"]),
    ("frame", "tidying", ["frame", "picture", "photo"], ["κορνίζα", "φωτογραφία", "εικόνα"]),
    ("router", "tidying", ["router", "wifi", "internet"], ["ρούτερ", "wifi", "ίντερνετ"]),
    ("wifi", "tidying", ["wifi", "internet", "network"], ["wifi", "ίντερνετ", "δίκτυο"]),
    ("plug-2", "tidying", ["plug", "power", "socket"], ["πρίζα", "ρεύμα", "βύσμα"]),
    ("battery", "tidying", ["battery", "charge", "power"], ["μπαταρία", "φόρτιση", "ενέργεια"]),
    ("speaker", "rewards", ["speaker", "music", "sound"], ["ηχείο", "μουσική", "ήχος"]),
    ("radio", "rewards", ["radio", "music"], ["ραδιόφωνο", "μουσική"]),
    ("monitor", "school", ["monitor", "computer", "screen"], ["οθόνη", "υπολογιστής"]),
    ("laptop", "school", ["laptop", "computer"], ["λάπτοπ", "υπολογιστής", "φορητός"]),
    ("printer", "school", ["printer", "print"], ["εκτυπωτής", "εκτύπωση"]),
    ("shopping-basket", "parent", ["shopping", "basket", "groceries"], ["ψώνια", "καλάθι", "αγορές"]),
    ("shopping-cart", "parent", ["shopping", "cart", "groceries"], ["καρότσι", "ψώνια", "αγορές"]),
    ("newspaper", "parent", ["newspaper", "news", "read"], ["εφημερίδα", "νέα", "διάβασμα"]),
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
