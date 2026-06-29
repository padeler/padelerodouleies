"""Learning Adventure decks — Greek phonetics + deck/tier definitions.

Single source of truth for the two teaching-game tracks (``letters`` / ``numbers``).
The string fed to Piper TTS (``DeckItem.tts``) is never the bare glyph — Piper's
Greek voice mispronounces isolated digits ("5") and letter glyphs ("Α") — and is
never even the bare spoken word: Piper renders *isolated short words* with broken
intonation and clips them badly (rhasspy/piper#252 — a one-syllable name like
"πι" synthesizes to ~0.16s of illegible audio). So the spoken string embeds the
name/word in a tiny carrier phrase ("Γράμμα άλφα." / "Αριθμός πέντε.") that gives
Piper sentence context — and that the kid also benefits from ("the letter alpha",
"the number five"). The on-screen ``glyph`` is unchanged.

Pure and DOM-free. ``build_deck()`` is the only entry point the API
(``app.api.learn``) and the TTS-warming pass (``app.services.learn_tts``)
consume. ``DeckItem.tts`` is Piper input and is stripped from the kid-facing
payload by the API.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

Track = Literal["letters", "numbers"]

# The two tracks, in display order. Used by the API and the TTS warmer.
TRACKS: tuple[Track, ...] = ("numbers", "letters")

# --- Greek number words (neuter counting form, 1..100) ------------------------
# Neuter is the gender used when counting objects ("τρία μήλα"), so "τρία" — not
# the masculine/feminine "τρεις". These small tables drive greek_number_word().

# 1..12 are irregular and spelled out directly.
_ONES_TEENS: dict[int, str] = {
    1: "ένα",
    2: "δύο",
    3: "τρία",
    4: "τέσσερα",
    5: "πέντε",
    6: "έξι",
    7: "επτά",
    8: "οκτώ",
    9: "εννέα",
    10: "δέκα",
    11: "έντεκα",
    12: "δώδεκα",
}

# Units 1..9, reused for the teens (13..19, as "δεκα" + unit) and for the
# compound tens (e.g. 21 = "είκοσι" + " " + "ένα").
_UNITS: dict[int, str] = {n: _ONES_TEENS[n] for n in range(1, 10)}

# Whole tens 20..100.
_TENS: dict[int, str] = {
    20: "είκοσι",
    30: "τριάντα",
    40: "σαράντα",
    50: "πενήντα",
    60: "εξήντα",
    70: "εβδομήντα",
    80: "ογδόντα",
    90: "ενενήντα",
    100: "εκατό",
}

NUMBER_MIN = 1
NUMBER_MAX = 100


def greek_number_word(n: int) -> str:
    """Return the Greek neuter counting word for ``n`` (1..100).

    Raises ValueError outside the supported range — no silent clamping.
    """
    if not NUMBER_MIN <= n <= NUMBER_MAX:
        raise ValueError(f"greek_number_word: n must be {NUMBER_MIN}..{NUMBER_MAX}, got {n}")
    if n <= 12:
        return _ONES_TEENS[n]
    if n <= 19:  # 13..19 — "δεκα" prefix + unit, written as one word
        return "δεκα" + _UNITS[n - 10]
    if n == 100:
        return _TENS[100]
    tens, unit = divmod(n, 10)
    tens_word = _TENS[tens * 10]
    return tens_word if unit == 0 else f"{tens_word} {_UNITS[unit]}"


# --- Greek letter names -------------------------------------------------------
# (uppercase, lowercase, spoken name) in alphabetical order, indexed 1..24.
# Both cases share one spoken name (Α and α → "άλφα"), wrapped by letter_tts().
_LETTERS: tuple[tuple[str, str, str], ...] = (
    ("Α", "α", "άλφα"),
    ("Β", "β", "βήτα"),
    ("Γ", "γ", "γάμμα"),
    ("Δ", "δ", "δέλτα"),
    ("Ε", "ε", "έψιλον"),
    ("Ζ", "ζ", "ζήτα"),
    ("Η", "η", "ήτα"),
    ("Θ", "θ", "θήτα"),
    ("Ι", "ι", "γιώτα"),
    ("Κ", "κ", "κάππα"),
    ("Λ", "λ", "λάμδα"),
    ("Μ", "μ", "μι"),
    ("Ν", "ν", "νι"),
    ("Ξ", "ξ", "ξι"),
    ("Ο", "ο", "όμικρον"),
    ("Π", "π", "πι"),
    ("Ρ", "ρ", "ρο"),
    ("Σ", "σ", "σίγμα"),
    ("Τ", "τ", "ταυ"),
    ("Υ", "υ", "ύψιλον"),
    ("Φ", "φ", "φι"),
    ("Χ", "χ", "χι"),
    ("Ψ", "ψ", "ψι"),
    ("Ω", "ω", "ωμέγα"),
)

LETTER_COUNT = len(_LETTERS)  # 24


# --- Carrier phrases for Piper ------------------------------------------------
# Piper renders isolated short words with broken intonation and clips them
# (rhasspy/piper#252) — bare "πι" is ~0.16s of illegible audio. Wrapping the
# name/word in a two-word carrier gives Piper sentence context (and teaches the
# kid "the letter …" / "the number …"). The trailing period yields a declarative
# (falling) intonation instead of the clipped, question-like reading of a lone
# word. The on-screen glyph is unchanged.


def letter_tts(name: str) -> str:
    """Spoken Piper string for a letter: e.g. ``"άλφα"`` → ``"Γράμμα άλφα."``."""
    return f"Γράμμα {name}."


def number_tts(word: str) -> str:
    """Spoken Piper string for a number: e.g. ``"πέντε"`` → ``"Αριθμός πέντε."``."""
    return f"Αριθμός {word}."


# --- Spoken level intros ------------------------------------------------------
# A short, kid-friendly sentence spoken before each level starts (the "audible
# description of the round"). Full sentences (not isolated words) so Piper gives
# them natural prosody. Keyed by the frontend LevelType; track-agnostic. The API
# (``app.api.learn``) serves these and the TTS warmer pre-records them.
LevelType = Literal["count", "match", "hear", "order", "whats_next"]

LEVEL_INTROS: dict[LevelType, str] = {
    "count": "Μέτρησε πόσα είναι και διάλεξε τον σωστό αριθμό.",
    "match": "Ταίριαξε τα κεφαλαία με τα μικρά γράμματα.",
    "hear": "Άκουσε τη λέξη και διάλεξε τη σωστή. Γρήγορα!",
    "order": "Βάλε τα στη σωστή σειρά.",
    "whats_next": "Βρες τι ακολουθεί. Γρήγορα!",
}


def intro_text(level: str) -> str:
    """Return the spoken intro sentence for a level type.

    Raises ValueError for an unknown level — no silent default.
    """
    if level not in LEVEL_INTROS:
        raise ValueError(f"intro_text: unknown level {level!r}")
    return LEVEL_INTROS[level]


# --- Deck model ---------------------------------------------------------------


class DeckItem(BaseModel):
    """One learnable unit: a number or a letter.

    ``glyph`` is the primary character shown (the digit, or the uppercase
    letter); ``glyph_alt`` is the lowercase letter for the case-matching level
    (``None`` for numbers). ``tts`` is the Piper input word and is never sent to
    the client.
    """

    model_config = ConfigDict(extra="forbid")

    token: str  # path-safe stable id, e.g. "n5" / "l01"
    glyph: str
    glyph_alt: str | None
    tts: str


class Tier(BaseModel):
    """A difficulty tier: which deck tokens are in play, and its 1-based level."""

    model_config = ConfigDict(extra="forbid")

    level: int
    tokens: list[str]


class Deck(BaseModel):
    """A full track: its ordered items plus the looping difficulty tiers."""

    model_config = ConfigDict(extra="forbid")

    track: Track
    items: list[DeckItem]
    tiers: list[Tier]


# Per-tier ceilings. Numbers grow the value range; letters grow the alphabet
# slice. The recognition levels scale with these; Count Them caps its object
# set separately (engine concern), so its tier reach is irrelevant here.
_NUMBER_TIER_MAX: tuple[int, ...] = (10, 20, 50, 100)
_LETTER_TIER_MAX: tuple[int, ...] = (9, 13, 18, 24)  # Α–Ι, Α–Ν, Α–Σ, Α–Ω


def _number_items() -> list[DeckItem]:
    return [
        DeckItem(token=f"n{n}", glyph=str(n), glyph_alt=None, tts=number_tts(greek_number_word(n)))
        for n in range(NUMBER_MIN, NUMBER_MAX + 1)
    ]


def _letter_items() -> list[DeckItem]:
    return [
        DeckItem(token=f"l{i:02d}", glyph=upper, glyph_alt=lower, tts=letter_tts(name))
        for i, (upper, lower, name) in enumerate(_LETTERS, start=1)
    ]


def build_deck(track: Track) -> Deck:
    """Build the full deck (items + looping tiers) for a track.

    Raises ValueError for an unknown track — no silent default.
    """
    if track == "numbers":
        items = _number_items()
        tiers = [
            Tier(level=lvl, tokens=[f"n{n}" for n in range(1, ceil + 1)])
            for lvl, ceil in enumerate(_NUMBER_TIER_MAX, start=1)
        ]
    elif track == "letters":
        items = _letter_items()
        tiers = [
            Tier(level=lvl, tokens=[f"l{i:02d}" for i in range(1, ceil + 1)])
            for lvl, ceil in enumerate(_LETTER_TIER_MAX, start=1)
        ]
    else:
        raise ValueError(f"build_deck: unknown track {track!r}")
    return Deck(track=track, items=items, tiers=tiers)
