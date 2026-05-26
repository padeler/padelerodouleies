"""Tests for the i18n translation layer."""

import pytest
from app.i18n.translations import t, pick_bilingual


def test_t_returns_translation() -> None:
    assert t("login.welcome", "el") == "Καλωσήρθες"
    assert t("login.welcome", "en") == "Welcome"


def test_t_raises_on_missing_key() -> None:
    with pytest.raises(KeyError):
        t("nonexistent.key")


def test_t_raises_on_missing_locale() -> None:
    with pytest.raises(KeyError):
        t("login.welcome", "fr")


def test_pick_bilingual_prefers_primary() -> None:
    assert pick_bilingual("Greek", "English", "el") == "Greek"
    assert pick_bilingual("Greek", "English", "en") == "English"


def test_pick_bilingual_falls_back() -> None:
    assert pick_bilingual(None, "English", "el") == "English"
    assert pick_bilingual("Greek", None, "en") == "Greek"


def test_pick_bilingual_raises_when_both_missing() -> None:
    with pytest.raises(KeyError):
        pick_bilingual(None, None, "el")
