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
    # A carrier phrase (not the glyph, not a bare word) is what gets synthesized —
    # isolated short words clip/mangle in Piper (rhasspy/piper#252).
    assert captured == [learn_decks.number_tts("πέντε")]
    assert captured == ["Αριθμός πέντε."]


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


async def test_level_intro_503_when_unavailable(kid_client, monkeypatch):
    def boom(text: str) -> Path:
        raise tts.TTSUnavailableError("piper missing")

    monkeypatch.setattr(tts, "get_or_synthesize", boom)
    assert (await kid_client.get("/api/games/learn/say/order.mp3")).status_code == 503


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
