"""Event repository: parameterized queries over honeypot_events.

list_events  -> paginated rows ordered by timestamp DESC
count_events -> total rows for the same filters
get_event_by_id -> single row (16 typed columns) + nested responses
"""

import json

from ..services.severity import bucket_range, severity_for

EVENT_COLUMNS = (
    "id",
    "timestamp",
    "source_honeypot",
    "src_ip",
    "dst_port",
    "protocol",
    "username",
    "commands",
    "malware_hash",
    "malware_filename",
    "playbook_id",
    "risk_score",
    "att_ck_technique",
    "enrichment_data",
    "raw_data",
    "created_at",
)


def _build_where(filters: dict):
    """Build WHERE fragments + positional params from validated filters.

    Only fixed column expressions are concatenated; every user value is
    passed as an asyncpg parameter (no value interpolation).
    """
    clauses = []
    params = []

    from_ = filters.get("from_")
    to = filters.get("to")
    if from_ is not None:
        params.append(from_)
        clauses.append(f"timestamp >= ${len(params)}")
    if to is not None:
        params.append(to)
        clauses.append(f"timestamp <= ${len(params)}")

    source_honeypot = filters.get("source_honeypot")
    if source_honeypot:
        params.append(source_honeypot)
        clauses.append(f"source_honeypot = ${len(params)}")

    protocol = filters.get("protocol")
    if protocol:
        params.append(protocol)
        clauses.append(f"protocol = ${len(params)}")

    src_ip = filters.get("src_ip")
    if src_ip:
        params.append(src_ip)
        clauses.append(f"src_ip = ${len(params)}::inet")

    severity = filters.get("severity")
    if severity:
        low, high = bucket_range(severity)
        params.append(low)
        clauses.append(f"risk_score >= ${len(params)}")
        params.append(high)
        clauses.append(f"risk_score < ${len(params)}")

    technique = filters.get("technique")
    if technique:
        params.append(technique)
        clauses.append(f"att_ck_technique = ${len(params)}")

    username = filters.get("username")
    if username:
        params.append(username)
        clauses.append(f"username = ${len(params)}")

    search = filters.get("search")
    if search:
        params.append(f"%{search}%")
        clauses.append(
            f"(commands ILIKE ${len(params)} OR raw_data::text ILIKE ${len(params)})"
        )

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return where, params


def _loads_json(value):
    """asyncpg returns jsonb as text; decode it to a dict."""
    if isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            return value
    return value


def _row_to_dict(row) -> dict:
    if row is None:
        return None
    d = dict(row)
    if d.get("src_ip") is not None:
        d["src_ip"] = str(d["src_ip"])
    if d.get("risk_score") is not None:
        d["risk_score"] = float(d["risk_score"])
    d["severity"] = severity_for(d.get("risk_score"))
    d["enrichment_data"] = _loads_json(d.get("enrichment_data"))
    d["raw_data"] = _loads_json(d.get("raw_data"))
    return d


async def list_events(conn, filters: dict, page: int, page_size: int) -> list[dict]:
    where, params = _build_where(filters)
    params.append(page_size)
    offset = (page - 1) * page_size
    params.append(offset)
    sql = (
        f"SELECT {', '.join(EVENT_COLUMNS)} FROM honeypot_events {where} "
        f"ORDER BY timestamp DESC, id DESC LIMIT ${len(params) - 1} OFFSET ${len(params)}"
    )
    rows = await conn.fetch(sql, *params)
    return [_row_to_dict(r) for r in rows]


async def count_events(conn, filters: dict) -> int:
    where, params = _build_where(filters)
    sql = f"SELECT COUNT(*) FROM honeypot_events {where}"
    return await conn.fetchval(sql, *params)


async def get_event_by_id(conn, event_id: int) -> dict | None:
    sql = f"SELECT {', '.join(EVENT_COLUMNS)} FROM honeypot_events WHERE id = $1"
    row = await conn.fetchrow(sql, event_id)
    if row is None:
        return None
    detail = _row_to_dict(row)
    responses = await conn.fetch(
        "SELECT id, event_id, timestamp, action_type, actor, status, "
        "evidence_uri, details, created_at FROM responses "
        "WHERE event_id = $1 ORDER BY timestamp DESC, id DESC",
        event_id,
    )
    detail["responses"] = [
        _map_response(r) for r in responses
    ]
    return detail


def _map_response(row) -> dict:
    d = dict(row)
    d["details"] = _loads_json(d.get("details"))
    return d