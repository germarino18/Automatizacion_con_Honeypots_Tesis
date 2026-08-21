"""SSE live event feed service (design D4, spec api-soc).

The generator polls ``honeypot_events`` for rows with ``id > last_id`` (PK
index scan, ``ORDER BY id LIMIT N``) every ``sse_poll_interval_seconds`` and
emits one ``event: event`` frame per new row. When nothing arrives it emits a
``event: ping`` heartbeat every ``sse_heartbeat_seconds`` to keep the
connection alive (and to let nginx/browser timeouts not kill the stream).

The generator owns no shared resource: the connection comes from the
``db.get_conn`` dependency and is released on request teardown. On client
disconnect the generator is closed (GeneratorExit / CancelledError), and the
``finally`` block guarantees a clean teardown with no orphan streams.
"""

import asyncio
import json
import time

from .. import config
from ..repositories import events as events_repo


def format_event_frame(event: dict) -> str:
    """Render a honeypot event dict as an ``event: event`` SSE frame."""
    data = json.dumps(event, default=str)
    return f"event: event\ndata: {data}\n\n"


def format_ping() -> str:
    """Render the heartbeat ``event: ping`` SSE frame."""
    return "event: ping\ndata: {}\n\n"


async def event_stream(
    conn,
    last_id: int = 0,
    poll_interval: float | None = None,
    heartbeat_interval: float | None = None,
    batch_size: int | None = None,
):
    """Yield SSE frames for new honeypot_events rows.

    ``conn`` must be an asyncpg connection. Poll and heartbeat intervals come
    from config by default (overridable for tests/tuning). Emits pings when no
    events arrive so idle clients stay connected.
    """
    poll = (
        poll_interval
        if poll_interval is not None
        else config.settings.sse_poll_interval_seconds
    )
    heartbeat = (
        heartbeat_interval
        if heartbeat_interval is not None
        else config.settings.sse_heartbeat_seconds
    )
    batch = batch_size if batch_size is not None else config.settings.sse_batch_size
    last_id = last_id or 0
    next_heartbeat = time.monotonic() + heartbeat

    columns = ", ".join(events_repo.EVENT_COLUMNS)
    try:
        while True:
            rows = await conn.fetch(
                f"SELECT {columns} FROM honeypot_events "
                f"WHERE id > $1 ORDER BY id LIMIT $2",
                last_id,
                batch,
            )
            for row in rows:
                event = events_repo._row_to_dict(row)
                last_id = event["id"]
                yield format_event_frame(event)

            now = time.monotonic()
            if now >= next_heartbeat:
                yield format_ping()
                next_heartbeat = now + heartbeat

            await asyncio.sleep(poll)
    finally:
        # Client disconnect (GeneratorExit / CancelledError) lands here. No
        # resources are owned beyond the pool connection, which the
        # db.get_conn dependency releases on request teardown.
        pass