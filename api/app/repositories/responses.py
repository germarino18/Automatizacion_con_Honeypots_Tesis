"""Responses repository: automation history with filters (spec api-soc)."""

RESPONSE_COLUMNS = (
    "id",
    "event_id",
    "timestamp",
    "action_type",
    "actor",
    "status",
    "evidence_uri",
    "details",
    "created_at",
)


def _build_where(filters: dict):
    clauses = []
    params = []

    action_type = filters.get("action_type")
    if action_type:
        params.append(action_type)
        clauses.append(f"action_type = ${len(params)}")

    status = filters.get("status")
    if status:
        params.append(status)
        clauses.append(f"status = ${len(params)}")

    event_id = filters.get("event_id")
    if event_id is not None:
        params.append(event_id)
        clauses.append(f"event_id = ${len(params)}")

    from_ = filters.get("from_")
    to = filters.get("to")
    if from_ is not None:
        params.append(from_)
        clauses.append(f"timestamp >= ${len(params)}")
    if to is not None:
        params.append(to)
        clauses.append(f"timestamp <= ${len(params)}")

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return where, params


async def list_responses(conn, filters: dict, page: int, page_size: int) -> list[dict]:
    where, params = _build_where(filters)
    params.append(page_size)
    params.append((page - 1) * page_size)
    sql = (
        f"SELECT {', '.join(RESPONSE_COLUMNS)} FROM responses {where} "
        f"ORDER BY timestamp DESC, id DESC LIMIT ${len(params) - 1} OFFSET ${len(params)}"
    )
    rows = await conn.fetch(sql, *params)
    return [dict(r) for r in rows]


async def count_responses(conn, filters: dict) -> int:
    where, params = _build_where(filters)
    return await conn.fetchval(f"SELECT COUNT(*) FROM responses {where}", *params)