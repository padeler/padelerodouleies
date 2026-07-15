"""Tests for the Learning Adventure API (deck listing + token TTS) and score keys."""

from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient, Cookies

from app.db.engine import LocalSession
from app.db.models import User
from app.main import app
from app.security.pins import hash_pin
from app.services import learn_decks, tts
from app.services.games import GAME_SCORE_DIRECTIONS, submit_score


@pytest.fixture
async def kid_client():
    db = LocalSession()
    user = User(name="LearnKid", role="user", pin_hash=hash_pin("1234"))
    db.add(user)
    db.commit()
    uid = user.id
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://testserver", cookies=Cookies()
    ) as c:
        resp = await c.post("/api/auth/login", json={"user_id": uid, "pin": "1234"})
        assert resp.status_code == 200
        yield c


async def test_deck_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        assert (await c.get("/api/games/learn/numbers")).status_code == 401
        assert (await c.get("/api/games/learn/numbers/tts/n5.mp3")).status_code == 401


async def test_numbers_deck_shape_and_no_tts_leak(kid_client):
    resp = await kid_client.get("/api/games/learn/numbers")
    assert resp.status_code == 200
    body = resp.json()
    assert body["track"] == "numbers"
    assert len(body["items"]) == 100
    first = body["items"][0]
    # The Piper input word must never reach the client.
    assert "tts" not in first
    assert first["token"] == "n1"
    assert first["glyph"] == "1"
    assert first["glyph_alt"] is None
    assert first["audio_url"] == "/api/games/learn/numbers/tts/n1.mp3"
    assert [len(t["tokens"]) for t in body["tiers"]] == [10, 20, 50, 100]


async def test_letters_deck_carries_both_cases(kid_client):
    resp = await kid_client.get("/api/games/learn/letters")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) == 24
    first = body["items"][0]
    assert (first["token"], first["glyph"], first["glyph_alt"]) == ("l01", "Α", "α")
    assert "tts" not in first


async def test_unknown_track_404(kid_client):
    assert (await kid_client.get("/api/games/learn/shapes")).status_code == 404
    assert (await kid_client.get("/api/games/learn/shapes/tts/x.mp3")).status_code == 404


async def test_token_tts_served_from_cache(kid_client, monkeypatch, tmp_path):
    captured: list[str] = []

    def fake_synth(text: str) -> Path:
        captured.append(text)
        out = tmp_path / "clip.mp3"
        out.write_bytes(b"id3-stub")
        return out

    monkeypatch.setattr(tts, "get_or_synthesize", fake_synth)

    resp = await kid_client.get("/api/games/learn/numbers/tts/n5.mp3")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/mpeg"
    # The bare spoken word is what gets synthesized; the TTS service carrier-wraps
    # lone words itself (and trims the carrier back off) for clean Piper output.
    assert captured == ["πέντε"]


async def test_unknown_token_404(kid_client):
    assert (await kid_client.get("/api/games/learn/numbers/tts/n999.mp3")).status_code == 404


async def test_token_tts_503_when_unavailable(kid_client, monkeypatch):
    def boom(text: str) -> Path:
        raise tts.TTSUnavailableError("piper missing")

    monkeypatch.setattr(tts, "get_or_synthesize", boom)
    resp = await kid_client.get("/api/games/learn/letters/tts/l01.mp3")
    assert resp.status_code == 503


async def test_level_intro_tts_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        assert (await c.get("/api/games/learn/say/hear.mp3")).status_code == 401


async def test_level_intro_tts_synthesizes_the_sentence(kid_client, monkeypatch, tmp_path):
    captured: list[str] = []

    def fake_synth(text: str) -> Path:
        captured.append(text)
        out = tmp_path / "intro.mp3"
        out.write_bytes(b"id3-stub")
        return out

    monkeypatch.setattr(tts, "get_or_synthesize", fake_synth)

    resp = await kid_client.get("/api/games/learn/say/hear.mp3")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/mpeg"
    # The full spoken sentence (not a bare word) is what gets synthesized.
    assert captured == [learn_decks.LEVEL_INTROS["hear"]]


async def test_unknown_level_intro_404(kid_client):
    assert (await kid_client.get("/api/games/learn/say/bogus.mp3")).status_code == 404


async def test_card_tts_synthesizes_title_and_description(kid_client, monkeypatch, tmp_path):
    captured: list[str] = []

    def fake_synth(text: str) -> Path:
        captured.append(text)
        out = tmp_path / "card.mp3"
        out.write_bytes(b"id3-stub")
        return out

    monkeypatch.setattr(tts, "get_or_synthesize", fake_synth)

    resp = await kid_client.get("/api/games/learn/card/count.mp3")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/mpeg"
    # The spoken card is the mini-game title, then its short description.
    assert captured == [learn_decks.card_tts("count")]


async def test_unknown_card_level_404(kid_client):
    assert (await kid_client.get("/api/games/learn/card/bogus.mp3")).status_code == 404


async def test_card_tts_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        assert (await c.get("/api/games/learn/card/hear.mp3")).status_code == 401


async def test_level_intro_503_when_unavailable(kid_client, monkeypatch):
    def boom(text: str) -> Path:
        raise tts.TTSUnavailableError("piper missing")

    monkeypatch.setattr(tts, "get_or_synthesize", boom)
    assert (await kid_client.get("/api/games/learn/say/order.mp3")).status_code == 503


async def test_find_prompt_synthesizes_carrier_sentence(kid_client, monkeypatch, tmp_path):
    captured: list[str] = []

    def fake_synth(text: str) -> Path:
        captured.append(text)
        out = tmp_path / "find.mp3"
        out.write_bytes(b"id3-stub")
        return out

    monkeypatch.setattr(tts, "get_or_synthesize", fake_synth)
    resp = await kid_client.get("/api/games/learn/numbers/find/n8.mp3")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/mpeg"
    assert captured == ["Βρες τον αριθμό οκτώ."]


async def test_find_prompt_unknown_token_404(kid_client):
    assert (await kid_client.get("/api/games/learn/numbers/find/n999.mp3")).status_code == 404


async def test_find_all_prompt_cues_multiple_targets(kid_client, monkeypatch, tmp_path):
    captured: list[str] = []

    def fake_synth(text: str) -> Path:
        captured.append(text)
        out = tmp_path / "find-all.mp3"
        out.write_bytes(b"id3-stub")
        return out

    monkeypatch.setattr(tts, "get_or_synthesize", fake_synth)
    resp = await kid_client.get("/api/games/learn/numbers/find-all/n5.mp3")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/mpeg"
    assert captured == ["Βρες όλα τα πέντε!"]


async def test_find_all_prompt_unknown_token_404(kid_client):
    assert (await kid_client.get("/api/games/learn/letters/find-all/l999.mp3")).status_code == 404


async def test_find_starts_with_prompt_asks_for_an_object(kid_client, monkeypatch, tmp_path):
    captured: list[str] = []

    def fake_synth(text: str) -> Path:
        captured.append(text)
        out = tmp_path / "find-starts-with.mp3"
        out.write_bytes(b"id3-stub")
        return out

    monkeypatch.setattr(tts, "get_or_synthesize", fake_synth)
    resp = await kid_client.get("/api/games/learn/letters/find-starts-with/l01.mp3")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/mpeg"
    assert captured == ["Βρες κάτι που αρχίζει από το γράμμα άλφα."]


async def test_find_starts_with_prompt_unknown_token_404(kid_client):
    assert (
        await kid_client.get("/api/games/learn/letters/find-starts-with/l999.mp3")
    ).status_code == 404


async def test_success_phrase(kid_client, monkeypatch, tmp_path):
    captured: list[str] = []

    def fake_synth(text: str) -> Path:
        captured.append(text)
        out = tmp_path / "ok.mp3"
        out.write_bytes(b"id3-stub")
        return out

    monkeypatch.setattr(tts, "get_or_synthesize", fake_synth)
    resp = await kid_client.get("/api/games/learn/feedback/success.mp3")
    assert resp.status_code == 200
    assert captured == [learn_decks.SUCCESS_PHRASE]


async def test_wrong_explanation_with_and_without_pick(kid_client, monkeypatch, tmp_path):
    captured: list[str] = []

    def fake_synth(text: str) -> Path:
        captured.append(text)
        out = tmp_path / "wrong.mp3"
        out.write_bytes(b"id3-stub")
        return out

    monkeypatch.setattr(tts, "get_or_synthesize", fake_synth)
    # With a pick: explains both the chosen and the correct answer.
    assert (await kid_client.get("/api/games/learn/numbers/wrong/n8/n3.mp3")).status_code == 200
    assert captured[-1] == "Επέλεξες τον αριθμό τρία, έπρεπε να βρεις τον αριθμό οκτώ."
    # Sentinel _none = the kid ran out of time: only states the right answer.
    assert (await kid_client.get("/api/games/learn/letters/wrong/l01/_none.mp3")).status_code == 200
    assert captured[-1] == "Δεν πρόλαβες. Έπρεπε να βρεις το γράμμα άλφα."


async def test_wrong_explanation_unknown_token_404(kid_client):
    assert (await kid_client.get("/api/games/learn/numbers/wrong/n8/n999.mp3")).status_code == 404
    assert (await kid_client.get("/api/games/learn/numbers/wrong/n999/n3.mp3")).status_code == 404


async def test_word_tts_synthesizes_vocab_word(kid_client, monkeypatch, tmp_path):
    captured: list[str] = []

    def fake_synth(text: str) -> Path:
        captured.append(text)
        out = tmp_path / "word.mp3"
        out.write_bytes(b"id3-stub")
        return out

    monkeypatch.setattr(tts, "get_or_synthesize", fake_synth)
    resp = await kid_client.get("/api/games/learn/letters/word/l03.mp3")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/mpeg"
    assert captured == ["γάτα"]  # the vocab word, not the letter name


async def test_word_tts_unknown_token_404(kid_client):
    assert (await kid_client.get("/api/games/learn/letters/word/l99.mp3")).status_code == 404
    assert (await kid_client.get("/api/games/learn/letters/word/n5.mp3")).status_code == 404


async def test_vocab_tts_synthesizes_pool_word(kid_client, monkeypatch, tmp_path):
    """The per-entry vocab endpoint speaks the exact pool word for the id."""
    captured: list[str] = []

    def fake_synth(text: str) -> Path:
        captured.append(text)
        out = tmp_path / "vocab.mp3"
        out.write_bytes(b"id3-stub")
        return out

    monkeypatch.setattr(tts, "get_or_synthesize", fake_synth)
    resp = await kid_client.get("/api/games/learn/letters/vocab/gata.mp3")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/mpeg"
    assert captured == ["γάτα"]  # the pool entry's word for id "gata"


async def test_vocab_tts_unknown_id_404(kid_client):
    assert (await kid_client.get("/api/games/learn/letters/vocab/nope.mp3")).status_code == 404


def test_vocab_words_are_nonempty_and_cover_the_pool():
    from app.services import learn_vocab

    assert len(learn_vocab.LETTER_VOCAB_WORDS) > 100  # ≈10 per letter
    assert all(w.strip() for w in learn_vocab.LETTER_VOCAB_WORDS.values())


def test_letter_words_cover_every_letter_and_start_with_it():
    """Every deck letter has a vocab word, and each word starts with its letter.

    Accent-insensitive comparison (ή → η) since Greek vocabulary words carry
    accents the bare letters don't.
    """
    import unicodedata

    def fold(ch: str) -> str:
        return "".join(
            c for c in unicodedata.normalize("NFD", ch.lower()) if not unicodedata.combining(c)
        )

    deck = learn_decks.build_deck("letters")
    assert set(learn_decks.LETTER_WORDS) == {it.token for it in deck.items}
    for item in deck.items:
        word = learn_decks.LETTER_WORDS[item.token]
        assert fold(word[0]) == fold(item.glyph), f"{item.token}: {word} vs {item.glyph}"


def test_score_keys_registered():
    assert GAME_SCORE_DIRECTIONS["number_adventure"] == "higher"
    assert GAME_SCORE_DIRECTIONS["letter_adventure"] == "higher"


def test_score_submission_accepts_adventure_keys():
    db = LocalSession()
    try:
        kid = User(name="AdvKid", role="user", pin_hash=hash_pin("1234"))
        db.add(kid)
        db.commit()
        assert submit_score(db, kid.id, "number_adventure", 1042) == (1042, True)
        assert submit_score(db, kid.id, "number_adventure", 1001) == (1042, False)
        assert submit_score(db, kid.id, "letter_adventure", 2003) == (2003, True)
    finally:
        db.close()
