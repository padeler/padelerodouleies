"""Tests for the exercise TTS pre-recording (cache-warming) service."""

from pathlib import Path

import pytest

from app.services import exercise_bundles, exercise_tts, tts

FIXTURES = Path(__file__).parent / "fixtures" / "exercises"


@pytest.fixture
def exercises_dir(monkeypatch):
    """Point discovery at the test fixtures dir (letters-A + math-times)."""
    monkeypatch.setattr(exercise_bundles, "EXERCISES_DIR", FIXTURES)
    exercise_bundles.clear_cache()
    yield FIXTURES
    exercise_bundles.clear_cache()


def test_iter_collects_titles_prompts_hints_and_options(exercises_dir) -> None:
    texts = set(exercise_tts.iter_bundle_tts_texts())
    # Titles
    assert "Το γράμμα Α" in texts
    assert "Πολλαπλασιασμός" in texts
    # Prompt + the prompt_tts override (not the visible prompt) is used
    assert "δύο επί τρία, συν τέσσερα" in texts
    assert "2 * 3 + 4 = ?" not in texts  # overridden by prompt_tts
    assert "5 * 5 = ?" in texts  # no override → visible prompt
    # Hints and option labels
    assert "Α όπως... αρκούδα!" in texts
    assert "μήλο" in texts
    assert "γάτα" in texts


def test_iter_deduplicates(exercises_dir) -> None:
    texts = exercise_tts.iter_bundle_tts_texts()
    assert len(texts) == len(set(texts))


def test_warm_all_synthesizes_every_string(exercises_dir, monkeypatch, tmp_path) -> None:
    calls: list[str] = []

    def fake_get_or_synthesize(text: str) -> Path:
        calls.append(text)
        out = tmp_path / f"{len(calls)}.mp3"
        out.write_bytes(b"id3-stub")
        return out

    monkeypatch.setattr(tts, "get_or_synthesize", fake_get_or_synthesize)

    result = exercise_tts.warm_all()
    expected = exercise_tts.iter_bundle_tts_texts()
    assert result["total"] == len(expected)
    assert result["synthesized"] == len(expected)
    assert set(calls) == set(expected)


def test_warm_all_aborts_when_toolchain_unavailable(exercises_dir, monkeypatch) -> None:
    def boom(text: str) -> Path:
        raise tts.TTSUnavailableError("piper missing")

    monkeypatch.setattr(tts, "get_or_synthesize", boom)

    # Must not raise — fails explicitly inside but returns cleanly with 0 cached.
    result = exercise_tts.warm_all()
    assert result["synthesized"] == 0
    assert result["total"] > 0
