"""Automation endpoints: n8n integration (design D6, spec automatizacion-web).

Protected reads (workflows/executions), SOAR actions (simulate / block-ip /
create-ticket) delegating to the existing n8n webhook workflows, and the
responses history from PostgreSQL.

Degradation policy (per spec):
* workflows   - n8n unreachable -> HTTP 502/503, no fake data
* executions  - n8n unreachable -> HTTP 200 with ``degraded: true`` + empty
                list (does not fail the whole request)
* actions     - n8n unreachable or reporting ``success: false`` -> 502/503,
                never a false success
"""

import json

from fastapi import APIRouter, Depends, HTTPException

from .. import db
from ..repositories import responses as responses_repo
from ..schemas.automation import (
    BlockIpRequest,
    BlockIpResponse,
    CreateTicketRequest,
    CreateTicketResponse,
    ExecutionItem,
    ExecutionsResponse,
    SimulateRequest,
    SimulateResponse,
    WorkflowItem,
    WorkflowsResponse,
)
from ..schemas.responses import ResponseFilterParams, ResponsePage
from ..services import n8n_client
from ..services.auth import (
    AUTH_ERROR_RESPONSES,
    cookie_scheme,
    require_auth,
)

router = APIRouter(
    responses=AUTH_ERROR_RESPONSES,
)


def _n8n_error(exc: n8n_client.N8nClientError) -> HTTPException:
    """Map a typed n8n failure to 502 (n8n answered with error) or 503."""
    if exc.status_code is not None:
        return HTTPException(
            status_code=502, detail=f"n8n respondió con error {exc.status_code}"
        )
    return HTTPException(status_code=503, detail=str(exc))


def _ensure_success(result: dict) -> None:
    """Reject webhook responses that explicitly did not report success."""
    if result.get("success") is False:
        raise HTTPException(status_code=502, detail="n8n no reportó éxito")


def _decode_details(item: dict) -> dict:
    """asyncpg returns JSONB as text; decode it for the ResponseItem DTO."""
    if isinstance(item.get("details"), str):
        try:
            item["details"] = json.loads(item["details"])
        except ValueError:
            pass
    return item


# --- 6.3: reads -------------------------------------------------------------


@router.get(
    "/automation/workflows",
    response_model=WorkflowsResponse,
    dependencies=[Depends(cookie_scheme)],
)
async def list_workflows(_user=Depends(require_auth)):
    try:
        data = await n8n_client.list_workflows()
    except n8n_client.N8nClientError as exc:
        raise _n8n_error(exc)
    items = [
        WorkflowItem(
            id=wf.get("id"),
            name=wf.get("name", ""),
            active=bool(wf.get("active", False)),
        )
        for wf in data.get("data", [])
    ]
    return WorkflowsResponse(items=items)


@router.get(
    "/automation/executions",
    response_model=ExecutionsResponse,
    dependencies=[Depends(cookie_scheme)],
)
async def list_executions(_user=Depends(require_auth)):
    try:
        data = await n8n_client.list_executions()
    except n8n_client.N8nClientError as exc:
        return ExecutionsResponse(degraded=True, message=str(exc), items=[])
    items = []
    for exec_ in data.get("data", []):
        workflow = exec_.get("workflowData") or {}
        items.append(
            ExecutionItem(
                id=exec_.get("id"),
                workflowId=workflow.get("id"),
                status=exec_.get("status"),
                startedAt=exec_.get("startedAt"),
            )
        )
    return ExecutionsResponse(items=items)


# --- 6.4: simulate ----------------------------------------------------------


@router.post(
    "/automation/simulate",
    response_model=SimulateResponse,
    dependencies=[Depends(cookie_scheme)],
)
async def simulate(body: SimulateRequest, _user=Depends(require_auth)):
    try:
        result = await n8n_client.simulate(body.honeypot, body.payload)
    except n8n_client.N8nClientError as exc:
        raise _n8n_error(exc)
    _ensure_success(result)
    return SimulateResponse(success=True, honeypot=body.honeypot, result=result)


# --- 6.5: block-ip ----------------------------------------------------------


@router.post(
    "/automation/block-ip",
    response_model=BlockIpResponse,
    dependencies=[Depends(cookie_scheme)],
)
async def block_ip(body: BlockIpRequest, _user=Depends(require_auth)):
    try:
        result = await n8n_client.block_ip(
            src_ip=str(body.src_ip),
            event_id=body.event_id,
            reason=body.reason,
            duration=body.duration,
        )
    except n8n_client.N8nClientError as exc:
        raise _n8n_error(exc)
    _ensure_success(result)
    return BlockIpResponse(success=True, src_ip=str(body.src_ip), result=result)


# --- 6.6: create-ticket -----------------------------------------------------


@router.post(
    "/automation/create-ticket",
    response_model=CreateTicketResponse,
    dependencies=[Depends(cookie_scheme)],
)
async def create_ticket(body: CreateTicketRequest, _user=Depends(require_auth)):
    try:
        result = await n8n_client.create_ticket(
            event_id=body.event_id,
            name=body.name,
            content=body.content,
            urgency=body.urgency,
        )
    except n8n_client.N8nClientError as exc:
        raise _n8n_error(exc)
    _ensure_success(result)
    return CreateTicketResponse(success=True, result=result)


# --- 6.7: responses history -------------------------------------------------


@router.get(
    "/automation/responses",
    response_model=ResponsePage,
    dependencies=[Depends(cookie_scheme)],
)
async def list_responses(
    params: ResponseFilterParams = Depends(),
    _user=Depends(require_auth),
    conn=Depends(db.get_conn),
):
    filters = params.model_dump(exclude={"page", "page_size"})
    items = await responses_repo.list_responses(conn, filters, params.page, params.page_size)
    total = await responses_repo.count_responses(conn, filters)
    return ResponsePage(
        items=[_decode_details(item) for item in items],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )