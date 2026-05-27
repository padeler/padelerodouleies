"""Download Lucide SVG icons for the padelerodouleies icon catalog.
Usage: python scripts/fetch_icons.py
Downloads SVGs from jsDelivr CDN into backend/app/icons/svg/.
"""
from pathlib import Path
from urllib.request import urlretrieve
from urllib.error import HTTPError
import concurrent.futures

# Lucide CDN — raw SVGs per icon name
CDN = "https://cdn.jsdelivr.net/npm/lucide-static@0.469.0/icons/{name}.svg"

# Icons to download by category. Name is the Lucide icon slug.
# Existing icons (15) are: bed, book, crown, dog, fox, gamepad, gift,
# ice-cream, plate, shield, shower, star, sun, tooth, unicorn
# We skip those that already exist.

WANTED = [
    # Hygiene (12 new)
    ("bath", "hygiene"),
    ("droplets", "hygiene"),          # soap / water drops
    ("hand-metal", "hygiene"),        # hand washing
    ("headphones", "hygiene"),        # ear care
    ("hand", "hygiene"),              # hand washing
    ("umbrella", "hygiene"),          # rain / wet
    ("waves", "hygiene"),             # water
    ("wind", "hygiene"),              # fresh air
    ("flame", "hygiene"),             # warmth
    ("sunset", "hygiene"),            # evening routine
    ("moon-stars", "hygiene"),        # nighttime hygiene
    ("egg", "hygiene"),               # baby care
    # Meals (15 new)
    ("apple", "meals"),
    ("coffee", "meals"),
    ("croissant", "meals"),
    ("cup-soda", "meals"),
    ("glass-water", "meals"),
    ("milk", "meals"),
    ("pizza", "meals"),
    ("sandwich", "meals"),
    ("utensils", "meals"),
    ("utensils-crossed", "meals"),
    ("chef-hat", "meals"),
    ("cookie", "meals"),
    ("cake", "meals"),
    ("carrot", "meals"),
    ("sandwich", "meals"),
    ("sushi", "meals"),
    ("salad", "meals"),
    ("cookie", "meals"),
    # Tidying (15 new)
    ("broom", "tidying"),
    ("can", "tidying"),               # trash can
    ("box", "tidying"),               # toy box
    ("archive", "tidying"),           # storage
    ("folder", "tidying"),            # organizing
    ("package", "tidying"),           # packing
    ("shopping-bag", "tidying"),      # bags away
    ("trash-2", "tidying"),           # recycling
    ("recycle", "tidying"),           # recycling
    ("droplet", "tidying"),           # cleaning drops
    ("sparkles", "tidying"),          # clean / shiny
    ("mop", "tidying"),
    ("car", "tidying"),               # clean car
    ("bike", "tidying"),              # put bike away
    ("scissors", "tidying"),          # cutting / crafting tidy
    # School (12 new)
    ("backpack", "school"),
    ("graduation-cap", "school"),
    ("pencil", "school"),
    ("pen-tool", "school"),
    ("ruler", "school"),
    ("calculator", "school"),
    ("library", "school"),
    ("eraser", "school"),
    ("paintbrush", "school"),
    ("palette", "school"),
    ("music", "school"),
    ("guitar", "school"),
    # Pets (15 new)
    ("cat", "pets"),
    ("fish", "pets"),
    ("bird", "pets"),
    ("rabbit", "pets"),
    ("turtle", "pets"),
    ("butterfly", "pets"),
    ("bug", "pets"),
    ("paw-print", "pets"),
    ("trees", "pets"),
    ("flower-2", "pets"),
    ("leaf", "pets"),
    ("seedling", "pets"),
    ("sprout", "pets"),
    ("mountain", "pets"),
    ("cloud", "pets"),
    # Avatars (12 new, skip fox, unicorn which exist)
    ("ghost", "avatars"),
    ("skull", "avatars"),
    ("robot", "avatars"),
    ("rocket", "avatars"),
    ("lightning", "avatars"),
    ("flame", "avatars"),
    ("anchor", "avatars"),
    ("gem", "avatars"),
    ("candy", "avatars"),
    ("candy-off", "avatars"),
    ("ferris-wheel", "avatars"),
    ("award", "avatars"),
    ("medal", "avatars"),
    # Parent (8 new, skip shield, crown)
    ("key-round", "parent"),
    ("settings", "parent"),
    ("lock", "parent"),
    ("lock-keyhole", "parent"),
    ("file-text", "parent"),
    ("clipboard", "parent"),
    ("bell", "parent"),
    ("megaphone", "parent"),
    # Rewards (15 new, skip gift, star, ice-cream, gamepad)
    ("ticket", "rewards"),
    ("balloon", "rewards"),
    ("swimming-pool", "rewards"),
    ("film", "rewards"),
    ("clapperboard", "rewards"),
    ("party-popper", "rewards"),
    ("confetti", "rewards"),
    ("sparkles", "rewards"),
    ("trophy", "rewards"),
    ("medal", "rewards"),
    ("crown", "rewards"),
    ("candy", "rewards"),
    ("lollipop", "rewards"),
    ("champagne", "rewards"),
    ("ship", "rewards"),
    ("plane", "rewards"),
    ("map", "rewards"),
]

SVG_DIR = Path(__file__).parent.parent / "backend" / "app" / "icons" / "svg"

def download_one(name: str) -> str:
    url = CDN.format(name=name)
    dest = SVG_DIR / f"{name}.svg"
    try:
        urlretrieve(url, dest)
        return f"OK {name}"
    except HTTPError as e:
        return f"FAIL {name}: HTTP {e.code}"
    except Exception as e:
        return f"FAIL {name}: {e}"

def main():
    SVG_DIR.mkdir(parents=True, exist_ok=True)
    # Deduplicate: skip already-downloaded
    to_download = [name for name, _ in WANTED if not (SVG_DIR / f"{name}.svg").exists()]
    print(f"Downloading {len(to_download)} new SVGs ({len(WANTED) - len(to_download)} already exist)")
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        results = list(pool.map(download_one, to_download))
    for r in results:
        print(r)
    ok = sum(1 for r in results if r.startswith("OK"))
    fail = sum(1 for r in results if r.startswith("FAIL"))
    print(f"\nDone: {ok} ok, {fail} failed out of {len(results)}")

if __name__ == "__main__":
    main()
