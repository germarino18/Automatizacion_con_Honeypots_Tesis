"""SSE live feed endpoint (design D4, spec api-soc).

GET /api/v1/events/live (protected) returns a StreamingResponse with media
type text/event-stream. Cache-Control and X-Accel-Buffering headers keep
nginx from buffering the stream (design D7 / risk SSE cortado por nginx).
"""

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from .. import db
from ..services.auth import (
    AUTH_ERROR_RESPONSES,
    cookie_scheme,
    require_auth,
)
from ..services.live import event_stream

router = APIRouter(
    responses=AUTH_ERROR_RESPONSES,
)

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
}


@router.get("/events/live", dependencies=[Depends(cookie_scheme)])
async def live_events(_user=Depends(require_auth), conn=Depends(db.get_conn)):
    """Stream new honeypot_events as they are inserted."""
    return StreamingResponse(
        event_stream(conn),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )