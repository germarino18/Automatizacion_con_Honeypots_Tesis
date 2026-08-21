"""Geolocation router (spec api-soc)."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query

from .. import db
from ..repositories import geo as geo_repo
from ..schemas.geo import GeoResponse
from ..services.auth import (
    AUTH_ERROR_RESPONSES,
    cookie_scheme,
    require_auth,
)

router = APIRouter(
    responses=AUTH_ERROR_RESPONSES,
)


@router.get(
    "/geo/countries",
    response_model=GeoResponse,
    dependencies=[Depends(cookie_scheme)],
)
async def geo_countries(
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    _user=Depends(require_auth),
    conn=Depends(db.get_conn),
):
    data = await geo_repo.list_countries(conn, from_, to)
    return GeoResponse(**data)