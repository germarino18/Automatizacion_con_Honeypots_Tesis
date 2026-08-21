"""MITRE ATT&CK router (spec api-soc)."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query

from .. import db
from ..repositories import mitre as mitre_repo
from ..schemas.mitre import MitreResponse, TechniqueCount
from ..services.auth import (
    AUTH_ERROR_RESPONSES,
    cookie_scheme,
    require_auth,
)

router = APIRouter(
    responses=AUTH_ERROR_RESPONSES,
)


@router.get("/mitre", response_model=MitreResponse, dependencies=[Depends(cookie_scheme)])
async def mitre(
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    _user=Depends(require_auth),
    conn=Depends(db.get_conn),
):
    rows = await mitre_repo.list_techniques(conn, from_, to)
    items = []
    for r in rows:
        metadata = mitre_repo.get_technique_metadata(r["technique"])
        items.append(
            TechniqueCount(
                technique=r["technique"],
                tactic=metadata["tactic"] if metadata else None,
                name=metadata["name"] if metadata else None,
                count=r["count"],
            )
        )
    return MitreResponse(techniques=items, total=sum(r["count"] for r in rows))