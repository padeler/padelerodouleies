"""Tests for the Learning Adventure decks + Greek phonetics (M1).

The number-word fixture below is hand-checked: it spells out every irregular
word (1–20, the whole tens, 100) plus a spread of compounds so a typo in the
table or the composition rule can't ship silently. Pronunciation correctness is
the whole point of this module — Piper is fed these words, never bare glyphs.
"""

import pytest

from app.services.learn_decks import (
    LEVEL_INTROS,
    LETTER_COUNT,
    TRACKS,
    build_deck,
    greek_number_word,
    intro_text,
    letter_tts,
    number_tts,
)

# Hand-checked Greek neuter counting words. Covers all irregular forms (1–20),
# every whole ten (20–100) and representative compounds across the range.
_HAND_CHECKED: dict[int, str] = {
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
    13: "δεκατρία",
    14: "δεκατέσσερα",
    15: "δεκαπέντε",
    16: "δεκαέξι",
    17: "δεκαεπτά",
    18: "δεκαοκτώ",
    19: "δεκαεννέα",
    20: "είκοσι",
    21: "είκοσι ένα",
    27: "είκοσι επτά",
    30: "τριάντα",
    34: "τριάντα τέσσερα",
    40: "σαράντα",
    49: "σαράντα εννέα",
    50: "πενήντα",
    55: "πενήντα πέντε",
    60: "εξήντα",
    63: "εξήντα τρία",
    70: "εβδομήντα",
    78: "εβδομήντα οκτώ",
    80: "ογδόντα",
    86: "ογδόντα έξι",
    90: "ενενήντα",
    91: "ενενήντα ένα",
    99: "ενενήντα εννέα",
    100: "εκατό",
}


@pytest.mark.parametrize("n,word", sorted(_HAND_CHECKED.items()))
def test_greek_number_word_hand_checked(n: int, word: str):
    assert greek_number_word(n) == word


def test_greek_number_word_full_range_is_nonempty_greek():
    # Every 1..100 produces a non-empty, lowercase-Greek word (no leftover
    # digits, no stray ASCII).
    for n in range(1, 101):
        w = greek_number_word(n)
        assert w and not any(ch.isdigit() or ch.isascii() and ch.isalpha() for ch in w)


@pytest.mark.parametrize("n", [0, -1, 101, 1000])
def test_greek_number_word_out_of_range_raises(n: int):
    with pytest.raises(ValueError):
        greek_number_word(n)


def test_number_deck_shape():
    deck = build_deck("numbers")
    assert deck.track == "numbers"
    assert len(deck.items) == 100
    # tokens unique, ascending value, no lowercase alt, Greek tts present.
    assert [it.token for it in deck.items[:3]] == ["n1", "n2", "n3"]
    assert deck.items[4].glyph == "5"
    assert deck.items[4].glyph_alt is None
    # tts is a carrier phrase (short isolated words clip in Piper, #252).
    assert deck.items[4].tts == "Αριθμός πέντε."
    assert len({it.token for it in deck.items}) == 100
    # Four looping tiers with the documented ceilings.
    assert [t.level for t in deck.tiers] == [1, 2, 3, 4]
    assert [len(t.tokens) for t in deck.tiers] == [10, 20, 50, 100]
    assert deck.tiers[0].tokens[-1] == "n10"


def test_letter_deck_shape():
    deck = build_deck("letters")
    assert deck.track == "letters"
    assert len(deck.items) == LETTER_COUNT == 24
    first = deck.items[0]
    assert (first.token, first.glyph, first.glyph_alt, first.tts) == ("l01", "Α", "α", "Γράμμα άλφα.")
    last = deck.items[-1]
    assert (last.token, last.glyph, last.glyph_alt, last.tts) == ("l24", "Ω", "ω", "Γράμμα ωμέγα.")
    # Every letter carries both cases and a spoken name.
    assert all(it.glyph_alt is not None and it.tts for it in deck.items)
    assert len({it.token for it in deck.items}) == 24
    assert [len(t.tokens) for t in deck.tiers] == [9, 13, 18, 24]
    assert deck.tiers[0].tokens[-1] == "l09"


def test_letter_names_all_distinct():
    deck = build_deck("letters")
    names = [it.tts for it in deck.items]
    assert len(set(names)) == 24


def test_build_deck_unknown_track_raises():
    with pytest.raises(ValueError):
        build_deck("shapes")  # type: ignore[arg-type]


def test_tracks_constant():
    assert set(TRACKS) == {"numbers", "letters"}


def test_level_intros_cover_every_level_type():
    # One spoken intro sentence per frontend LevelType, all non-empty Greek text.
    assert set(LEVEL_INTROS) == {"count", "match", "hear", "order", "whats_next"}
    assert all(text.strip() for text in LEVEL_INTROS.values())


def test_intro_text_returns_sentence_and_rejects_unknown():
    assert intro_text("hear") == LEVEL_INTROS["hear"]
    with pytest.raises(ValueError):
        intro_text("bogus")


def test_carrier_phrases_wrap_name_and_word():
    # Short isolated words clip/mangle in Piper (rhasspy/piper#252) — the spoken
    # string is a two-word carrier with a declarative period, never a lone word.
    assert letter_tts("άλφα") == "Γράμμα άλφα."
    assert number_tts("πέντε") == "Αριθμός πέντε."
    # Every deck item's tts is a carrier phrase (multi-word, ends with a period).
    for track in TRACKS:
        for item in build_deck(track).items:
            assert " " in item.tts and item.tts.endswith(".")
