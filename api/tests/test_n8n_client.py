"""Unit tests for the n8n client (tasks 6.1-6.2).

httpx MockTransport lets us exercise the real request-building code paths
(URLs, auth headers, JSON payloads, error capture) without a running n8n.
"""

import json
from functools import partial

import httpx
import pytest

from app import config
from app.services import n8n_client
from tests.conftest import TEST_ENV


def _client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.MockTransport(handler),
        base_url=TEST_ENV["N8N_INTERNAL_URL"],
    )


def _built_client(handler):
    """build_client patched ONLY with a MockTransport: production header
    logic (X-N8N-API-KEY) runs for real."""
    return partial(
        n8n_client.build_client, transport=httpx.MockTransport(handler)
    )


async def _run(coro):
    return await coro


# --- 6.1: public API reads --------------------------------------------------


@pytest.mark.asyncio
async def test_list_workflows_returns_data():
    async def handler(request):
        assert str(request.url) == (
            TEST_ENV["N8N_INTERNAL_URL"] + "/api/v1/workflows"
        )
        return httpx.Response(
            200,
            json={
                "data": [
                    {"id": "wf-1", "name": "Firewall Block", "active": True},
                    {"id": "wf-2", "name": "GLPI Ticket", "active": False},
                ]
            },
        )

    result = await n8n_client.list_workflows(client=_client(handler))

    assert len(result["data"]) == 2
    assert result["data"][0]["name"] == "Firewall Block"
    assert result["data"][1]["active"] is False


@pytest.mark.asyncio
async def test_list_workflows_sends_api_key_header(monkeypatch):
    async def handler(request):
        assert request.headers["X-N8N-API-KEY"] == TEST_ENV["N8N_API_KEY"]
        return httpx.Response(200, json={"data": []})

    monkeypatch.setattr(n8n_client, "build_client", _built_client(handler))
    await n8n_client.list_workflows()


@pytest.mark.asyncio
async def test_list_executions_sends_api_key_header(monkeypatch):
    async def handler(request):
        assert request.headers["X-N8N-API-KEY"] == TEST_ENV["N8N_API_KEY"]
        assert request.url.params["limit"] == "50"
        return httpx.Response(200, json={"data": []})

    monkeypatch.setattr(n8n_client, "build_client", _built_client(handler))
    await n8n_client.list_executions()


@pytest.mark.asyncio
async def test_build_client_sets_api_key_header_when_configured():
    captured = {}

    def handler(request):
        captured["headers"] = request.headers
        return httpx.Response(200, json={"data": []})

    client = n8n_client.build_client(transport=httpx.MockTransport(handler))
    try:
        resp = await client.get("/api/v1/workflows")
    finally:
        await client.aclose()

    assert resp.status_code == 200
    assert captured["headers"]["X-N8N-API-KEY"] == TEST_ENV["N8N_API_KEY"]


@pytest.mark.asyncio
async def test_build_client_without_api_key_omits_header(monkeypatch):
    monkeypatch.setattr(config.settings, "n8n_api_key", "")
    captured = {}

    def handler(request):
        captured["headers"] = request.headers
        return httpx.Response(200, json={"data": []})

    client = n8n_client.build_client(transport=httpx.MockTransport(handler))
    try:
        resp = await client.get("/api/v1/workflows")
    finally:
        await client.aclose()

    assert resp.status_code == 200
    assert "X-N8N-API-KEY" not in captured["headers"]


@pytest.mark.asyncio
async def test_webhook_client_has_no_api_key_header():
    captured = {}

    def handler(request):
        captured["headers"] = request.headers
        return httpx.Response(200, json={"success": True})

    client = n8n_client.build_client(
        webhook=True, transport=httpx.MockTransport(handler)
    )
    try:
        resp = await client.post("/webhook/cowrie", json={})
    finally:
        await client.aclose()

    assert resp.status_code == 200
    assert "X-N8N-API-KEY" not in captured["headers"]


@pytest.mark.asyncio
async def test_simulate_via_built_webhook_client_never_sends_api_key(monkeypatch):
    async def handler(request):
        assert "X-N8N-API-KEY" not in request.headers
        return httpx.Response(200, json={"success": True})

    monkeypatch.setattr(
        n8n_client,
        "build_client",
        partial(
            n8n_client.build_client,
            transport=httpx.MockTransport(handler),
            webhook=True,
        ),
    )
    result = await n8n_client.simulate("cowrie", {"src_ip": "1.2.3.4"})

    assert result["success"] is True


@pytest.mark.asyncio
async def test_list_executions_uses_limit_50():
    async def handler(request):
        assert request.url.path == "/api/v1/executions"
        assert request.url.params["limit"] == "50"
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "id": 99,
                        "workflowData": {"id": "wf-1", "name": "Firewall Block"},
                        "status": "success",
                        "startedAt": "2026-01-01T10:00:00.000Z",
                    }
                ]
            },
        )

    result = await n8n_client.list_executions(client=_client(handler))

    assert result["data"][0]["id"] == 99
    assert result["data"][0]["status"] == "success"


# --- 6.2: webhook actions ---------------------------------------------------


@pytest.mark.asyncio
async def test_simulate_cowrie_posts_payload_to_cowrie_webhook():
    payload = {"src_ip": "1.2.3.4", "username": "root", "eventid": "session.new"}

    async def handler(request):
        assert request.url.path == "/webhook/cowrie"
        assert request.method == "POST"
        assert json.loads(request.content) == payload
        assert "Authorization" not in request.headers
        assert "X-N8N-API-KEY" not in request.headers
        return httpx.Response(200, json={"success": True})

    result = await n8n_client.simulate("cowrie", payload, client=_client(handler))

    assert result["success"] is True


@pytest.mark.asyncio
async def test_simulate_dionaea_posts_to_dionaea_webhook():
    async def handler(request):
        assert request.url.path == "/webhook/dionaea"
        assert json.loads(request.content) == {"smb": True}
        return httpx.Response(200, json={"success": True, "id": 7})

    result = await n8n_client.simulate("dionaea", {"smb": True}, client=_client(handler))

    assert result["id"] == 7


@pytest.mark.asyncio
async def test_simulate_unknown_honeypot_raises_value_error():
    with pytest.raises(ValueError):
        await n8n_client.simulate("wazuh", {"x": 1})


@pytest.mark.asyncio
async def test_block_ip_maps_payload_without_duration():
    async def handler(request):
        assert request.url.path == "/webhook/firewall-block"
        assert request.method == "POST"
        body = json.loads(request.content)
        assert body == {
            "event_id": 12,
            "ip": "8.8.8.8",
            "duration": None,
            "reason": "Scan sospechoso",
        }
        return httpx.Response(
            200,
            json={"success": True, "message": "IP blocked", "action_id": 1},
        )

    result = await n8n_client.block_ip(
        src_ip="8.8.8.8", event_id=12, reason="Scan sospechoso", client=_client(handler)
    )

    assert result["success"] is True


@pytest.mark.asyncio
async def test_block_ip_with_duration():
    async def handler(request):
        body = json.loads(request.content)
        assert body["duration"] == 3600
        assert body["ip"] == "8.8.8.8"
        return httpx.Response(200, json={"success": True})

    await n8n_client.block_ip(
        src_ip="8.8.8.8",
        event_id=None,
        reason="test",
        duration=3600,
        client=_client(handler),
    )


@pytest.mark.asyncio
async def test_create_ticket_payload():
    async def handler(request):
        assert request.url.path == "/webhook/glpi-ticket"
        assert request.method == "POST"
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

    result = await n8n_client.create_ticket(
        event_id=5, name="Alerta SOC", content="prueba", urgency="high",
        client=_client(handler),
    )

    assert result["action_id"] == 3


@pytest.mark.asyncio
async def test_create_ticket_passes_glpi_ticket_id_through():
    """The reworked workflow answers {success, message, action_id,
    glpi_ticket_id, timestamp} when GLPI created the ticket; the client is
    transparent so the router can echo glpi_ticket_id inside result."""
    async def handler(request):
        assert request.url.path == "/webhook/glpi-ticket"
        assert request.method == "POST"
        body = json.loads(request.content)
        assert body == {
            "event_id": 9,
            "name": "Ticket SOC",
            "content": "detalle del incidente",
            "urgency": "high",
        }
        return httpx.Response(
            200,
            json={
                "success": True,
                "message": "Ticket GLPI #42 creado",
                "action_id": "exec-9",
                "glpi_ticket_id": 42,
                "timestamp": "2026-09-05T10:00:00.000Z",
            },
        )

    result = await n8n_client.create_ticket(
        event_id=9,
        name="Ticket SOC",
        content="detalle del incidente",
        urgency="high",
        client=_client(handler),
    )

    assert result["success"] is True
    assert result["glpi_ticket_id"] == 42
    assert result["action_id"] == "exec-9"
    assert result["timestamp"] == "2026-09-05T10:00:00.000Z"


@pytest.mark.asyncio
async def test_create_ticket_event_id_null_payload_verbatim():
    """event_id is nullable (id|null) and the contract payload still goes
    VERBATIM to /webhook/glpi-ticket."""
    async def handler(request):
        assert request.url.path == "/webhook/glpi-ticket"
        assert json.loads(request.content) == {
            "event_id": None,
            "name": "Alerta",
            "content": "cuerpo",
            "urgency": "low",
        }
        return httpx.Response(
            200,
            json={"success": True, "glpi_ticket_id": 7},
        )

    result = await n8n_client.create_ticket(
        event_id=None,
        name="Alerta",
        content="cuerpo",
        urgency="low",
        client=_client(handler),
    )

    assert result["glpi_ticket_id"] == 7


@pytest.mark.asyncio
async def test_create_ticket_via_built_webhook_client_never_sends_api_key(monkeypatch):
    """Webhook actions must never carry the public-API key (sidecar
    precedent). create_ticket through a real build_client(webhook=True)
    run for the request."""
    async def handler(request):
        assert "X-N8N-API-KEY" not in request.headers
        return httpx.Response(200, json={"success": True, "glpi_ticket_id": 15})

    monkeypatch.setattr(
        n8n_client,
        "build_client",
        partial(
            n8n_client.build_client,
            transport=httpx.MockTransport(handler),
            webhook=True,
        ),
    )
    result = await n8n_client.create_ticket(
        event_id=1, name="N", content="C", urgency="medium"
    )

    assert result["glpi_ticket_id"] == 15


@pytest.mark.asyncio
async def test_create_ticket_keeps_failure_body_for_router_enforcement():
    """When GLPI rejects the ticket the workflow answers 200 with
    success:false + glpi_ticket_id null; to avoid a false success the client
    must pass the body untouched so the router's _ensure_success can reject
    it (D-glpi-6/D-glpi-7)."""
    async def handler(request):
        assert request.url.path == "/webhook/glpi-ticket"
        return httpx.Response(
            200,
            json={
                "success": False,
                "message": "GLPI rechazó el ticket",
                "action_id": None,
                "glpi_ticket_id": None,
                "timestamp": "2026-09-05T10:00:00.000Z",
            },
        )

    result = await n8n_client.create_ticket(
        event_id=2,
        name="N",
        content="C",
        urgency="medium",
        client=_client(handler),
    )

    assert result["success"] is False
    assert result["glpi_ticket_id"] is None


# --- 6.2: error capture -----------------------------------------------------


@pytest.mark.asyncio
async def test_connection_error_raises_n8n_error():
    def handler(request):
        raise httpx.ConnectError("n8n unreachable")

    with pytest.raises(n8n_client.N8nClientError) as exc_info:
        await n8n_client.list_workflows(client=_client(handler))

    assert exc_info.value.status_code is None


@pytest.mark.asyncio
async def test_timeout_raises_n8n_error():
    def handler(request):
        raise httpx.ReadTimeout("n8n timeout")

    with pytest.raises(n8n_client.N8nClientError):
        await n8n_client.simulate("cowrie", {}, client=_client(handler))


@pytest.mark.asyncio
async def test_http_error_status_raises_n8n_error_with_status():
    def handler(request):
        return httpx.Response(500, json={"message": "boom"})

    with pytest.raises(n8n_client.N8nClientError) as exc_info:
        await n8n_client.list_workflows(client=_client(handler))

    assert exc_info.value.status_code == 500


@pytest.mark.asyncio
async def test_webhook_http_error_raises_n8n_error():
    def handler(request):
        return httpx.Response(404, text="not found")

    with pytest.raises(n8n_client.N8nClientError) as exc_info:
        await n8n_client.create_ticket(
            event_id=None, name="x", content="y", urgency="low",
            client=_client(handler),
        )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_non_json_response_raises_n8n_error():
    def handler(request):
        return httpx.Response(200, text="<html>n8n ui</html>")

    with pytest.raises(n8n_client.N8nClientError):
        await n8n_client.list_executions(client=_client(handler))