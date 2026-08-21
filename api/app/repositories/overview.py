"""Overview repository: SOC metrics aggregates for a time range.

MTTD = AVG(created_at - timestamp) over honeypot_events.
MTTR = AVG(response.timestamp - event.timestamp) over responses joined to
       their event (NULL when there is no response data).
Critical alerts = events with risk_score in the critical bucket, most recent
first (bounded list).
"""

from ..services.severity import BUCKETS, severity_for

CRITICAL_LOW = next(b[1] for b in BUCKETS if b[0] == "critical")

TOP_IPS_LIMIT = 10
CRITICAL_ALERTS_LIMIT = 10


def _range_clause(alias, from_, to):
    clauses = []
    params = []
    if from_ is not None:
        params.append(from_)
        clauses.append(f"{alias} >= ${len(params)}")
    if to is not None:
        params.append(to)
        clauses.append(f"{alias} <= ${len(params)}")
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return where, params


async def get_overview(conn, from_, to) -> dict:
    where, range_params = _range_clause("timestamp", from_, to)

    total_eventos = await conn.fetchval(
        f"SELECT COUNT(*) FROM honeypot_events {where}", *range_params
    )
    ips_unicas = await conn.fetchval(
        f"SELECT COUNT(DISTINCT src_ip) FROM honeypot_events {where}", *range_params
    )

    breakdown_rows = await conn.fetch(
        f"SELECT source_honeypot, COUNT(*) AS count FROM honeypot_events {where} "
        "GROUP BY source_honeypot ORDER BY count DESC",
        *range_params,
    )
    eventos_por_honeypot = [
        {"source_honeypot": r["source_honeypot"], "count": r["count"]}
        for r in breakdown_rows
    ]

    top_ips = await _top_ips(conn, range_params)
    alertas_criticas = await _critical_alerts(conn, range_params)

    total_malware = await conn.fetchval(
        "SELECT COUNT(*) FROM honeypot_events WHERE malware_hash IS NOT NULL "
        + (f" AND {' AND '.join(f'timestamp >= ${i}' if i == 1 else f'timestamp <= ${i}' for i in range(1, len(range_params) + 1))}" if range_params else ""),
        *range_params,
    )

    mttd_seconds = await conn.fetchval(
        f"SELECT AVG(EXTRACT(EPOCH FROM (created_at - timestamp))) "
        f"FROM honeypot_events {where}",
        *range_params,
    )
    mttr_seconds = await conn.fetchval(
        "SELECT AVG(EXTRACT(EPOCH FROM (r.timestamp - e.timestamp))) "
        "FROM responses r JOIN honeypot_events e ON e.id = r.event_id "
        "WHERE e.timestamp IS NOT NULL AND r.timestamp IS NOT NULL "
        + (f" AND {' AND '.join(f'e.timestamp >= ${i}' if i == 1 else f'e.timestamp <= ${i}' for i in range(1, len(range_params) + 1))}" if range_params else ""),
        *range_params,
    )

    return {
        "total_eventos": total_eventos or 0,
        "ips_unicas": ips_unicas or 0,
        "eventos_por_honeypot": eventos_por_honeypot,
        "top_ips": top_ips,
        "alertas_criticas": alertas_criticas,
        "total_malware": total_malware or 0,
        "mttd_seconds": float(mttd_seconds) if mttd_seconds is not None else None,
        "mttr_seconds": float(mttr_seconds) if mttr_seconds is not None else None,
    }


async def _top_ips(conn, range_params):
    params = list(range_params)
    sql = (
        "SELECT src_ip, COUNT(*) AS total_ataques, "
        "COUNT(DISTINCT att_ck_technique) AS tecnicas_usadas, "
        "MAX(risk_score) AS max_riesgo, AVG(risk_score) AS riesgo_promedio, "
        "MIN(timestamp) AS primer_ataque, MAX(timestamp) AS ultimo_ataque "
        "FROM honeypot_events"
    )
    if params:
        sql += " WHERE " + _rebuild_range_where(params, "timestamp")
    params.append(TOP_IPS_LIMIT)
    sql += f" GROUP BY src_ip ORDER BY total_ataques DESC LIMIT ${len(params)}"
    rows = await conn.fetch(sql, *params)
    result = []
    for r in rows:
        d = dict(r)
        d["src_ip"] = str(d["src_ip"])
        if d.get("max_riesgo") is not None:
            d["max_riesgo"] = float(d["max_riesgo"])
        if d.get("riesgo_promedio") is not None:
            d["riesgo_promedio"] = float(d["riesgo_promedio"])
        result.append(d)
    return result


async def _critical_alerts(conn, range_params):
    params = [CRITICAL_LOW] + list(range_params)
    sql = (
        "SELECT id, timestamp, source_honeypot, src_ip, att_ck_technique, risk_score "
        "FROM honeypot_events WHERE risk_score >= $1"
    )
    if range_params:
        sql += " AND " + _rebuild_range_where(params, "timestamp", start_index=2)
    params.append(CRITICAL_ALERTS_LIMIT)
    sql += f" ORDER BY timestamp DESC, id DESC LIMIT ${len(params)}"
    rows = await conn.fetch(sql, *params)
    result = []
    for r in rows:
        d = dict(r)
        d["src_ip"] = str(d["src_ip"])
        if d.get("risk_score") is not None:
            d["risk_score"] = float(d["risk_score"])
        d["severity"] = severity_for(d.get("risk_score"))
        result.append(d)
    return result


def _rebuild_range_where(params, column, start_index=1):
    """Rebuild 'column >= $i AND column <= $j' for the range params already
    in `params` (they occupy positions start_index..)."""
    n = len(params) - (start_index - 1)
    clauses = []
    for offset in range(n):
        clauses.append(f"{column} {'>=' if offset == 0 else '<='} ${start_index + offset}")
    return " AND ".join(clauses)