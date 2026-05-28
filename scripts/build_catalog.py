"""Generate backend/app/icons/catalog.json from the SVG directory."""
import json
from pathlib import Path

SVG_DIR = Path(__file__).parent.parent / "backend" / "app" / "icons" / "svg"
CATALOG_PATH = SVG_DIR.parent / "catalog.json"

# icon_name -> (category, keywords_en, keywords_el)
ICON_MAP = {
    # ---- hygiene (25) ----
    "tooth": ("hygiene", ["tooth", "teeth", "brush", "dental"], ["δόντι", "δόντια", "βούρτσισμα", "οδοντόβουρτσα"]),
    "shower": ("hygiene", ["shower", "bath", "wash", "water"], ["ντους", "λουτρό", "πλύσιμο", "νερό"]),
    "sun": ("hygiene", ["sun", "morning", "day", "rise"], ["ήλιος", "πρωί", "ημέρα"]),
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
    "droplet": ("hygiene", ["water drop", "moisture", "hydrate"], ["σταγόνα", "υγρασία"]),
    "washing-machine": ("hygiene", ["laundry", "washing machine", "clothes", "wash"], ["πλυντήριο", "ρούχα", "πλύσιμο", "μπουγάδα"]),
    "shirt": ("hygiene", ["shirt", "clothes", "fold", "laundry"], ["πουκάμισο", "ρούχα", "δίπλωμα"]),
    "footprints": ("hygiene", ["footprints", "feet", "shoes", "clean"], ["πατημασιές", "πόδια", "παπούτσια"]),
    "thermometer": ("hygiene", ["thermometer", "temperature", "fever", "health"], ["θερμόμετρο", "πυρετός", "υγεία"]),
    "bandage": ("hygiene", ["bandage", "wound", "first aid", "boo-boo"], ["επίδεσμος", "τραύμα", "πρώτες βοήθειες"]),
    "baby": ("hygiene", ["baby", "infant", "care", "diaper"], ["μωρό", "φροντίδα", "πάνα"]),
    "ear": ("hygiene", ["ear", "hearing", "clean", "care"], ["αυτί", "ακοή", "καθαριότητα"]),
    "eye": ("hygiene", ["eye", "sight", "glasses", "care"], ["μάτι", "όραση", "φροντίδα"]),
    "fan": ("hygiene", ["fan", "air", "ventilation", "fresh"], ["ανεμιστήρας", "αέρας", "αερισμός"]),
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
    # ---- tidying (20) ----
    "bed": ("tidying", ["bed", "sleep", "sheets", "fold", "bedroom"], ["κρεβάτι", "ύπνος", "δίπλωμα", "σεντόνια"]),
    "box": ("tidying", ["box", "toy box", "container", "put away"], ["κουτί", "παιχνίδια", "αποθήκευση"]),
    "archive": ("tidying", ["archive", "storage", "organize"], ["αρχείο", "αποθήκη", "ταξινόμηση"]),
    "folder": ("tidying", ["folder", "organize", "sort", "files"], ["φάκελος", "ταξινόμηση"]),
    "package": ("tidying", ["package", "pack", "packaging", "box"], ["πακέτο", "συσκευασία"]),
    "shopping-bag": ("tidying", ["bag", "shopping", "put away", "tote"], ["τσάντα", "ψώνια", "τακτοποίηση"]),
    "trash-2": ("tidying", ["trash", "garbage", "bin", "throw away"], ["σκουπίδια", "κάδος", "πέταγμα"]),
    "recycle": ("tidying", ["recycle", "recycling", "reuse", "eco"], ["ανακύκλωση", "οικολογικό"]),
    "sparkles": ("tidying", ["sparkle", "shiny", "clean", "tidy"], ["λάμψη", "καθαριότητα", "τάξη"]),
    "car": ("tidying", ["car", "vehicle", "park", "put away"], ["αυτοκίνητο", "παρκάρισμα"]),
    "bike": ("tidying", ["bike", "bicycle", "put away", "cycle"], ["ποδήλατο", "τακτοποίηση"]),
    "scissors": ("tidying", ["scissors", "cut", "craft", "snip"], ["ψαλίδι", "κόψιμο", "χειροτεχνία"]),
    "sofa": ("tidying", ["sofa", "couch", "living room", "tidy"], ["καναπές", "σαλόνι", "τακτοποίηση"]),
    "house": ("tidying", ["house", "home", "chores", "clean"], ["σπίτι", "οικία", "δουλειές"]),
    "door-open": ("tidying", ["door", "room", "tidy", "close"], ["πόρτα", "δωμάτιο", "τακτοποίηση"]),
    "lamp": ("tidying", ["lamp", "light", "room", "bedside"], ["λάμπα", "φωτισμός", "δωμάτιο"]),
    "armchair": ("tidying", ["armchair", "chair", "living room", "furniture"], ["πολυθρόνα", "καρέκλα", "έπιπλα"]),
    "paint-bucket": ("tidying", ["paint", "bucket", "wall", "color"], ["χρώμα", "κουβάς", "τοίχος"]),
    "fence": ("tidying", ["fence", "garden", "yard", "outside"], ["φράχτης", "κήπος", "αυλή"]),
    "brush": ("tidying", ["brush", "paint", "clean", "sweep"], ["βούρτσα", "σκούπισμα", "χρώμα"]),
    # ---- school (18) ----
    "book": ("school", ["book", "read", "homework", "study"], ["βιβλίο", "διάβασμα", "σπουδές"]),
    "backpack": ("school", ["backpack", "bag", "school", "books"], ["σακίδιο", "σχολείο", "βιβλία"]),
    "graduation-cap": ("school", ["graduate", "cap", "education", "school"], ["αποφοίτηση", "εκπαίδευση", "σχολείο"]),
    "pencil": ("school", ["pencil", "write", "draw", "school"], ["μολύβι", "γράφω", "σχολείο"]),
    "pen-tool": ("school", ["pen", "write", "ink", "edit"], ["στυλό", "γράφω", "μελάνι"]),
    "ruler": ("school", ["ruler", "measure", "straightedge", "math"], ["χάρακας", "μέτρηση", "μαθηματικά"]),
    "calculator": ("school", ["calculator", "math", "compute", "numbers"], ["αριθμομηχανή", "μαθηματικά", "αριθμοί"]),
    "library": ("school", ["library", "books", "reading", "study"], ["βιβλιοθήκη", "βιβλία", "διάβασμα"]),
    "eraser": ("school", ["eraser", "rubber", "erase", "mistake"], ["γόμα", "διόρθωση"]),
    "paintbrush": ("school", ["paintbrush", "paint", "art", "brush"], ["πινέλο", "χρώμα", "τέχνη"]),
    "palette": ("school", ["palette", "art", "colors", "painting"], ["παλέτα", "τέχνη", "χρώματα"]),
    "music": ("school", ["music", "note", "song", "music class"], ["μουσική", "νότα", "τραγούδι"]),
    "guitar": ("school", ["guitar", "instrument", "music", "play"], ["κιθάρα", "μουσική", "μαθήματα"]),
    "notebook": ("school", ["notebook", "notes", "homework", "journal"], ["τετράδιο", "σημειώσεις", "εργασία"]),
    "brain": ("school", ["brain", "think", "learn", "study", "smart"], ["μυαλό", "σκέψη", "μάθηση", "έξυπνο"]),
    "globe": ("school", ["globe", "world", "geography", "earth"], ["υδρόγειος", "γεωγραφία", "κόσμος"]),
    "pencil-line": ("school", ["pencil", "write", "practice", "cursive"], ["μολύβι", "γράψιμο", "εξάσκηση"]),
    "compass": ("school", ["compass", "geometry", "math", "circle"], ["διαβήτης", "γεωμετρία", "μαθηματικά"]),
    # ---- pets (18) ----
    "dog": ("pets", ["dog", "pet", "walk", "animal", "puppy"], ["σκύλος", "ζώο", "βόλτα", "κουτάβι"]),
    "cat": ("pets", ["cat", "pet", "kitten", "animal"], ["γάτα", "ζώο", "γατάκι"]),
    "fish": ("pets", ["fish", "aquarium", "pet", "swim"], ["ψάρι", "ενυδρείο", "ζώο"]),
    "bird": ("pets", ["bird", "pet", "fly", "feathers"], ["πουλί", "ζώο", "φτερά"]),
    "rabbit": ("pets", ["rabbit", "bunny", "pet", "hop"], ["κουνέλι", "ζώο", "χαριτωμένο"]),
    "turtle": ("pets", ["turtle", "slow", "pet", "shell"], ["χελώνα", "ζώο", "καβούκι"]),
    "bug": ("pets", ["bug", "insect", "nature", "crawling"], ["έντομο", "φύση", "έρπετο"]),
    "paw-print": ("pets", ["paw", "pet", "animal", "footprint"], ["πατούσα", "ζώο", "αποτύπωμα"]),
    "trees": ("pets", ["trees", "forest", "nature", "park"], ["δέντρα", "δάσος", "φύση", "πάρκο"]),
    "flower-2": ("pets", ["flower", "bloom", "garden", "plant"], ["λουλούδι", "κήπος", "φυτό"]),
    "leaf": ("pets", ["leaf", "nature", "tree", "green"], ["φύλλο", "φύση", "πράσινο"]),
    "sprout": ("pets", ["sprout", "grow", "seed", "plant"], ["βλαστάρι", "ανάπτυξη", "φύτεμα"]),
    "mountain": ("pets", ["mountain", "hill", "outdoor", "nature"], ["βουνό", "εκδρομή", "φύση"]),
    "cloud": ("pets", ["cloud", "sky", "weather", "rain"], ["σύννεφο", "ουρανός", "καιρός"]),
    "heart": ("pets", ["heart", "love", "care", "affection", "pet"], ["καρδιά", "αγάπη", "φροντίδα", "ζώο"]),
    "volleyball": ("pets", ["volleyball", "sport", "outdoor", "ball"], ["βόλεϊ", "σπορ", "εξωτερικό", "μπάλα"]),
    "dumbbell": ("pets", ["dumbbell", "exercise", "sport", "fitness"], ["αλτήρας", "άσκηση", "γυμναστική"]),
    "fence": ("pets", ["fence", "garden", "yard", "outside"], ["φράχτης", "κήπος", "αυλή", "εξωτερικό"]),
    # ---- avatars (20) ----
    "fox": ("avatars", ["fox", "animal", "cute", "clever"], ["αλεπού", "ζώο", "έξυπνο"]),
    "unicorn": ("avatars", ["unicorn", "magic", "fantasy", "cute"], ["μονόκερος", "μαγικό", "φαντασία"]),
    "ghost": ("avatars", ["ghost", "spooky", "spirit", "fun"], ["φάντασμα", "πνεύμα", "διασκεδαστικό"]),
    "skull": ("avatars", ["skull", "edgy", "cool", "skeleton"], ["κρανίο", "δροσερό", "σκελετός"]),
    "rocket": ("avatars", ["rocket", "space", "launch", "fast"], ["πύραυλος", "διάστημα", "ταχύτητα"]),
    "flame": ("avatars", ["flame", "fire", "hot", "energy"], ["φλόγα", "φωτιά", "ενέργεια"]),
    "anchor": ("avatars", ["anchor", "sea", "strong", "steady"], ["άγκυρα", "θάλασσα", "δύναμη"]),
    "gem": ("avatars", ["gem", "diamond", "jewel", "precious"], ["κόσμημα", "διαμάντι", "πολύτιμο"]),
    "candy": ("avatars", ["candy", "sweet", "lollipop", "treat"], ["γλυκό", "ζαχαρωτό", "καραμέλα"]),
    "candy-off": ("avatars", ["no candy", "no sweets", "forbidden"], ["όχι γλυκά", "απαγορευμένο"]),
    "ferris-wheel": ("avatars", ["ferris wheel", "amusement", "fun"], ["ρόδα", "θέαμα", "διασκέδαση"]),
    "award": ("avatars", ["award", "badge", "achievement", "winner"], ["βραβείο", "επίτευγμα", "νίκη"]),
    "medal": ("avatars", ["medal", "winner", "gold", "prize"], ["μετάλλιο", "νικητής", "βραβείο"]),
    "zap": ("avatars", ["zap", "lightning", "energy", "power"], ["κεραυνός", "ενέργεια", "ηλεκτρισμός"]),
    "smile": ("avatars", ["smile", "happy", "face", "cheerful"], ["χαμόγελο", "χαρούμενο", "πρόσωπο"]),
    "laugh": ("avatars", ["laugh", "happy", "joy", "funny"], ["γέλιο", "χαρά", "αστείο"]),
    "swords": ("avatars", ["swords", "warrior", "brave", "knight"], ["σπαθιά", "πολεμιστής", "γενναίος", "ιππότης"]),
    "puzzle": ("avatars", ["puzzle", "smart", "clever", "think"], ["παζλ", "έξυπνο", "σκέψη"]),
    "shield-check": ("avatars", ["shield", "trusted", "reliable", "protect"], ["ασπίδα", "αξιόπιστο", "προστασία"]),
    "paint-bucket": ("avatars", ["paint", "creative", "artist", "color"], ["χρώμα", "δημιουργικό", "καλλιτέχνης"]),
    # ---- parent (15) ----
    "shield": ("parent", ["shield", "admin", "parent", "protect"], ["ασπίδα", "διαχειριστής", "γονέας", "προστασία"]),
    "crown": ("parent", ["crown", "king", "queen", "admin", "royal"], ["στέμμα", "βασιλιάς", "βασιλίσσα", "διαχειριστής"]),
    "key-round": ("parent", ["key", "access", "admin", "open"], ["κλειδί", "πρόσβαση", "διαχειριστής"]),
    "settings": ("parent", ["settings", "gear", "configure", "options"], ["ρυθμίσεις", "διαμόρφωση"]),
    "lock": ("parent", ["lock", "secure", "password", "locked"], ["κλειδαριά", "ασφάλεια"]),
    "lock-keyhole": ("parent", ["lock", "secure", "keyhole", "locked"], ["κλειδαριά", "ασφάλεια", "κλειδαρότρυπα"]),
    "file-text": ("parent", ["file", "document", "report", "paper"], ["αρχείο", "έγγραφο", "αναφορά"]),
    "clipboard": ("parent", ["clipboard", "list", "checklist", "notes"], ["πρόχειρο", "λίστα", "σημειώσεις"]),
    "bell": ("parent", ["bell", "notification", "alert", "reminder"], ["κωδωνάριο", "ειδοποίηση", "υπενθύμιση"]),
    "megaphone": ("parent", ["megaphone", "announcement", "broadcast"], ["μεγάφωνο", "ανακοίνωση", "μήνυμα"]),
    "stethoscope": ("parent", ["stethoscope", "health", "doctor", "medical"], ["στηθοσκόπιο", "υγεία", "γιατρός"]),
    "glasses": ("parent", ["glasses", "spectacles", "see", "observe"], ["γυαλιά", "παρατήρηση", "βλέπω"]),
    "users": ("parent", ["users", "family", "group", "manage"], ["χρήστες", "οικογένεια", "ομάδα", "διαχείριση"]),
    "receipt": ("parent", ["receipt", "bill", "expense", "household"], ["απόδειξη", "λογαριασμός", "νοικοκυριό"]),
    "hand-coins": ("parent", ["coins", "money", "reward", "allowance"], ["νομίσματα", "χρήματα", "επίδομα"]),
    # ---- rewards (22) ----
    "gift": ("rewards", ["gift", "present", "reward", "prize"], ["δώρο", "βραβείο", "παρουσίαση"]),
    "star": ("rewards", ["star", "points", "reward", "shine", "badge"], ["αστέρι", "πόντοι", "βραβείο", "λάμψη"]),
    "ice-cream": ("rewards", ["ice cream", "dessert", "sweet", "treat"], ["παγωτό", "γλυκό", "επιδόρπιο"]),
    "gamepad": ("rewards", ["gamepad", "game", "play", "console"], ["χειριστήριο", "παιχνίδι", "κονσόλα"]),
    "ticket": ("rewards", ["ticket", "admission", "event", "pass"], ["εισιτήριο", "εκδήλωση", "επίσκεψη"]),
    "film": ("rewards", ["film", "movie", "cinema", "screen"], ["ταινία", "κινηματογράφος", "οθόνη"]),
    "clapperboard": ("rewards", ["clapperboard", "movie", "video", "filming"], ["κλαπέτο", "βίντεο", "σινεμά"]),
    "party-popper": ("rewards", ["party", "celebration", "confetti", "fun"], ["πάρτι", "γιορτή", "διασκέδαση"]),
    "trophy": ("rewards", ["trophy", "winner", "champion", "prize"], ["κύπελλο", "νικητής", "βραβείο"]),
    "ship": ("rewards", ["ship", "boat", "travel", "voyage"], ["πλοίο", "κρουαζιέρα", "ταξίδι", "θάλασσα"]),
    "plane": ("rewards", ["plane", "flight", "travel", "fly"], ["αεροπλάνο", "ταξίδι", "πτήση"]),
    "map": ("rewards", ["map", "exploration", "journey", "travel"], ["χάρτης", "εξερεύνηση", "ταξίδι"]),
    "lollipop": ("rewards", ["lollipop", "sweet", "candy", "treat"], ["γλειφιτζούρι", "γλυκό", "ζαχαρωτό"]),
    "wine": ("rewards", ["wine", "drink", "celebration", "toast"], ["κρασί", "γιορτή", "ποτό"]),
    "tv": ("rewards", ["tv", "television", "screen time", "watch"], ["τηλεόραση", "οθόνη", "χρόνος οθόνης"]),
    "joystick": ("rewards", ["joystick", "game", "arcade", "play"], ["χειριστήριο", "αρκέιντ", "παιχνίδι"]),
    "boom-box": ("rewards", ["boom box", "music", "speaker", "radio"], ["ραδιόφωνο", "μουσική", "ηχείο"]),
    "ice-cream-cone": ("rewards", ["ice cream cone", "sweet", "dessert", "trip"], ["χωνάκι παγωτού", "έξοδος", "γλυκό"]),
    "candy-cane": ("rewards", ["candy cane", "sweet", "christmas", "treat"], ["καλαμάκι καραμέλας", "γλυκό", "χριστούγεννα"]),
    "luggage": ("rewards", ["luggage", "travel", "trip", "holiday"], ["αποσκευές", "ταξίδι", "διακοπές"]),
    "store": ("rewards", ["store", "shop", "buy", "market"], ["κατάστημα", "αγορά", "ψώνια"]),
    "coins": ("rewards", ["coins", "money", "allowance", "earn"], ["νομίσματα", "χρήματα", "επίδομα", "κέρδος"]),
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
