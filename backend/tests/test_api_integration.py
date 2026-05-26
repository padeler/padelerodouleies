"""Integration tests for API endpoints."""

import pytest


@pytest.mark.asyncio
async def test_i18n_translations_endpoint(async_client):  # type: ignore
    response = await async_client.get("/api/i18n/translations")
    assert response.status_code == 200
    data = response.json()
    assert "login.welcome" in data
    assert data["login.welcome"]["el"] == "Καλωσήρθες"


@pytest.mark.asyncio
async def test_bootstrap_status_endpoint(async_client):  # type: ignore
    response = await async_client.get("/api/bootstrap/status")
    assert response.status_code == 200
    data = response.json()
    assert "first_run" in data
    assert isinstance(data["first_run"], bool)


@pytest.mark.asyncio
async def test_icons_catalog_endpoint(async_client):  # type: ignore
    response = await async_client.get("/api/icons/catalog")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0


@pytest.mark.asyncio
async def test_icons_svg_endpoint(async_client):  # type: ignore
    response = await async_client.get("/api/icons/svg/star")
    assert response.status_code == 200
    assert "svg" in response.headers["content-type"]


@pytest.mark.asyncio
async def test_icons_svg_404(async_client):  # type: ignore
    response = await async_client.get("/api/icons/svg/nonexistent")
    assert response.status_code == 404
