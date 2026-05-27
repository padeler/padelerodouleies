"""Generate backend/app/icons/catalog.json from the SVG directory."""
import json
from pathlib import Path

SVG_DIR = Path(__file__).parent.parent / "backend" / "app" / "icons" / "svg"
CATALOG_PATH = SVG_DIR.parent / "catalog.json"

# icon_name -> (category, keywords_en, keywords_el)
ICON_MAP = {
    # ---- hygiene (17) ----
    "tooth": ("hygiene", ["tooth", "teeth", "brush", "dental"], ["δόντι", "δόντια", "βούρτσισμα", "οδοντόβουρτσα"]),
    "shower": ("hygiene", ["shower", "bath", "wash", "water"], ["ντους", "λουτρό", "πλύσιμο", "νερό"]),
    "sun": ("hygiene", ["sun", "morning", "day", "rise"], ["ήλιος", "πρωί", "ημέρα", "αναστολή"]),
    "bath": ("hygiene", ["bath", "bathtub", "tub", "wash"], ["λουτρό", "βάνα", "πλύσιμο"]),
    "droplets": ("hygiene", ["water", "drops", "soap", "hydrate"], ["σταγόνες", "νερό", "σαπούνι"]),
    "hand": ("hygiene", ["hand", "hands", "wash", "clean"], ["χέρι", "χέρια", "πλύσιμο"]),
    "hand-metal": ("hygiene", ["robot hand", "metal", "clean"], ["χέρι", "καθαριότητα"]),
    "headphones": ("hygiene", ["headphones", "ear", "hearing"], ["ακουστικά", "αυτί"]),
    "waves": ("hygiene", ["water", "waves", "ocean", "sea"], ["κυματά", "θάλασσα", "κολύμβι"]),
    "wind": ("hygiene", ["wind", "air", "fresh", "breeze"], ["άνεμος", "αέρας", "φρέσκο"]),
    "umbrella": ("hygiene", ["umbrella", "rain", "wet", "protect"], ["ομπρέλα", "βροχή"]),
    "sunset": ("hygiene", ["sunset", "evening", "dusk", "night"], ["ηλιοβασίλεμα", "βράδυ"]),
    "moon": ("hygiene", ["moon", "night", "bedtime", "sleep"], ["σέληνος", "νύχτα", "ύπνος"]),
    "egg": ("hygiene", ["egg", "baby", "breakfast", "care"], ["αβγό", "μωρό", "πρωινό"]),
    "spray-can": ("hygiene", ["spray", "clean", "disinfect"], ["σπρέι", "καθαριστικό"]),
    "droplet": ("hygiene", ["water drop", "moisture", "hydrate"], ["στάγος", "υγρασία"]),
    # ---- meals (16) ----
    "plate": ("meals", ["plate", "food", "meal", "eat", "dishes"], ["πιάτο", "φαγητό", "γεύμα", "φαγω"]),
    "apple": ("meals", ["apple", "fruit", "snack", "healthy"], ["μήλο", "φρούτο", "σνακ", "υγιεινό"]),
    "coffee": ("meals", ["coffee", "drink", "morning", "cup"], ["καφές", "ποτό", "πρωινό"]),
    "croissant": ("meals", ["croissant", "bread", "bakery", "pastry"], ["κρουασάν", "ψωμί", "αρτοπολείο"]),
    "cup-soda": ("meals", ["soda", "drink", "cup", "beverage"], ["ποτό", "χυμός", "λίχανο"]),
    "glass-water": ("meals", ["water", "glass", "drink", "hydrate"], ["νερό", "πιάτο", "πότο"]),
    "milk": ("meals", ["milk", "dairy", "drink", "calcium"], ["γάλα", "ποτό", "γαλακτικό"]),
    "pizza": ("meals", ["pizza", "food", "cheese", "italian"], ["πιτσα", "φαγητό", "τυρί"]),
    "sandwich": ("meals", ["sandwich", "lunch", "bread", "snack"], ["σάντουιτς", "γεύμα", "ψωμί"]),
    "utensils": ("meals", ["utensils", "fork", "knife", "silverware"], ["κουτάλια", "χαλβάδια", "πιρούνι"]),
    "utensils-crossed": ("meals", ["utensils", "restaurant", "fork", "knife"], ["κουτάλια", "εστιατόριο"]),
    "chef-hat": ("meals", ["chef", "hat", "cook", "kitchen"], ["σεφ", "καψάκι", "μαγείρεμα", "κουζίνα"]),
    "cookie": ("meals", ["cookie", "sweet", "snack", "treat"], ["μπισκότο", "γλυκό", "σνακ"]),
    "cake": ("meals", ["cake", "birthday", "dessert", "sweet"], ["κέικ", "έτος", "γλυκό"]),
    "carrot": ("meals", ["carrot", "vegetable", "healthy", "snack"], ["καρότο", "λαχανικό", "υγιεινό"]),
    "salad": ("meals", ["salad", "greens", "vegetable", "healthy"], ["σαλάτα", "λαχανικά", "φυλλο"]),
    # ---- tidying (13) ----
    "bed": ("tidying", ["bed", "sleep", "sheets", "fold", "bedroom"], ["κρεβάτι", "ύπνος", "δίπλωμα", "σεντόνια"]),
    "box": ("tidying", ["box", "toy box", "container", "put away"], ["κουτί", "εργαλεία", "κατάθεση"]),
    "archive": ("tidying", ["archive", "storage", "organize"], ["αρχείο", "αποθήκη", "ταξινόμηση"]),
    "folder": ("tidying", ["folder", "organize", "sort", "files"], ["φάκελος", "ταξινόμηση"]),
    "package": ("tidying", ["package", "pack", "packaging", "box"], ["πακέτο", "συσκευασία"]),
    "shopping-bag": ("tidying", ["bag", "shopping", "put away", "tote"], ["τσάντα", "βόλτες", "κατάθεση"]),
    "trash-2": ("tidying", ["trash", "garbage", "bin", "throw away"], ["απόβλητα", "κούπα", "κάδος"]),
    "recycle": ("tidying", ["recycle", "recycling", "reuse", "eco"], ["ανακύκλωση", "πανάλλαξη"]),
    "sparkles": ("tidying", ["sparkle", "shiny", "clean", "tidy"], ["λαμπείρα", "καθαριότητα", "τάξη"]),
    "car": ("tidying", ["car", "vehicle", "park", "put away"], ["αυτοκίνητο", "παρκάρισμα"]),
    "bike": ("tidying", ["bike", "bicycle", "put away", "cycle"], ["ποδήλατο", "κατάθεση"]),
    "scissors": ("tidying", ["scissors", "cut", "craft", "snip"], ["ψαλίδι", "κόψιμο", "εργασίες"]),
    "spray-can": ("tidying", ["spray", "clean", "sprinkle"], ["σπρέι", "καθαριότητα"]),
    # ---- school (13) ----
    "book": ("school", ["book", "read", "homework", "study"], ["βιβλίο", "διάβασμα", "σπουδές"]),
    "backpack": ("school", ["backpack", "bag", "school", "books"], ["σακίδιο", "σχολείο", "βιβλία"]),
    "graduation-cap": ("school", ["graduate", "cap", "education", "school"], ["ακονδιλίο", "εκπαίδευση", "αντιδρόση"]),
    "pencil": ("school", ["pencil", "write", "draw", "school"], ["μόλας", "γράφω", "σχολείο"]),
    "pen-tool": ("school", ["pen", "write", "ink", "edit"], ["στυλό", "γράφω", "μελάνι"]),
    "ruler": ("school", ["ruler", "measure", "straightedge", "math"], ["διαβήτης", "μέτρηση", "μαθηματικά"]),
    "calculator": ("school", ["calculator", "math", "compute", "numbers"], ["υπολογιστής", "μαθηματικά", "αριθμοί"]),
    "library": ("school", ["library", "books", "reading", "study"], ["βιβλιοθήκη", "βιβλία", "διάβασμα"]),
    "eraser": ("school", ["eraser", "rubber", "erase", "mistake"], ["γόμα", "διόρθωση", "σφάλμα"]),
    "paintbrush": ("school", ["paintbrush", "paint", "art", "brush"], ["βούρτσα", "χρώμα", "τέχνη"]),
    "palette": ("school", ["palette", "art", "colors", "painting"], ["παλέτα", "τέχνη", "χρώματα"]),
    "music": ("school", ["music", "note", "song", "music class"], ["μουσική", "νότα", "τραγούδι"]),
    "guitar": ("school", ["guitar", "instrument", "music", "play"], ["κιθάρα", "εργαλείο", "μουσική"]),
    # ---- pets (14) ----
    "dog": ("pets", ["dog", "pet", "walk", "animal", "puppy"], ["σκύλος", "ζώο", "περπάτημα", "σκαμπά"]),
    "cat": ("pets", ["cat", "pet", "kitten", "animal"], ["γάτα", "ζώο", "γιάτα", "γατάκι"]),
    "fish": ("pets", ["fish", "aquarium", "pet", "swim"], ["ψάρι", "ακτάριο", "ζώο"]),
    "bird": ("pets", ["bird", "pet", "fly", "feathers"], ["πτερό", "ζώο", "φέτες"]),
    "rabbit": ("pets", ["rabbit", "bunny", "pet", "hop"], ["κουνάβι", "ζώο", "πηδάω"]),
    "turtle": ("pets", ["turtle", "slow", "pet", "shell"], ["χέλυ", "ζώο", "κόχλι"]),
    "bug": ("pets", ["bug", "insect", "nature", "crawling"], ["έντομο", "φύση", "κριμίδι"]),
    "paw-print": ("pets", ["paw", "pet", "animal", "footprint"], ["πατού", "ζώο", "αποτύπωμα"]),
    "trees": ("pets", ["trees", "forest", "nature", "park"], ["δέντρα", "δασύς", "φύση", "πάρκο"]),
    "flower-2": ("pets", ["flower", "bloom", "garden", "plant"], ["άνθος", "κήπος", "φυτέυμα"]),
    "leaf": ("pets", ["leaf", "nature", "tree", "green"], ["φύλλο", "φύση", "πράσινο"]),
    "sprout": ("pets", ["sprout", "grow", "seed", "plant"], ["βλαστός", "ανάπτυξη", "φύτευμα"]),
    "mountain": ("pets", ["mountain", "hill", "outdoor", "nature"], ["βουνό", "εκτός", "φύση"]),
    "cloud": ("pets", ["cloud", "sky", "weather", "rain"], ["νεφέλα", "ούρανο", "καιρός"]),
    # ---- avatars (14) ----
    "fox": ("avatars", ["fox", "animal", "cute", "clever"], ["αλεπού", "ζώο", "προφίλ"]),
    "unicorn": ("avatars", ["unicorn", "magic", "fantasy", "cute"], ["μονόκερος", "μαγικό", "φαντασία"]),
    "ghost": ("avatars", ["ghost", "spooky", "spirit", "fun"], ["φάντασμα", "χαζο", "πνεύμα"]),
    "skull": ("avatars", ["skull", "edgy", "cool", "skeleton"], ["κεφαλόποδο", "τραβό", "σκελετός"]),
    "rocket": ("avatars", ["rocket", "space", "launch", "fast"], ["πυραύλος", "χώρος", "ταχύ"]),
    "flame": ("avatars", ["flame", "fire", "hot", "energy"], ["φλόγα", "φωτιά", "ενέργεια"]),
    "anchor": ("avatars", ["anchor", "sea", "strong", "steady"], ["γυάλο", "θάλασσα", "δύναμη"]),
    "gem": ("avatars", ["gem", "diamond", "jewel", "precious"], ["κόσμημα", "διαμάντι", "τιμη"]),
    "candy": ("avatars", ["candy", "sweet", "lollipop", "treat"], ["γλυκό", "ζαχαρωτό", "λάχτα"]),
    "candy-off": ("avatars", ["no candy", "no sweets", "forbidden"], ["όχι γλυκό", "απαγόρευση"]),
    "ferris-wheel": ("avatars", ["ferris wheel", "amusement", "fun"], ["τροχός", "θέαμα", "διασκέδαση"]),
    "award": ("avatars", ["award", "badge", "achievement", "winner"], ["επίτευγμα", "badge", "νίκη"]),
    "medal": ("avatars", ["medal", "winner", "gold", "prize"], ["μετάλλιο", "νικητής", "βραβείο"]),
    "zap": ("avatars", ["zap", "lightning", "energy", "power"], ["κεραυνός", "ενέργεια", "ηλεκτρικό"]),
    # ---- parent (10) ----
    "shield": ("parent", ["shield", "admin", "parent", "protect"], ["στάυρο", "διοίκηση", "γονέας", "προστασία"]),
    "crown": ("parent", ["crown", "king", "queen", "admin", "royal"], ["στέμμα", "βασιλιάς", "βασιλίσσα", "διοίκηση"]),
    "key-round": ("parent", ["key", "access", "admin", "open"], ["κλειδί", "πρόσβαση", "διοίκηση"]),
    "settings": ("parent", ["settings", "gear", "configure", "options"], ["ρυθμίσεις", "τροχός", "διαμόρφωση"]),
    "lock": ("parent", ["lock", "secure", "password", "locked"], ["κλειδώ", "ασφάλεια", "συνθηματικό"]),
    "lock-keyhole": ("parent", ["lock", "secure", "keyhole", "locked"], ["κλειδώ", "ασφάλεια", "κλειδαριά"]),
    "file-text": ("parent", ["file", "document", "report", "paper"], ["αρχείο", "εγγραφή", "έκθεση"]),
    "clipboard": ("parent", ["clipboard", "list", "checklist", "notes"], ["συνόλου", "λίστα", "σημειώσεις"]),
    "bell": ("parent", ["bell", "notification", "alert", "reminder"], ["κάμπανα", "ειδοποίηση", "υπενθύμιση"]),
    "megaphone": ("parent", ["megaphone", "announcement", "broadcast"], ["μεγαφωνό", "ανακοίνωση", "μήνυμα"]),
    # ---- rewards (16) ----
    "gift": ("rewards", ["gift", "present", "reward", "prize"], ["δώρο", "βραβείο", "επίτευγμα"]),
    "star": ("rewards", ["star", "points", "reward", "shine", "badge"], ["άστρο", "πόντοι", "βραβείο", "λάμψη"]),
    "ice-cream": ("rewards", ["ice cream", "dessert", "sweet", "treat"], ["παγωτό", "γλυκό", "λαχτα"]),
    "gamepad": ("rewards", ["gamepad", "game", "play", "console"], ["πανό", "παίγνιο", "κόναο", "οθόνη"]),
    "ticket": ("rewards", ["ticket", "admission", "event", "pass"], ["εισιτήρια", "επίσκεψη", "επίθεση"]),
    "film": ("rewards", ["film", "movie", "cinema", "screen"], ["ταινία", "κινηματογράφος", "οθόνη"]),
    "clapperboard": ("rewards", ["clapperboard", "movie", "video", "filming"], ["κλαπέτο", "βιντεο", "σινεμά"]),
    "party-popper": ("rewards", ["party", "celebration", "confetti", "fun"], ["παρτί", "έορτη", "διασκέδαση"]),
    "trophy": ("rewards", ["trophy", "winner", "champion", "prize"], ["κέρδος", "νικητής", "βραβείο"]),
    "ship": ("rewards", ["ship", "boat", "travel", "voyage"], ["κάπι", "πλοίο", "ταξίδια", "θάλασσα"]),
    "plane": ("rewards", ["plane", "flight", "travel", "fly"], ["αεροπλάνο", "ταξίδι", "πτήση"]),
    "map": ("rewards", ["map", "exploration", "journey", "travel"], ["χάρτης", "απειρα", "ταξίδια"]),
    "lollipop": ("rewards", ["lollipop", "sweet", "candy", "treat"], ["βιβλίνα", "γλυκό", "ζαχαρωτό"]),
    "wine": ("rewards", ["wine", "drink", "celebration", "toast"], ["κρασί", "επίσκεψη", "υπογραφή"]),
}

def build_catalog():
    result = []
    svg_names = {svg.stem for svg in SVG_DIR.glob("*.svg")}
    for name in sorted(ICON_MAP.keys()):
        cat, kw_en, kw_el = ICON_MAP[name]
        result.append({
            "name": name,
            "category": cat,
            "svg_ref": f"icons/svg/{name}.svg",
            "keywords_en": kw_en,
            "keywords_el": kw_el,
        })
    # Add any SVG not in manual map (fallback)
    for sname in sorted(svg_names):
        if sname not in ICON_MAP:
            result.append({
                "name": sname,
                "category": "rewards",
                "svg_ref": f"icons/svg/{sname}.svg",
                "keywords_en": [sname, "icon", "reward"],
                "keywords_el": [sname, "εργαλείο"],
            })
    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(result)} entries to {CATALOG_PATH}")
    # Verify
    missing = [e["name"] for e in result if not (SVG_DIR / f"{e['name']}.svg").exists()]
    if missing:
        print(f"WARNING: {len(missing)} icons missing SVG: {missing}")
    else:
        print("All icons have matching SVGs.")

if __name__ == "__main__":
    build_catalog()
