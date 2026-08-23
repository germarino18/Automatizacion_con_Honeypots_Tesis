"""Integration tests for the automation router (tasks 6.3-6.8).

n8n is mocked end-to-end with httpx MockTransport by patching
``n8n_client.build_client``, so the router -> client -> httpx path runs for
real while the transport simulates n8n (up, down, or erroring).
"""

import json

import httpx
import pytest

from app.schemas.automation import (
    BlockIpResponse,
    CreateTicketResponse,
    ExecutionsResponse,
    SimulateResponse,
    WorkflowsResponse,
)
from app.schemas.responses import ResponsePage
from app.services import n8n_client
from tests.conftest import TEST_ENV, insert_event, insert_response

N8N_URL = TEST_ENV["N8N_INTERNAL_URL"]


def _patch_n8n(monkeypatch, handler):
    def _build(**kwargs):
        return httpx.AsyncClient(
            transport=httpx.MockTransport(handler), base_url=N8N_URL
        )

    monkeypatch.setattr(n8n_client, "build_client", _build)


def _workflows_data():
    return {
        "data": [
            {
                "id": "wf-1",
                "name": "SOC - Firewall Block Endpoint",
                "active": True,
                "updatedAt": "2026-08-20T10:15:30.000Z",
            },
            {"id": "wf-2", "name": "SOC - GLPI Ticket Endpoint", "active": False},
        ]
    }


# --- 6.3: workflows / executions -------------------------------------------


@pytest.mark.asyncio
async def test_workflows_ok(auth_client, monkeypatch):
    def handler(request):
        assert request.url.path == "/api/v1/workflows"
        return httpx.Response(200, json=_workflows_data())

    _patch_n8n(monkeypatch, handler)
    resp = await auth_client.get("/api/v1/automation/workflows")

    assert resp.status_code == 200
    body = WorkflowsResponse.model_validate(resp.json())
    assert body.degraded is False
    assert len(body.items) == 2
    assert body.items[0].name == "SOC - Firewall Block Endpoint"
    assert body.items[0].active is True
    assert body.items[0].updated_at is not None
    assert body.items[0].updated_at.year == 2026
    assert body.items[1].active is False
    assert body.items[1].updated_at is None


@pytest.mark.asyncio
async def test_workflows_n8n_down_returns_502_503(auth_client, monkeypatch):
    def handler(request):
        raise httpx.ConnectError("n8n unreachable")

    _patch_n8n(monkeypatch, handler)
    resp = await auth_client.get("/api/v1/automation/workflows")

    assert resp.status_code in (502, 503)


@pytest.mark.asyncio
async def test_workflows_401_without_token(client):
    resp = await client.get("/api/v1/automation/workflows")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_executions_ok(auth_client, monkeypatch):
    def handler(request):
        assert request.url.path == "/api/v1/executions"
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "id": 1,
                        "workflowData": {"id": "wf-1", "name": "X"},
                        "status": "success",
                        "startedAt": "2026-01-01T10:00:00.000Z",
                    },
                    {
                        "id": 2,
                        "workflowData": None,
                        "status": "error",
                        "startedAt": None,
                    },
                ]
            },
        )

    _patch_n8n(monkeypatch, handler)
    resp = await auth_client.get("/api/v1/automation/executions")

    assert resp.status_code == 200
    body = ExecutionsResponse.model_validate(resp.json())
    assert body.degraded is False
    assert body.items[0].id == 1
    assert body.items[0].workflowId == "wf-1"
    assert body.items[0].status == "success"
    assert body.items[1].workflowId is None


@pytest.mark.asyncio
async def test_executions_n8n_down_degrades_gracefully(auth_client, monkeypatch):
    def handler(request):
        raise httpx.ConnectError("n8n unreachable")

    _patch_n8n(monkeypatch, handler)
    resp = await auth_client.get("/api/v1/automation/executions")

    assert resp.status_code == 200
    body = ExecutionsResponse.model_validate(resp.json())
    assert body.degraded is True
    assert body.message
    assert body.items == []


@pytest.mark.asyncio
async def test_executions_401_without_token(client):
    resp = await client.get("/api/v1/automation/executions")
    assert resp.status_code == 401


# --- 6.4: simulate ----------------------------------------------------------


@pytest.mark.asyncio
async def test_simulate_cowrie_ok(auth_client, monkeypatch):
    payload = {"src_ip": "1.2.3.4", "username": "root", "eventid": "session.new"}

    def handler(request):
        assert request.method == "POST"
        assert request.url.path == "/webhook/cowrie"
        assert json.loads(request.content) == payload
        return httpx.Response(200, json={"success": True, "id": 42})

    _patch_n8n(monkeypatch, handler)
    resp = await auth_client.post(
        "/api/v1/automation/simulate",
        json={"honeypot": "cowrie", "payload": payload},
    )

    assert resp.status_code == 200
    body = SimulateResponse.model_validate(resp.json())
    assert body.success is True
    assert body.honeypot == "cowrie"
    assert body.result["id"] == 42


@pytest.mark.asyncio
async def test_simulate_dionaea_ok(auth_client, monkeypatch):
    def handler(request):
        assert request.url.path == "/webhook/dionaea"
        return httpx.Response(200, json={"success": True})

    _patch_n8n(monkeypatch, handler)
    resp = await auth_client.post(
        "/api/v1/automation/simulate",
        json={"honeypot": "dionaea", "payload": {"smb": True}},
    )

    assert resp.status_code == 200
    body = SimulateResponse.model_validate(resp.json())
    assert body.success is True
    assert body.honeypot == "dionaea"


@pytest.mark.asyncio
async def test_simulate_invalid_honeypot_422(auth_client, monkeypatch):
    sent = {}

    def handler(request):
        sent["called"] = True
        return httpx.Response(200, json={"success": True})

    _patch_n8n(monkeypatch, handler)
    resp = await auth_client.post(
        "/api/v1/automation/simulate",
        json={"honeypot": "wazuh", "payload": {"x": 1}},
    )

    assert resp.status_code == 422
    assert "called" not in sent


@pytest.mark.asyncio
async def test_simulate_n8n_down_returns_502_503(auth_client, monkeypatch):
    def handler(request):
        raise httpx.ConnectError("n8n unreachable")

    _patch_n8n(monkeypatch, handler)
    resp = await auth_client.post(
        "/api/v1/automation/simulate",
        json={"honeypot": "cowrie", "payload": {"x": 1}},
    )

    assert resp.status_code in (502, 503)


@pytest.mark.asyncio
async def test_simulate_n8n_reports_failure_is_502(auth_client, monkeypatch):
    def handler(request):
        return httpx.Response(200, json={"success": False, "error": "boom"})

    _patch_n8n(monkeypatch, handler)
    resp = await auth_client.post(
        "/api/v1/automation/simulate",
        json={"honeypot": "cowrie", "payload": {"x": 1}},
    )

    assert resp.status_code in (502, 503)


# --- 6.5: block-ip ----------------------------------------------------------


@pytest.mark.asyncio
async def test_block_ip_ok_and_payload_mapping(auth_client, monkeypatch):
    def handler(request):
        assert request.method == "POST"
        assert request.url.path == "/webhook/firewall-block"
        body = json.loads(request.content)
        assert body == {
            "event_id": 12,
            "ip": "8.8.8.8",
            "duration": 3600,
            "reason": "Scan sospechoso",
        }
        return httpx.Response(
            200,
            json={"success": True, "message": "IP blocked", "action_id": 1},
        )

    _patch_n8n(monkeypatch, handler)
    resp = await auth_client.post(
        "/api/v1/automation/block-ip",
        json={"src_ip": "8.8.8.8", "event_id": 12, "reason": "Scan sospechoso", "duration": 3600},
    )

    assert resp.status_code == 200
    body = BlockIpResponse.model_validate(resp.json())
    assert body.success is True
    assert body.src_ip == "8.8.8.8"
    assert body.result["action_id"] == 1


@pytest.mark.asyncio
async def test_block_ip_without_duration_sends_null(auth_client, monkeypatch):
    def handler(request):
        body = json.loads(request.content)
        assert body["duration"] is None
        assert body["ip"] == "8.8.8.8"
        return httpx.Response(200, json={"success": True})

    _patch_n8n(monkeypatch, handler)
    resp = await auth_client.post(
        "/api/v1/automation/block-ip",
        json={"src_ip": "8.8.8.8", "event_id": None, "reason": "test"},
    )

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_block_ip_invalid_ip_422(auth_client, monkeypatch):
    sent = {}

    def handler(request):
        sent["called"] = True
        return httpx.Response(200, json={"success": True})

    _patch_n8n(monkeypatch, handler)
    resp = await auth_client.post(
        "/api/v1/automation/block-ip",
        json={"src_ip": "not-an-ip", "event_id": None, "reason": "test"},
    )

    assert resp.status_code == 422
    assert "called" not in sent


@pytest.mark.asyncio
async def test_block_ip_n8n_down_returns_502_503(auth_client, monkeypatch):
    def handler(request):
        raise httpx.ConnectError("n8n unreachable")

    _patch_n8n(monkeypatch, handler)
    resp = await auth_client.post(
        "/api/v1/automation/block-ip",
        json={"src_ip": "8.8.8.8", "event_id": None, "reason": "test"},
    )

    assert resp.status_code in (502, 503)


@pytest.mark.asyncio
async def test_block_ip_401_without_token(client):
    resp = await client.post(
        "/api/v1/automation/block-ip",
        json={"src_ip": "8.8.8.8", "event_id": None, "reason": "test"},
    )
    assert resp.status_code == 401


# --- 6.6: create-ticket -----------------------------------------------------


@pytest.mark.asyncio
async def test_create_ticket_ok(auth_client, monkeypatch):
    def handler(request):
        assert request.method == "POST"
        assert request.url.path == "/webhook/glpi-ticket"
        body = json.loads(request.content)
        assert body == {
            "event_id": 5,
            "name": "Alerta SOC",
            "content": "prueba",
            "urgency": "high",
        }
        return httpx.Response(
            200,
            json={"success": True, "message": "Ticket created", "action_id": 3},
        )

    _patch_n8n(monkeypatch, handler)
    resp = await auth_client.post(
        "/api/v1/automation/create-ticket",
        json={"event_id": 5, "name": "Alerta SOC", "content": "prueba", "urgency": "high"},
    )

    assert resp.status_code == 200
    body = CreateTicketResponse.model_validate(resp.json())
    assert body.success is True
    assert body.result["action_id"] == 3


@pytest.mark.asyncio
async def test_create_ticket_missing_name_422(auth_client, monkeypatch):
    sent = {}

    def handler(request):
        sent["called"] = True
        return httpx.Response(200, json={"success": True})

    _patch_n8n(monkeypatch, handler)
    resp = await auth_client.post(
        "/api/v1/automation/create-ticket",
        json={"event_id": None, "name": "", "content": "prueba", "urgency": "high"},
    )

    assert resp.status_code == 422
    assert "called" not in sent


@pytest.mark.asyncio
async def test_create_ticket_blank_content_422(auth_client, monkeypatch):
    sent = {}

    def handler(request):
        sent["called"] = True
        return httpx.Response(200, json={"success": True})

    _patch_n8n(monkeypatch, handler)
    resp = await auth_client.post(
        "/api/v1/automation/create-ticket",
        json={"event_id": None, "name": "Alerta", "content": "   ", "urgency": "high"},
    )

    assert resp.status_code == 422
    assert "called" not in sent


@pytest.mark.asyncio
async def test_create_ticket_n8n_down_returns_502_503(auth_client, monkeypatch):
    def handler(request):
        raise httpx.ConnectError("n8n unreachable")

    _patch_n8n(monkeypatch, handler)
    resp = await auth_client.post(
        "/api/v1/automation/create-ticket",
        json={"event_id": None, "name": "Alerta", "content": "prueba", "urgency": "high"},
    )

    assert resp.status_code in (502, 503)


@pytest.mark.asyncio
async def test_create_ticket_401_without_token(client):
    resp = await client.post(
        "/api/v1/automation/create-ticket",
        json={"event_id": None, "name": "Alerta", "content": "prueba", "urgency": "high"},
    )
    assert resp.status_code == 401


# --- 6.7: responses history -------------------------------------------------


@pytest.mark.asyncio
async def test_responses_with_filters(auth_client, conn):
    ev = await insert_event(conn, src_ip="1.1.1.1")
    await insert_response(conn, event_id=ev["id"], action_type="bloqueo", status="completed")
    await insert_response(conn, action_type="alerta", status="completed")
    await insert_response(conn, action_type="bloqueo", status="failed")

    resp = await auth_client.get(
        "/api/v1/automation/responses?action_type=bloqueo&status=completed"
    )

    assert resp.status_code == 200
    body = ResponsePage.model_validate(resp.json())
    assert body.total == 1
    assert body.items[0].action_type == "bloqueo"
    assert body.items[0].status == "completed"


@pytest.mark.asyncio
async def test_responses_empty(auth_client):
    resp = await auth_client.get("/api/v1/automation/responses")

    assert resp.status_code == 200
    body = ResponsePage.model_validate(resp.json())
    assert body.items == []
    assert body.total == 0


@pytest.mark.asyncio
async def test_responses_401_without_token(client):
    resp = await client.get("/api/v1/automation/responses")
    assert resp.status_code == 401