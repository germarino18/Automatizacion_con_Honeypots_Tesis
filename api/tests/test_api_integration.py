"""Integration tests for the data routers (task 4.7).

Each endpoint: 200 with seeded data, 401 without token, and response shapes
matching the Pydantic DTOs.
"""

import pytest

from app.schemas.events import EventDetail, EventPage
from app.schemas.geo import GeoResponse
from app.schemas.health import HealthResponse, ServicesHealthResponse
from app.schemas.malware import IocPage, MalwareResponse
from app.schemas.mitre import MitreResponse
from app.schemas.overview import Overview
from tests.conftest import insert_event, insert_ioc, insert_response


@pytest.mark.asyncio
async def test_overview_with_data_and_shape(auth_client, conn):
    await insert_event(conn, source_honeypot="cowrie", src_ip="1.1.1.1", risk_score=0.9)
    await insert_event(conn, source_honeypot="dionaea", src_ip="2.2.2.2", risk_score=0.2)

    resp = await auth_client.get("/api/v1/overview")

    assert resp.status_code == 200
    body = Overview.model_validate(resp.json())
    assert body.total_eventos == 2
    assert body.ips_unicas == 2
    assert len(body.eventos_por_honeypot) == 2


@pytest.mark.asyncio
async def test_overview_empty_returns_zeros(auth_client):
    resp = await auth_client.get("/api/v1/overview")
    assert resp.status_code == 200
    body = Overview.model_validate(resp.json())
    assert body.total_eventos == 0
    assert body.top_ips == []
    assert body.alertas_criticas == []


@pytest.mark.asyncio
async def test_overview_401_without_token(client):
    resp = await client.get("/api/v1/overview")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_events_paginated_shape(auth_client, conn):
    for i in range(5):
        await insert_event(conn, src_ip=f"10.0.0.{i}")

    resp = await auth_client.get("/api/v1/events?page=1&page_size=2")

    assert resp.status_code == 200
    body = EventPage.model_validate(resp.json())
    assert body.total == 5
    assert body.page == 1
    assert body.page_size == 2
    assert len(body.items) == 2


@pytest.mark.asyncio
async def test_events_filters(auth_client, conn):
    await insert_event(conn, source_honeypot="cowrie", protocol="ssh", risk_score=0.9)
    await insert_event(conn, source_honeypot="dionaea", protocol="smb", risk_score=0.1)

    resp = await auth_client.get(
        "/api/v1/events?source_honeypot=cowrie&protocol=ssh&severity=critical"
    )

    assert resp.status_code == 200
    body = EventPage.model_validate(resp.json())
    assert body.total == 1
    assert body.items[0].source_honeypot == "cowrie"


@pytest.mark.asyncio
async def test_events_validation_422(auth_client):
    resp = await auth_client.get("/api/v1/events?page=0")
    assert resp.status_code == 422

    resp = await auth_client.get("/api/v1/events?page_size=500")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_events_out_of_range_page(auth_client, conn):
    await insert_event(conn, src_ip="1.1.1.1")
    resp = await auth_client.get("/api/v1/events?page=50&page_size=25")
    assert resp.status_code == 200
    body = EventPage.model_validate(resp.json())
    assert body.items == []
    assert body.total == 1


@pytest.mark.asyncio
async def test_events_401_without_token(client):
    resp = await client.get("/api/v1/events")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_event_detail_with_responses_shape(auth_client, conn):
    ev = await insert_event(conn, src_ip="9.9.9.9", raw_data={"x": 1})
    await insert_response(conn, event_id=ev["id"], action_type="bloqueo")

    resp = await auth_client.get(f"/api/v1/events/{ev['id']}")

    assert resp.status_code == 200
    body = EventDetail.model_validate(resp.json())
    assert body.id == ev["id"]
    assert body.raw_data == {"x": 1}
    assert len(body.responses) == 1
    assert body.responses[0].action_type == "bloqueo"


@pytest.mark.asyncio
async def test_event_detail_404(auth_client):
    resp = await auth_client.get("/api/v1/events/999999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_event_detail_401_without_token(client):
    resp = await client.get("/api/v1/events/1")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_mitre_with_data_and_shape(auth_client, conn):
    await insert_event(conn, att_ck_technique="T1059", src_ip="1.1.1.1")
    await insert_event(conn, att_ck_technique="T1059", src_ip="2.2.2.2")

    resp = await auth_client.get("/api/v1/mitre")

    assert resp.status_code == 200
    body = MitreResponse.model_validate(resp.json())
    assert body.total == 2
    assert body.techniques[0].technique == "T1059"
    assert body.techniques[0].count == 2
    assert body.techniques[0].tactic == "Execution"
    assert body.techniques[0].name == "Command and Scripting Interpreter"


@pytest.mark.asyncio
async def test_mitre_empty(auth_client):
    resp = await auth_client.get("/api/v1/mitre")
    assert resp.status_code == 200
    body = MitreResponse.model_validate(resp.json())
    assert body.techniques == []
    assert body.total == 0


@pytest.mark.asyncio
async def test_mitre_401_without_token(client):
    resp = await client.get("/api/v1/mitre")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_geo_countries_shape(auth_client, conn):
    await insert_event(conn, src_ip="1.1.1.1", enrichment_data={"country": "AR"})
    await insert_event(conn, src_ip="2.2.2.2", enrichment_data={"country": "AR"})

    resp = await auth_client.get("/api/v1/geo/countries")

    assert resp.status_code == 200
    body = GeoResponse.model_validate(resp.json())
    assert body.total == 2
    assert body.countries[0].country == "AR"
    assert body.countries[0].count == 2


@pytest.mark.asyncio
async def test_geo_empty(auth_client):
    resp = await auth_client.get("/api/v1/geo/countries")
    assert resp.status_code == 200
    body = GeoResponse.model_validate(resp.json())
    assert body.countries == []


@pytest.mark.asyncio
async def test_geo_401_without_token(client):
    resp = await client.get("/api/v1/geo/countries")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_malware_shape(auth_client, conn):
    await insert_event(conn, malware_hash="a" * 64, malware_filename="evil.exe", src_ip="1.1.1.1")

    resp = await auth_client.get("/api/v1/malware")

    assert resp.status_code == 200
    body = MalwareResponse.model_validate(resp.json())
    assert body.total == 1
    assert body.items[0].malware_hash == "a" * 64
    assert body.items[0].filenames == ["evil.exe"]


@pytest.mark.asyncio
async def test_malware_empty(auth_client):
    resp = await auth_client.get("/api/v1/malware")
    assert resp.status_code == 200
    body = MalwareResponse.model_validate(resp.json())
    assert body.items == []


@pytest.mark.asyncio
async def test_malware_401_without_token(client):
    resp = await client.get("/api/v1/malware")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_iocs_shape_and_filters(auth_client, conn):
    await insert_ioc(conn, ioc_type="ip", ioc_value="8.8.8.8", severity="high")
    await insert_ioc(conn, ioc_type="domain", ioc_value="evil.example", severity="low")

    resp = await auth_client.get("/api/v1/iocs?ioc_type=ip&severity=high")

    assert resp.status_code == 200
    body = IocPage.model_validate(resp.json())
    assert body.total == 1
    assert body.items[0].ioc_value == "8.8.8.8"


@pytest.mark.asyncio
async def test_iocs_401_without_token(client):
    resp = await client.get("/api/v1/iocs")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_health_public_shape(client):
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    body = HealthResponse.model_validate(resp.json())
    assert body.status == "ok"


@pytest.mark.asyncio
async def test_health_services_shape_with_n8n_up(auth_client, monkeypatch):
    from app.routers import health as health_router

    async def fake_n8n():
        return {"status": "ok", "detail": "healthz 200"}

    monkeypatch.setattr(health_router, "_n8n_health", fake_n8n)
    resp = await auth_client.get("/api/v1/health/services")
    assert resp.status_code == 200
    body = ServicesHealthResponse.model_validate(resp.json())
    assert body.services["n8n"].status == "ok"
    assert body.services["postgres"].status == "ok"
    assert body.status == "ok"


@pytest.mark.asyncio
async def test_health_services_degraded_when_n8n_down(auth_client, monkeypatch):
    from app.routers import health as health_router

    async def fake_n8n_down():
        return {"status": "degraded", "detail": "connect error"}

    monkeypatch.setattr(health_router, "_n8n_health", fake_n8n_down)
    resp = await auth_client.get("/api/v1/health/services")
    assert resp.status_code == 200
    body = ServicesHealthResponse.model_validate(resp.json())
    assert body.services["n8n"].status == "degraded"
    assert body.status == "degraded"


@pytest.mark.asyncio
async def test_health_services_401_without_token(client):
    resp = await client.get("/api/v1/health/services")
    assert resp.status_code == 401