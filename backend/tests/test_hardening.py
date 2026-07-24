"""Tests for the internet-exposure hardening (C1, C2, C3, H2, H3, H4, H5)."""

import io
import zipfile

import pytest
from httpx import AsyncClient

from app import config
from app.security import lockout
from app.security.ratelimit import rate_limit, reset
from app.services.avatars import _reject_dangerous_svg
from app.services.exercise_bundles import (
    MAX_ZIP_MEMBERS,
    BundleUploadError,
    extract_bundles_zip,
)


# --- C1: session secret is fail-explicit in production ---------------------

def test_session_secret_required_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("SESSION_SECRET", raising=False)
    with pytest.raises(RuntimeError):
        config.session_secret()


def test_session_secret_rejects_dev_default_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SESSION_SECRET", config._DEV_SESSION_SECRET)
    with pytest.raises(RuntimeError):
        config.session_secret()


def test_session_secret_accepts_strong_value_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SESSION_SECRET", "a-very-strong-unique-secret")
    assert config.session_secret() == "a-very-strong-unique-secret"


def test_dev_falls_back_without_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("SESSION_SECRET", raising=False)
    assert config.session_secret() == config._DEV_SESSION_SECRET


# --- C3: secure cookie + config flags --------------------------------------

def test_cookie_secure_defaults_on_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("SESSION_COOKIE_SECURE", raising=False)
    assert config.cookie_secure() is True


def test_cookie_secure_off_in_development(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("SESSION_COOKIE_SECURE", raising=False)
    assert config.cookie_secure() is False


def test_expose_openapi_off_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("EXPOSE_OPENAPI", raising=False)
    assert config.expose_openapi() is False


# --- C2: escalating lockout ------------------------------------------------

def test_lockout_escalates() -> None:
    first = lockout._lockout_seconds(lockout.MAX_ATTEMPTS)
    second = lockout._lockout_seconds(lockout.MAX_ATTEMPTS + 1)
    third = lockout._lockout_seconds(lockout.MAX_ATTEMPTS + 2)
    assert first == lockout.LOCKOUT_SECONDS
    assert second > first
    assert third > second


def test_lockout_capped() -> None:
    huge = lockout._lockout_seconds(lockout.MAX_ATTEMPTS + 50)
    assert huge == lockout.MAX_LOCKOUT_SECONDS


# --- C2: per-IP rate limiting ----------------------------------------------

async def test_login_rate_limited(async_client: AsyncClient) -> None:
    """The 21st login attempt from one IP within the window is throttled (429)."""
    reset()
    statuses = []
    for _ in range(21):
        resp = await async_client.post(
            "/api/auth/login", json={"user_id": 999999, "pin": "0000"}
        )
        statuses.append(resp.status_code)
    assert statuses[-1] == 429
    assert all(s != 429 for s in statuses[:20])


def test_rate_limit_dependency_blocks_after_max() -> None:
    """The limiter dependency raises 429 once the window budget is spent."""
    from fastapi import HTTPException, Request

    reset()
    dep = rate_limit(max_requests=2, window_seconds=60, scope="unit")
    scope = {"type": "http", "headers": [], "client": ("1.2.3.4", 1234)}
    request = Request(scope)  # type: ignore[arg-type]
    dep(request)
    dep(request)
    with pytest.raises(HTTPException) as exc:
        dep(request)
    assert exc.value.status_code == 429


# --- H3: dangerous SVG rejection -------------------------------------------

def test_reject_svg_with_script() -> None:
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    with pytest.raises(ValueError):
        _reject_dangerous_svg(svg)


def test_reject_svg_with_event_handler() -> None:
    svg = b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'
    with pytest.raises(ValueError):
        _reject_dangerous_svg(svg)


def test_clean_svg_passes() -> None:
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4"/></svg>'
    _reject_dangerous_svg(svg)  # does not raise


# --- H2: zip upload limits -------------------------------------------------

def _zip_with(members: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, data in members.items():
            zf.writestr(name, data)
    return buf.getvalue()


def test_zip_too_many_members_rejected(tmp_path) -> None:
    data = _zip_with({f"b/f{i}.txt": b"x" for i in range(MAX_ZIP_MEMBERS + 1)})
    with pytest.raises(BundleUploadError):
        extract_bundles_zip(data, root=tmp_path)


def test_zip_bomb_rejected(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.exercise_bundles.MAX_ZIP_UNCOMPRESSED_BYTES", 10
    )
    data = _zip_with({"b/big.txt": b"x" * 1000})
    with pytest.raises(BundleUploadError):
        extract_bundles_zip(data, root=tmp_path)


def test_zip_slip_still_rejected(tmp_path) -> None:
    data = _zip_with({"../escape.txt": b"x"})
    with pytest.raises(BundleUploadError):
        extract_bundles_zip(data, root=tmp_path)


def test_valid_zip_extracts(tmp_path) -> None:
    data = _zip_with({"bundle/manifest.json": b"{}"})
    extracted = extract_bundles_zip(data, root=tmp_path)
    assert "bundle/manifest.json" in extracted
    assert (tmp_path / "bundle" / "manifest.json").is_file()


# --- H5: security headers --------------------------------------------------

async def test_security_headers_present(async_client: AsyncClient) -> None:
    resp = await async_client.get("/api/health")
    assert "default-src 'self'" in resp.headers["content-security-policy"]
    assert resp.headers["x-frame-options"] == "DENY"
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert resp.headers["referrer-policy"] == "no-referrer"


async def test_user_content_csp_locked_down(async_client: AsyncClient) -> None:
    """User-content paths get the restrictive default-src 'none' CSP."""
    resp = await async_client.get("/chore-images/nonexistent.svg")
    assert "default-src 'none'" in resp.headers["content-security-policy"]
