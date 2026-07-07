#!/usr/bin/env python3
"""Master vocabulary + icon generator for the Learning Adventure letters track.

Single source of truth for the per-letter vocabulary *pool* (≈10 entries per
Greek letter) that gives the letter-matching game its variety/replayability.
Each entry is a Greek word starting with that letter plus an icon that is either
an old-tablet-safe emoji (Unicode ≤6.1, renders on the Samsung Tab 4 / Android
4.4) or a generated transparent PNG under ``frontend/public/learn-icons/``.

Dev-machine tool only — never shipped in the container (lives under
``exercise_lab/``). Two modes:

  * ``emit``     — codegen the two data files consumed at runtime:
                     frontend/src/pages/dashboard/games/learn/letterVocabData.ts
                     backend/app/services/learn_vocab.py
                   (keeps the TS pool and the Python word table in lock-step).
  * ``generate`` — for every image entry whose PNG is missing, generate it on the
                   ComfyUI HTTP API (SDXL), post-process to a centered transparent
                   downscaled icon, and save it. ``--only id1,id2`` regenerates
                   specific ids; ``--force`` overwrites existing PNGs.

Run ``emit`` after any table edit; commit the emitted files + PNGs.
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ICON_DIR = REPO / "frontend" / "public" / "learn-icons"
TS_OUT = REPO / "frontend" / "src" / "pages" / "dashboard" / "games" / "learn" / "letterVocabData.ts"
PY_OUT = REPO / "backend" / "app" / "services" / "learn_vocab.py"

COMFY = "http://192.168.1.2:8188"
CKPT = "sd_xl_base_1.0.safetensors"
ICON_PX = 160  # long-edge px of the saved icon (small, for old tablets)

STYLE = (
    "a die-cut sticker of {subj}, one single object only, centered, isolated on "
    "a plain solid pure white background, flat vector cartoon clip-art, thick "
    "bold outlines, bright flat colors, cute simple children's style, "
    "no shadow, no gradient, no text"
)
NEG = (
    "photo, realistic, 3d, texture, gradient, shadow, scenery, landscape, "
    "pattern, repeating, tiled, seamless, wallpaper, multiple objects, collage, "
    "lined paper, notebook, sketch, frame, border, rectangle, panel, text, "
    "letters, words, watermark, blurry, dark, cropped, colored background"
)


@dataclass(frozen=True)
class Entry:
    id: str          # globally-unique slug (audio key + PNG filename stem)
    word: str        # Greek word starting with the letter
    emoji: str | None = None   # old-tablet-safe emoji (Unicode ≤6.1)
    prompt: str | None = None  # SDXL subject phrase (image entries only)

    @property
    def is_image(self) -> bool:
        return self.emoji is None


def e(id_: str, word: str, emoji: str) -> Entry:
    return Entry(id_, word, emoji=emoji)


def i(id_: str, word: str, prompt: str) -> Entry:
    return Entry(id_, word, prompt=prompt)


# Per-letter pool. Index 0 = the canonical entry (drives spell + starts-with
# primary icon); index 1 = the curated "extra" for letters that had one (the
# starts-with second picture). Both are preserved from the original dataset so
# the falling-targets variants keep working. Emoji chosen from the same vetted
# ≤6.1 set the codebase already relies on.
VOCAB: dict[str, list[Entry]] = {
    "l01": [  # Α — άλφα
        e("aeroplano", "αεροπλάνο", "✈"),
        e("arkouda", "αρκούδα", "🐻"),
        e("astro", "αστέρι", "⭐"),
        e("alogo", "άλογο", "🐴"),
        e("ananas", "ανανάς", "🍍"),
        e("achladi", "αχλάδι", "🍐"),
        e("aftokinito", "αυτοκίνητο", "🚗"),
        e("arni", "αρνί", "🐑"),
        e("achivada", "αχιβάδα", "🐚"),
        i("alepou", "αλεπού", "a cute red fox sitting"),
    ],
    "l02": [  # Β — βήτα
        e("vivlio", "βιβλίο", "📖"),
        e("varka", "βάρκα", "⛵"),
        e("vatrachos", "βάτραχος", "🐸"),
        e("vodi", "βόδι", "🐂"),
        e("vouno", "βουνό", "⛰"),
        e("vasilias", "βασιλιάς", "👑"),
        i("vazo", "βάζο", "a blue flower vase with flowers"),
        i("valitsa", "βαλίτσα", "a travel suitcase"),
        i("velanidi", "βελανίδι", "an acorn"),
        i("vamvaki", "βαμβάκι", "a white cotton plant boll"),
    ],
    "l03": [  # Γ — γάμα
        e("gata", "γάτα", "🐱"),
        e("gourouni", "γουρούνι", "🐷"),
        e("gyalia", "γυαλιά", "👓"),
        e("garida", "γαρίδα", "🍤"),
        e("gliko", "γλυκό", "🍰"),
        i("gaidaros", "γάιδαρος", "a grey donkey"),
        i("galopoula", "γαλοπούλα", "a turkey bird"),
        i("glastra", "γλάστρα", "a green plant in a flower pot"),
        i("gantia", "γάντια", "a pair of colorful winter gloves"),
        i("garyfallo", "γαρύφαλλο", "a red carnation flower"),
    ],
    "l04": [  # Δ — δέλτα
        e("dachtylidi", "δαχτυλίδι", "💍"),
        e("drakos", "δράκος", "🐉"),
        e("dentro", "δέντρο", "🌳"),
        e("delfini", "δελφίνι", "🐬"),
        e("doro", "δώρο", "🎁"),
        e("diamanti", "διαμάντι", "💎"),
        i("deinosauros", "δεινόσαυρος", "a green cartoon dinosaur"),
        i("damaskino", "δαμάσκηνο", "a purple plum fruit"),
        i("drepani", "δρεπάνι", "a curved sickle with a crescent blade and a short wooden handle"),
    ],
    "l05": [  # Ε — έψιλον
        e("elefantas", "ελέφαντας", "🐘"),
        e("elikoptero", "ελικόπτερο", "🚁"),
        e("elato", "έλατο", "🌲"),
        e("entomo", "έντομο", "🐞"),
        e("ekklisia", "εκκλησία", "⛪"),
        e("ergaleia", "εργαλεία", "🔧"),
        i("elia", "ελιά", "a single green olive"),
        i("elafi", "ελάφι", "a cute brown deer"),
    ],
    "l06": [  # Ζ — ζήτα
        e("zari", "ζάρι", "🎲"),
        e("zymarika", "ζυμαρικά", "🍝"),
        e("zacharoto", "ζαχαρωτό", "🍬"),
        e("zografia", "ζωγραφιά", "🎨"),
        i("zevra", "ζέβρα", "a striped zebra"),
    ],
    "l07": [  # Η — ήτα
        e("ilios", "ήλιος", "☀"),
        e("ilianthos", "ηλίανθος", "🌻"),
        e("imerologio", "ημερολόγιο", "📅"),
        e("ifaisteio", "ηφαίστειο", "🌋"),
    ],
    "l08": [  # Θ — θήτα
        e("thalassa", "θάλασσα", "🌊"),
        e("theatro", "θέατρο", "🎭"),
        i("thermometro", "θερμόμετρο", "a thermometer"),
        i("thisavros", "θησαυρός", "a pirate treasure chest full of gold"),
        i("thamnos", "θάμνος", "a small green bush"),
    ],
    "l09": [  # Ι — γιώτα
        i("ippopotamos", "ιπποπόταμος", "a cute hippopotamus"),
        i("ippotis", "ιππότης", "a knight in shiny armor"),
        i("iglou", "ιγκλού", "a white snow igloo dome made of ice blocks"),
    ],
    "l10": [  # Κ — κάπα
        e("kipos", "κήπος", "🌳"),
        e("kota", "κότα", "🐔"),
        e("karpouzi", "καρπούζι", "🍉"),
        e("kastano", "κάστανο", "🌰"),
        e("kerasi", "κεράσι", "🍒"),
        e("kastro", "κάστρο", "🏰"),
        e("kleidi", "κλειδί", "🔑"),
        e("kithara", "κιθάρα", "🎸"),
        i("koukla", "κούκλα", "a cute rag doll toy"),
        i("kavouri", "καβούρι", "a red crab"),
    ],
    "l11": [  # Λ — λάμδα
        e("lagos", "λαγός", "🐰"),
        e("louloudi", "λουλούδι", "🌸"),
        e("lemoni", "λεμόνι", "🍋"),
        e("lampa", "λάμπα", "💡"),
        e("lykos", "λύκος", "🐺"),
        i("lachano", "λάχανο", "a green cabbage"),
        i("lofos", "λόφος", "a green rolling hill"),
    ],
    "l12": [  # Μ — μι
        e("bala", "μπάλα", "⚽"),
        e("banana", "μπανάνα", "🍌"),
        e("milo", "μήλο", "🍎"),
        e("melissa", "μέλισσα", "🐝"),
        e("maimou", "μαϊμού", "🐵"),
        e("mandarini", "μανταρίνι", "🍊"),
        e("manitari", "μανιτάρι", "🍄"),
        e("molyvi", "μολύβι", "✏"),
        e("mpotes", "μπότες", "👢"),
        i("machairi", "μαχαίρι", "a kitchen knife"),
    ],
    "l13": [  # Ν — νι
        e("nero", "νερό", "💧"),
        e("notes", "νότες", "🎵"),
        e("ntalika", "νταλίκα", "🚛"),
        i("naos", "ναός", "an ancient greek temple building with tall white columns and a triangular roof"),
        i("nisi", "νησί", "a small tropical island"),
    ],
    "l14": [  # Ξ — ξι
        i("xylofono", "ξυλόφωνο", "a colorful toy xylophone"),
        i("xifos", "ξίφος", "a shiny sword"),
        i("xylo", "ξύλο", "a wooden log"),
        i("xystra", "ξύστρα", "a pencil sharpener"),
        i("xotiko", "ξωτικό", "a cute little elf"),
        i("xaplostra", "ξαπλώστρα", "a beach lounge chair"),
        i("xifias", "ξιφίας", "a swordfish"),
    ],
    "l15": [  # Ο — όμικρον
        e("ochia", "οχιά", "🐍"),
        e("ombrela", "ομπρέλα", "☂"),
        e("ouraniotoxo", "ουράνιο τόξο", "🌈"),
        e("omeleta", "ομελέτα", "🍳"),
        i("odontovourtsa", "οδοντόβουρτσα", "a toothbrush"),
    ],
    "l16": [  # Π — πι
        e("pagoto", "παγωτό", "🍦"),
        e("papoutsi", "παπούτσι", "👟"),
        e("pouli", "πουλί", "🐦"),
        e("peponi", "πεπόνι", "🍈"),
        e("pigouinos", "πιγκουίνος", "🐧"),
        e("podilato", "ποδήλατο", "🚲"),
        e("piano", "πιάνο", "🎹"),
        e("portokali", "πορτοκάλι", "🍊"),
        i("petalouda", "πεταλούδα", "a colorful butterfly"),
        i("papia", "πάπια", "a yellow duck"),
    ],
    "l17": [  # Ρ — ρο
        e("roloi", "ρολόι", "⏰"),
        e("rodo", "ρόδο", "🌹"),
        e("raketa", "ρακέτα", "🎾"),
        e("rouketa", "ρουκέτα", "🚀"),
        i("rodi", "ρόδι", "a red pomegranate fruit"),
        i("robot", "ρομπότ", "a cute friendly robot"),
    ],
    "l18": [  # Σ — σίγμα
        e("skylos", "σκύλος", "🐕"),
        e("spiti", "σπίτι", "🏠"),
        e("sokolata", "σοκολάτα", "🍫"),
        e("stafyli", "σταφύλι", "🍇"),
        e("saligkari", "σαλιγκάρι", "🐌"),
        e("sfyri", "σφυρί", "🔨"),
        i("syko", "σύκο", "a purple fig fruit"),
        i("skoupa", "σκούπα", "a broom with yellow straw bristles and a long wooden handle, upright"),
    ],
    "l19": [  # Τ — ταυ
        e("treno", "τρένο", "🚂"),
        e("tilefono", "τηλέφωνο", "☎"),
        e("tigris", "τίγρης", "🐯"),
        e("tourta", "τούρτα", "🎂"),
        e("tsanta", "τσάντα", "👜"),
        e("tsai", "τσάι", "☕"),
        e("trakter", "τρακτέρ", "🚜"),
        i("tyri", "τυρί", "a wedge of yellow cheese"),
        i("tympano", "τύμπανο", "a drum"),
    ],
    "l20": [  # Υ — ύψιλον
        i("ypovrychio", "υποβρύχιο", "a yellow submarine"),
        e("ypologistis", "υπολογιστής", "💻"),
        e("ydrogeios", "υδρόγειος", "🌍"),
        i("yaina", "ύαινα", "a spotted hyena"),
        i("yakinthos", "υάκινθος", "a purple hyacinth flower"),
    ],
    "l21": [  # Φ — φι
        e("fraoula", "φράουλα", "🍓"),
        e("feggari", "φεγγάρι", "🌙"),
        e("foustani", "φουστάνι", "👗"),
        i("faros", "φάρος", "a lighthouse"),
        i("fasoli", "φασόλι", "a single bean seed"),
        i("fournos", "φούρνος", "a kitchen oven"),
        i("flogera", "φλογέρα", "a wooden flute"),
    ],
    "l22": [  # Χ — χι
        e("chtapodi", "χταπόδι", "🐙"),
        e("chelona", "χελώνα", "🐢"),
        e("chioni", "χιόνι", "⛄"),
        i("chartaetos", "χαρταετός", "a diamond kite flying"),
        i("chartis", "χάρτης", "a treasure map"),
        i("cheli", "χέλι", "an eel fish"),
    ],
    "l23": [  # Ψ — ψι
        e("psari", "ψάρι", "🐟"),
        e("psalidi", "ψαλίδι", "✂"),
        e("psomi", "ψωμί", "🍞"),
        i("psygeio", "ψυγείο", "a kitchen refrigerator"),
        i("psathino", "ψάθινο καπέλο", "a straw sun hat"),
        i("psekastiri", "ψεκαστήρι", "a spray bottle"),
    ],
    "l24": [  # Ω — ωμέγα
        i("okeanos", "ωκεανός", "ocean waves"),
        e("orologio", "ωρολόγιο", "⏰"),
        i("oceanida", "ωκεανίδα", "a mermaid in the sea"),
    ],
}


# --- codegen ------------------------------------------------------------------

def _ts_entry(entry: Entry) -> str:
    if entry.emoji is not None:
        icon = f"emoji: {json.dumps(entry.emoji, ensure_ascii=False)}"
    else:
        icon = f"image: {json.dumps(f'/learn-icons/{entry.id}.png')}"
    return (
        f"    {{ id: {json.dumps(entry.id)}, "
        f"word: {json.dumps(entry.word, ensure_ascii=False)}, {icon} }},"
    )


def emit_ts() -> None:
    lines = [
        "// AUTO-GENERATED by exercise_lab/tools/gen_learn_icons.py — do not edit by hand.",
        "// The per-letter vocabulary pool (multiple word+icon entries per letter) that",
        "// gives the letter-matching game its variety. Regenerate with:",
        "//   python exercise_lab/tools/gen_learn_icons.py emit",
        "import type { LetterVocabEntry } from './letterVocab';",
        "",
        "export const LETTER_VOCAB_POOL: Record<string, LetterVocabEntry[]> = {",
    ]
    for token, entries in VOCAB.items():
        lines.append(f"  {token}: [")
        lines.extend(_ts_entry(en) for en in entries)
        lines.append("  ],")
    lines.append("};")
    lines.append("")
    TS_OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {TS_OUT.relative_to(REPO)} ({sum(len(v) for v in VOCAB.values())} entries)")


def emit_py() -> None:
    lines = [
        '"""AUTO-GENERATED by exercise_lab/tools/gen_learn_icons.py — do not edit by hand.',
        "",
        "The vocabulary word behind every letter-icon tile, keyed by entry id. Drives",
        "the per-word TTS endpoint + startup warming. Mirrors LETTER_VOCAB_POOL in",
        "frontend letterVocabData.ts. Regenerate with:",
        "    python exercise_lab/tools/gen_learn_icons.py emit",
        '"""',
        "",
        "from __future__ import annotations",
        "",
        "# id -> Greek word (spoken when the kid taps the icon tile).",
        "LETTER_VOCAB_WORDS: dict[str, str] = {",
    ]
    for entries in VOCAB.values():
        for en in entries:
            lines.append(f"    {json.dumps(en.id)}: {json.dumps(en.word, ensure_ascii=False)},")
    lines.append("}")
    lines.append("")
    PY_OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {PY_OUT.relative_to(REPO)}")


def validate() -> None:
    """Fail loudly on duplicate ids or empty pools before emitting."""
    seen: dict[str, str] = {}
    for token, entries in VOCAB.items():
        if not entries:
            raise SystemExit(f"{token}: empty pool")
        for en in entries:
            if en.id in seen:
                raise SystemExit(f"duplicate id {en.id!r} ({token} and {seen[en.id]})")
            seen[en.id] = token
    print(f"validated {len(seen)} unique entries across {len(VOCAB)} letters")


# --- image generation ---------------------------------------------------------

def _graph(subj: str, seed: int) -> dict:
    return {
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": 768, "height": 768, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": STYLE.format(subj=subj), "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": NEG, "clip": ["4", 1]}},
        "3": {"class_type": "KSampler", "inputs": {
            "seed": seed, "steps": 26, "cfg": 7.0, "sampler_name": "dpmpp_2m",
            "scheduler": "karras", "denoise": 1.0,
            "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "kidicon", "images": ["8", 0]}},
    }


def _submit(g: dict) -> str:
    body = json.dumps({"prompt": g}).encode()
    req = urllib.request.Request(f"{COMFY}/prompt", body, {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req))["prompt_id"]


def _wait(pid: str, timeout: int = 180):
    for _ in range(timeout):
        h = json.load(urllib.request.urlopen(f"{COMFY}/history/{pid}"))
        if pid in h:
            return h[pid]
        time.sleep(1)
    raise TimeoutError(pid)


def _fetch(info: dict):
    from PIL import Image
    img = info["outputs"]["9"]["images"][0]
    url = f"{COMFY}/view?filename={img['filename']}&subfolder={img['subfolder']}&type={img['type']}"
    return Image.open(io.BytesIO(urllib.request.urlopen(url).read())).convert("RGBA")


def _floodfill_white(im):
    """Edge flood-fill near-white -> transparent (returns the full-size RGBA,
    pre-crop, so background clearance can be measured on the original frame)."""
    from PIL import ImageDraw
    im = im.convert("RGBA")
    w, h = im.size
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
             (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    for s in seeds:
        try:
            ImageDraw.floodfill(im, s, (0, 0, 0, 0), thresh=40)
        except Exception:
            pass
    return im


def _finalize(im, size: int = ICON_PX):
    """Autocrop to content, square-pad (keep aspect), downscale to the icon px."""
    from PIL import Image
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    side = max(im.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def _bg_clear_ratio(flood_filled) -> float:
    """Fraction of the outer 6% frame that is transparent, measured on the
    *pre-crop* flood-filled image — a real signal of whether the plain white
    background was removed. Low ⇒ pattern / colored fill the flood-fill couldn't
    reach (a failed generation), so retry."""
    px = flood_filled.load()
    w, h = flood_filled.size
    band = max(4, w // 16)
    ring = clear = 0
    for y in range(0, h, 2):  # stride 2 — the ring is large, exact count not needed
        for x in range(0, w, 2):
            if x < band or x >= w - band or y < band or y >= h - band:
                ring += 1
                if px[x, y][3] == 0:
                    clear += 1
    return clear / max(1, ring)


def generate(only: set[str] | None, force: bool) -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    todo = [
        en for entries in VOCAB.values() for en in entries
        if en.is_image and (only is None or en.id in only)
        and (force or not (ICON_DIR / f"{en.id}.png").exists())
    ]
    print(f"generating {len(todo)} icons -> {ICON_DIR.relative_to(REPO)}")
    for n, en in enumerate(todo, 1):
        best = None
        best_ratio = -1.0
        for attempt in range(4):  # QC retry: keep the cleanest-background cutout
            seed = (abs(hash(en.id)) + attempt * 7919) % 1_000_000
            filled = _floodfill_white(_fetch(_wait(_submit(_graph(en.prompt, seed)))))
            ratio = _bg_clear_ratio(filled)
            if ratio > best_ratio:
                best, best_ratio = filled, ratio
            if ratio >= 0.98:  # clean white background removed — accept
                break
        assert best is not None
        _finalize(best).save(ICON_DIR / f"{en.id}.png")
        flag = "" if best_ratio >= 0.9 else "  ⚠ check bg"
        print(f"  [{n}/{len(todo)}] {en.id} ({en.word})  bg_clear={best_ratio:.2f}{flag}", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("emit", help="codegen the TS pool + Python word table")
    g = sub.add_parser("generate", help="generate missing icon PNGs via ComfyUI")
    g.add_argument("--only", help="comma-separated entry ids to (re)generate")
    g.add_argument("--force", action="store_true", help="overwrite existing PNGs")
    sub.add_parser("validate", help="check ids are unique and pools non-empty")
    args = ap.parse_args()

    if args.cmd == "emit":
        validate()
        emit_ts()
        emit_py()
    elif args.cmd == "validate":
        validate()
    elif args.cmd == "generate":
        only = set(args.only.split(",")) if args.only else None
        generate(only, args.force)


if __name__ == "__main__":
    sys.exit(main())
