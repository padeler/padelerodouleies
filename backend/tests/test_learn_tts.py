"""Tests for the Learning Adventure TTS pre-recording (cache-warming) service."""

from pathlib import Path

from app.services import learn_decks, learn_tts, tts


def test_iter_collects_every_deck_word() -> None:
    texts = set(learn_tts.iter_deck_tts_texts())
    # The bare spoken word — the TTS service carrier-wraps lone words itself.
    assert "πέντε" in texts
    assert "εκατό" in texts
    assert "άλφα" in texts
    assert "ωμέγα" in texts
    # The glyph is never synthesized on its own.
    assert "5" not in texts
    assert "Α" not in texts


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


def test_iter_find_texts_collects_find_prompts() -> None:
    texts = set(learn_tts.iter_find_texts())
    # One "find X" prompt per deck token, both tracks (full carrier sentences).
    assert "Βρες τον αριθμό πέντε." in texts
    assert "Βρες το γράμμα άλφα." in texts
    assert len(texts) == sum(
        len(learn_decks.build_deck(track).items) for track in learn_decks.TRACKS
    )


def test_iter_find_all_texts_collects_multi_target_prompts() -> None:
    texts = set(learn_tts.iter_find_all_texts())
    # One "find them all" prompt per deck token, both tracks.
    assert "Βρες όλα τα πέντε!" in texts
    assert "Βρες όλα τα άλφα!" in texts
    assert len(texts) == sum(
        len(learn_decks.build_deck(track).items) for track in learn_decks.TRACKS
    )


def test_iter_find_starts_with_texts_collects_starts_with_prompts() -> None:
    texts = set(learn_tts.iter_find_starts_with_texts())
    # One prompt per letter token (letters only — the variant never applies to numbers).
    assert "Βρες κάτι που αρχίζει από το γράμμα άλφα." in texts
    assert len(texts) == len(learn_decks.build_deck("letters").items)


def test_iter_all_texts_is_union_of_warmed_strings() -> None:
    all_texts = set(learn_tts.iter_all_texts())
    expected = (
        set(learn_tts.iter_deck_tts_texts())
        | set(learn_tts.iter_intro_texts())
        | set(learn_tts.iter_find_texts())
        | set(learn_tts.iter_find_all_texts())
        | set(learn_tts.iter_find_starts_with_texts())
        | set(learn_tts.iter_word_texts())
        | {learn_decks.SUCCESS_PHRASE}
    )
    assert all_texts == expected
    # Intro sentences, find prompts, icon-tile vocab words and the praise
    # phrase are all warmed too.
    assert any("Μέτρησε" in s for s in all_texts)
    assert any("Βρες" in s for s in all_texts)
    assert "Βρες κάτι που αρχίζει από το γράμμα άλφα." in all_texts
    assert "γάτα" in all_texts  # icon-tile vocabulary word
    assert learn_decks.SUCCESS_PHRASE in all_texts


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
