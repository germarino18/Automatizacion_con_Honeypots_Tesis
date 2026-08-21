"""Smoke tests: the FastAPI app imports, boots and answers /api/v1/health."""

import pytest
from app.main import app


@pytest.mark.asyncio
async def test_health_ok_against_test_postgres(client):
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["api"] == "ok"
    assert body["postgres"] == "ok"


@pytest.mark.asyncio
async def test_health_does_not_require_auth(client):
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_app_object_is_fastapi_instance():
    assert app.title
    assert app.version