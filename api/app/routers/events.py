"""Events explorer + detail router (spec api-soc)."""

from fastapi import APIRouter, Depends, HTTPException

from .. import db
from ..repositories import events as events_repo
from ..schemas.events import EventDetail, EventFilterParams, EventPage
from ..services.auth import (
    AUTH_ERROR_RESPONSES,
    cookie_scheme,
    require_auth,
)

router = APIRouter(
    responses=AUTH_ERROR_RESPONSES,
)


@router.get("/events", response_model=EventPage, dependencies=[Depends(cookie_scheme)])
async def list_events(
    params: EventFilterParams = Depends(),
    _user=Depends(require_auth),
    conn=Depends(db.get_conn),
):
    filters = params.model_dump(exclude={"page", "page_size"})
    items = await events_repo.list_events(conn, filters, params.page, params.page_size)
    total = await events_repo.count_events(conn, filters)
    return EventPage(items=items, total=total, page=params.page, page_size=params.page_size)


@router.get(
    "/events/{event_id}",
    response_model=EventDetail,
    dependencies=[Depends(cookie_scheme)],
)
async def get_event(
    event_id: int,
    _user=Depends(require_auth),
    conn=Depends(db.get_conn),
):
    detail = await events_repo.get_event_by_id(conn, event_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return EventDetail(**detail)