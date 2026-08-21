"""n8n integration client (design D6, specs api-soc + automatizacion-web).

Two integration paths:

* **Reads** (list_workflows / list_executions) use the n8n public API
  (``/api/v1/...``) with Basic Auth from ``N8N_BASIC_AUTH_*``.
* **Actions** (simulate / block_ip / create_ticket) POST to the EXISTING
  webhook workflows (``/webhook/cowrie``, ``/webhook/dionaea``,
  ``/webhook/firewall-block``, ``/webhook/glpi-ticket``) exactly as the
  sidecar does: no auth headers, payloads matching each workflow's contract.

Every call runs with a timeout and captures connection/HTTP errors as
``N8nClientError`` so routers can map them to 502/503 without reporting
false success.
"""

import httpx

from .. import config

DEFAULT_TIMEOUT = 10.0
EXECUTIONS_LIMIT = 50

SIMULATE_WEBHOOKS = {
    "cowrie": "/webhook/cowrie",
    "dionaea": "/webhook/dionaea",
}


class N8nClientError(Exception):
    """Typed n8n failure: connectivity, timeout or an error HTTP status.

    ``status_code`` is set when n8n answered with an error status (router
    maps to 502); it stays ``None`` on connection/timeout errors (503).
    """

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _base_url() -> str:
    return config.settings.n8n_internal_url.rstrip("/")


def _basic_auth() -> tuple[str, str] | None:
    user = config.settings.n8n_basic_auth_user
    password = config.settings.n8n_basic_auth_password
    if not user and not password:
        return None
    return (user, password)


def build_client(*, transport=None, webhook: bool = False) -> httpx.AsyncClient:
    """Build an AsyncClient for the internal n8n URL.

    Public-API reads send Basic Auth; webhook actions do not (matching the
    existing sidecar -> n8n webhook calls). ``transport`` is injectable for
    tests (httpx.MockTransport).
    """
    kwargs: dict = {
        "base_url": _base_url(),
        "timeout": httpx.Timeout(DEFAULT_TIMEOUT),
    }
    if transport is not None:
        kwargs["transport"] = transport
    if not webhook:
        auth = _basic_auth()
        if auth is not None:
            kwargs["auth"] = auth
    return httpx.AsyncClient(**kwargs)


async def _request(
    method: str,
    url: str,
    *,
    client: httpx.AsyncClient | None = None,
    webhook: bool = False,
    **kwargs,
) -> dict:
    """Run one request against n8n; normalize failures into N8nClientError."""
    created = client is None
    if created:
        client = build_client(webhook=webhook)
    try:
        resp = await getattr(client, method)(url, **kwargs)
    except httpx.HTTPError as exc:
        raise N8nClientError(f"n8n no responde: {exc}") from exc
    finally:
        if created:
            await client.aclose()

    if resp.status_code >= 400:
        raise N8nClientError(
            f"n8n respondió HTTP {resp.status_code}", status_code=resp.status_code
        )
    try:
        return resp.json()
    except ValueError as exc:
        raise N8nClientError("n8n devolvió una respuesta no JSON") from exc


# --- 6.1: public API reads --------------------------------------------------


async def list_workflows(client: httpx.AsyncClient | None = None) -> dict:
    """GET {N8N_INTERNAL_URL}/api/v1/workflows (Basic Auth)."""
    return await _request("get", "/api/v1/workflows", client=client)


async def list_executions(client: httpx.AsyncClient | None = None) -> dict:
    """GET {N8N_INTERNAL_URL}/api/v1/executions?limit=50 (Basic Auth)."""
    return await _request(
        "get",
        "/api/v1/executions",
        client=client,
        params={"limit": EXECUTIONS_LIMIT},
    )


# --- 6.2: webhook actions ---------------------------------------------------


async def simulate(
    honeypot: str, payload: dict, client: httpx.AsyncClient | None = None
) -> dict:
    """POST the attack payload to /webhook/cowrie or /webhook/dionaea."""
    webhook = SIMULATE_WEBHOOKS.get(honeypot)
    if webhook is None:
        raise ValueError(f"honeypot no soportado: {honeypot}")
    return await _request("post", webhook, client=client, webhook=True, json=payload)


async def block_ip(
    src_ip: str,
    event_id: int | None,
    reason: str,
    duration: int | None = None,
    client: httpx.AsyncClient | None = None,
) -> dict:
    """POST {event_id, ip, duration, reason} to /webhook/firewall-block."""
    payload = {
        "event_id": event_id,
        "ip": src_ip,
        "duration": duration,
        "reason": reason,
    }
    return await _request(
        "post", "/webhook/firewall-block", client=client, webhook=True, json=payload
    )


async def create_ticket(
    event_id: int | None,
    name: str,
    content: str,
    urgency: str,
    client: httpx.AsyncClient | None = None,
) -> dict:
    """POST {event_id, name, content, urgency} to /webhook/glpi-ticket."""
    payload = {
        "event_id": event_id,
        "name": name,
        "content": content,
        "urgency": urgency,
    }
    return await _request(
        "post", "/webhook/glpi-ticket", client=client, webhook=True, json=payload
    )