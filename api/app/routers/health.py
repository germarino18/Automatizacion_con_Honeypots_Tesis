"""Health endpoints (spec api-soc).

GET /api/v1/health          public  - API + PostgreSQL probe
GET /api/v1/health/services protected - + n8n healthz
Both return HTTP 200 even when a dependency is down, with status
ok/degraded per service so the frontend sidebar can render the state.
"""

import httpx
from fastapi import APIRouter, Depends

from .. import config
from ..schemas.health import HealthResponse, ServiceHealth, ServicesHealthResponse
from ..services.auth import (
    AUTH_ERROR_RESPONSES,
    cookie_scheme,
    require_auth,
)
from ..db import get_conn

router = APIRouter()


async def _postgres_ok(conn) -> bool:
    try:
        value = await conn.fetchval("SELECT 1")
        return value == 1
    except Exception:
        return False


async def _n8n_health() -> dict:
    url = config.settings.n8n_internal_url.rstrip("/") + "/healthz"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
        if resp.status_code == 200:
            return {"status": "ok", "detail": "healthz 200"}
        return {"status": "degraded", "detail": f"healthz {resp.status_code}"}
    except httpx.HTTPError as exc:
        return {"status": "degraded", "detail": str(exc)}


@router.get("/health", response_model=HealthResponse)
async def health(conn=Depends(get_conn)):
    postgres_ok = await _postgres_ok(conn)
    overall = "ok" if postgres_ok else "degraded"
    return HealthResponse(
        status=overall,
        api="ok",
        postgres="ok" if postgres_ok else "degraded",
    )


@router.get(
    "/health/services",
    response_model=ServicesHealthResponse,
    dependencies=[Depends(cookie_scheme)],
    responses=AUTH_ERROR_RESPONSES,
)
async def health_services(_user=Depends(require_auth), conn=Depends(get_conn)):
    postgres_ok = await _postgres_ok(conn)
    n8n = await _n8n_health()
    services = {
        "api": ServiceHealth(status="ok"),
        "postgres": ServiceHealth(
            status="ok" if postgres_ok else "degraded",
            detail=None if postgres_ok else "query failed",
        ),
        "n8n": ServiceHealth(**n8n),
    }
    overall = (
        "ok"
        if all(s.status == "ok" for s in services.values())
        else "degraded"
    )
    return ServicesHealthResponse(status=overall, services=services)