"""Overview (SOC dashboard) router (spec api-soc)."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query

from .. import db
from ..repositories import overview as overview_repo
from ..schemas.overview import Overview
from ..services.auth import (
    AUTH_ERROR_RESPONSES,
    cookie_scheme,
    require_auth,
)

router = APIRouter(
    responses=AUTH_ERROR_RESPONSES,
)


@router.get("/overview", response_model=Overview, dependencies=[Depends(cookie_scheme)])
async def overview(
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    _user=Depends(require_auth),
    conn=Depends(db.get_conn),
):
    data = await overview_repo.get_overview(conn, from_, to)
    return Overview(**data)