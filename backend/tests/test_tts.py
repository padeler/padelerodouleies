"""Tests for the TTS service and audio endpoint.

Synthesis is patched at the single ``tts._synthesize`` seam so the suite needs
no Piper/ffmpeg binaries — the fake just writes a tiny placeholder MP3.
"""

from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from httpx import Cookies

from app.api.tts import _text_for
from app.db.engine import LocalSession
from app.db.models import Chore, Reward, User
from app.main import app
from app.security.pins import hash_pin
from app.services import tts

# Captured at import time, before the autouse fixture patches the seam.
_REAL_SYNTHESIZE = tts._synthesize


def _fake_synth(text: str, voice: Path, out_path: Path) -> None:
    """Stand-in synthesizer: writes a placeholder file at the cache path."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(b"ID3-fake-mp3")


@pytest.fixture(autouse=True)
def _tts_cache_in_tmp(tmp_path, monkeypatch):
    """Redirect the cache dir to a temp dir and stub out real synthesis."""
    monkeypatch.setattr(tts, "TTS_DIR", tmp_path / "tts")
    monkeypatch.setattr(tts, "_synthesize", _fake_synth)


def test_detect_language():
    assert tts.detect_language("Βούρτσισμα δόντια") == "el"
    assert tts.detect_language("Brush your teeth") == "en"
    # Mixed text with any Greek letter reads with the Greek voice.
    assert tts.detect_language("Level Α") == "el"


def test_voice_for_language():
    assert tts.voice_for_language("el") == tts.VOICE_EL
    assert tts.voice_for_language("en") == tts.VOICE_EN


def test_text_for_sentence_boundary():
    """Title and description become separate sentences so Piper pauses between
    them — even when the admin typed a lowercase description (a bare ". " before
    a lowercase word is not treated as a sentence end by the phonemizer)."""
    chore = Chore(title="Βούρτσισμα", description="δόντια")
    # Description capitalized + each part terminated, so the phonemizer pauses.
    assert _text_for(chore) == "Βούρτσισμα. Δόντια."

    # Existing terminal punctuation is preserved, not doubled.
    assert _text_for(Chore(title="Έτοιμος;", description="Πάμε!")) == "Έτοιμος; Πάμε!"

    # No description → a single terminated sentence.
    assert _text_for(Chore(title="Καθάρισμα", description=None)) == "Καθάρισμα."


def test_empty_text_raises():
    with pytest.raises(ValueError):
        tts.get_or_synthesize("   ")


def test_cache_hit_skips_synthesis(monkeypatch):
    calls = {"n": 0}

    def counting_synth(text: str, voice: Path, out_path: Path) -> None:
        calls["n"] += 1
        _fake_synth(text, voice, out_path)

    monkeypatch.setattr(tts, "_synthesize", counting_synth)

    first = tts.get_or_synthesize("Καθάρισε το δωμάτιο")
    second = tts.get_or_synthesize("Καθάρισε το δωμάτιο")
    assert first == second
    assert first.exists()
    assert calls["n"] == 1  # second call served from cache


def test_different_text_different_file():
    a = tts.get_or_synthesize("Πλύσε τα πιάτα")
    b = tts.get_or_synthesize("Wash the dishes")
    assert a != b


def test_synthesize_raises_when_toolchain_missing(monkeypatch, tmp_path):
    """Without Piper/ffmpeg the real synth fails explicitly (no silent fallback)."""
    monkeypatch.setattr(tts.shutil, "which", lambda _name: None)
    with pytest.raises(tts.TTSUnavailableError):
        _REAL_SYNTHESIZE("hello", tts.VOICE_EN, tmp_path / "x.mp3")


# --- Endpoint tests --------------------------------------------------------


async def _kid_client():
    db = LocalSession()
    user = User(name="TTSKid", role="user", avatar_value="fox",
                pin_hash=hash_pin("1234"), current_stars=0)
    db.add(user)
    db.commit()
    uid = user.id
    db.close()
    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://testserver", cookies=Cookies())
    resp = await client.post("/api/auth/login", json={"user_id": uid, "pin": "1234"})
    assert resp.status_code == 200
    return client


async def test_chore_tts_endpoint():
    db = LocalSession()
    chore = Chore(title="Βούρτσισμα", description="δόντια", icon_name="tooth",
                  claim_mode="each", points_value=5, is_repeating=True, is_active=True)
    db.add(chore)
    db.commit()
    cid = chore.id
    db.close()

    client = await _kid_client()
    try:
        resp = await client.get(f"/api/tts/chore/{cid}.mp3")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "audio/mpeg"
        assert resp.content == b"ID3-fake-mp3"
    finally:
        await client.aclose()


async def test_reward_tts_endpoint():
    db = LocalSession()
    reward = Reward(title="Ice cream", icon_name="gift", cost_stars=10, is_enabled=True)
    db.add(reward)
    db.commit()
    rid = reward.id
    db.close()

    client = await _kid_client()
    try:
        resp = await client.get(f"/api/tts/reward/{rid}.mp3")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "audio/mpeg"
    finally:
        await client.aclose()


async def test_tts_unknown_kind_404():
    client = await _kid_client()
    try:
        resp = await client.get("/api/tts/widget/1.mp3")
        assert resp.status_code == 404
    finally:
        await client.aclose()


async def test_tts_missing_item_404():
    client = await _kid_client()
    try:
        resp = await client.get("/api/tts/chore/999999.mp3")
        assert resp.status_code == 404
    finally:
        await client.aclose()


async def test_tts_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.get("/api/tts/chore/1.mp3")
        assert resp.status_code == 401


async def test_tts_unavailable_returns_503(monkeypatch):
    db = LocalSession()
    chore = Chore(title="Test", icon_name="tooth", claim_mode="each",
                  points_value=1, is_repeating=True, is_active=True)
    db.add(chore)
    db.commit()
    cid = chore.id
    db.close()

    def boom(text, voice, out_path):
        raise tts.TTSUnavailableError("no piper")

    monkeypatch.setattr(tts, "_synthesize", boom)

    client = await _kid_client()
    try:
        resp = await client.get(f"/api/tts/chore/{cid}.mp3")
        assert resp.status_code == 503
    finally:
        await client.aclose()
