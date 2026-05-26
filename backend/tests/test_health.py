"""Basic health endpoint test."""

import pytest


@pytest.mark.asyncio
async def test_health_endpoint(async_client):  # type: ignore[name-defined]
    response = await async_client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
