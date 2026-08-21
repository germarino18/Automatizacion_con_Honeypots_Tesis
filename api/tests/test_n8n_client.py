"""Unit tests for the n8n client (tasks 6.1-6.2).

httpx MockTransport lets us exercise the real request-building code paths
(URLs, auth headers, JSON payloads, error capture) without a running n8n.
"""

import base64
import json

import httpx
import pytest

from app.services import n8n_client
from tests.conftest import TEST_ENV


def _client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.MockTransport(handler),
        base_url=TEST_ENV["N8N_INTERNAL_URL"],
    )


def _authed_client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.MockTransport(handler),
        base_url=TEST_ENV["N8N_INTERNAL_URL"],
        auth=(TEST_ENV["N8N_BASIC_AUTH_USER"], TEST_ENV["N8N_BASIC_AUTH_PASSWORD"]),
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
async def test_list_workflows_sends_basic_auth(monkeypatch):
    expected = base64.b64encode(
        f"{TEST_ENV['N8N_BASIC_AUTH_USER']}:{TEST_ENV['N8N_BASIC_AUTH_PASSWORD']}".encode()
    ).decode()

    async def handler(request):
        assert request.headers["Authorization"] == f"Basic {expected}"
        return httpx.Response(200, json={"data": []})

    monkeypatch.setattr(n8n_client, "build_client", lambda **kw: _authed_client(handler))
    await n8n_client.list_workflows()


@pytest.mark.asyncio
async def test_build_client_has_basic_auth():
    client = n8n_client.build_client()
    try:
        request = httpx.Request(
            "GET", TEST_ENV["N8N_INTERNAL_URL"] + "/api/v1/workflows"
        )
        authed_request = next(client.auth.auth_flow(request))
        expected = base64.b64encode(
            f"{TEST_ENV['N8N_BASIC_AUTH_USER']}:{TEST_ENV['N8N_BASIC_AUTH_PASSWORD']}".encode()
        ).decode()
        assert authed_request.headers["Authorization"] == f"Basic {expected}"
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_webhook_client_has_no_auth():
    client = n8n_client.build_client(webhook=True)
    try:
        assert client.auth is None
    finally:
        await client.aclose()


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