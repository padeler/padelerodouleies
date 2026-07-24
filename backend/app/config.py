"""Central runtime configuration derived from environment variables.

Kept deliberately tiny and dependency-free: a handful of pure helpers read the
process environment on each call so tests can monkey-patch ``os.environ`` without
re-importing. The security posture (fail-explicit secret, secure cookies, HSTS,
hidden OpenAPI) is gated on ``APP_ENV=production``.
"""

import os

_DEV_SESSION_SECRET = "padelerodouleies-dev-secret"


def app_env() -> str:
    """The deployment environment: ``development`` (default) or ``production``."""
    return os.getenv("APP_ENV", "development").strip().lower()


def is_production() -> bool:
    return app_env() == "production"


def _flag(name: str, default: bool) -> bool:
    """Read a boolean env flag (``1/true/yes/on`` → True), defaulting per-caller."""
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def session_secret() -> str:
    """The key that signs session cookies.

    In production a strong, explicit ``SESSION_SECRET`` is mandatory: an unset or
    dev-default value would let anyone forge admin session cookies, so we fail
    fast instead of falling back silently. In development the dev default is fine.
    """
    secret = os.getenv("SESSION_SECRET", "").strip()
    if is_production():
        if not secret or secret == _DEV_SESSION_SECRET:
            raise RuntimeError(
                "SESSION_SECRET must be set to a strong, unique value in production "
                "(unset or the dev default is refused). Generate one with "
                "`python -c 'import secrets; print(secrets.token_urlsafe(64))'`."
            )
        return secret
    return secret or _DEV_SESSION_SECRET


def cookie_secure() -> bool:
    """Whether the session cookie carries the ``Secure`` flag.

    Defaults to on in production (cookie only sent over HTTPS). Overridable via
    ``SESSION_COOKIE_SECURE`` for edge cases (e.g. TLS terminated elsewhere).
    """
    return _flag("SESSION_COOKIE_SECURE", default=is_production())


def hsts_enabled() -> bool:
    """Emit ``Strict-Transport-Security`` (only meaningful once served over TLS)."""
    return _flag("ENABLE_HSTS", default=is_production())


def expose_openapi() -> bool:
    """Whether the raw OpenAPI schema is served. Off in production by default."""
    return _flag("EXPOSE_OPENAPI", default=not is_production())


def trust_proxy() -> bool:
    """Whether to trust ``X-Forwarded-For`` for the client IP (rate limiting).

    Enable only behind a reverse proxy that overwrites the header with the real
    client IP; otherwise clients could spoof it to evade per-IP limits.
    """
    return _flag("TRUST_PROXY", default=False)
