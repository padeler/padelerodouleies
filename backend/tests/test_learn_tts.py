"""Tests for the Learning Adventure TTS pre-recording (cache-warming) service."""

from pathlib import Path

from app.services import learn_decks, learn_tts, tts


def test_iter_collects_every_deck_word() -> None:
    texts = set(learn_tts.iter_deck_tts_texts())
    # Carrier phrases (not bare glyphs, not isolated words) — short words clip in
    # Piper (rhasspy/piper#252), so each name/word is wrapped for context.
    assert "Αριθμός πέντε." in texts
    assert "Αριθμός εκατό." in texts
    assert "Γράμμα άλφα." in texts
    assert "Γράμμα ωμέγα." in texts
    # Neither the glyph nor the bare word is ever synthesized on its own.
    assert "5" not in texts
    assert "Α" not in texts
    assert "πέντε" not in texts
    assert "άλφα" not in texts


def test_iter_deduplicates() -> None:
    texts = learn_tts.iter_deck_tts_texts()
    assert len(texts) == len(set(texts))
    # Every track's every word is represented (deduped union of both decks).
    expected = {
        item.tts.strip()
        for track in learn_decks.TRACKS
        for item in learn_decks.build_deck(track).items
    }
    assert set(texts) == expected


def test_iter_intro_texts_collects_level_intros() -> None:
    texts = set(learn_tts.iter_intro_texts())
    # One spoken sentence per level type (full sentences, not bare words).
    assert texts == {s.strip() for s in learn_decks.LEVEL_INTROS.values()}


def test_iter_all_texts_is_union_of_words_and_intros() -> None:
    all_texts = set(learn_tts.iter_all_texts())
    assert all_texts == set(learn_tts.iter_deck_tts_texts()) | set(learn_tts.iter_intro_texts())
    # Intro sentences are warmed alongside the deck words.
    assert any("Μέτρησε" in s for s in all_texts)


def test_warm_all_synthesizes_every_word(monkeypatch, tmp_path) -> None:
    calls: list[str] = []

    def fake_get_or_synthesize(text: str) -> Path:
        calls.append(text)
        out = tmp_path / f"{len(calls)}.mp3"
        out.write_bytes(b"id3-stub")
        return out

    monkeypatch.setattr(tts, "get_or_synthesize", fake_get_or_synthesize)

    result = learn_tts.warm_all()
    expected = learn_tts.iter_all_texts()  # deck words + level intros
    assert result["total"] == len(expected)
    assert result["synthesized"] == len(expected)
    assert set(calls) == set(expected)


def test_warm_all_aborts_when_toolchain_unavailable(monkeypatch) -> None:
    def boom(text: str) -> Path:
        raise tts.TTSUnavailableError("piper missing")

    monkeypatch.setattr(tts, "get_or_synthesize", boom)

    # Must not raise — fails explicitly inside but returns cleanly with 0 cached.
    result = learn_tts.warm_all()
    assert result["synthesized"] == 0
    assert result["total"] > 0
