"""IoC repository: list/filter the iocs table (read-only)."""

def _build_where(ioc_type, severity, search):
    clauses = []
    params = []
    if ioc_type:
        params.append(ioc_type)
        clauses.append(f"ioc_type = ${len(params)}")
    if severity:
        params.append(severity)
        clauses.append(f"severity = ${len(params)}")
    if search:
        params.append(f"%{search}%")
        clauses.append(f"ioc_value ILIKE ${len(params)}")
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return where, params


async def list_iocs(conn, ioc_type, severity, search, page, page_size) -> list[dict]:
    where, params = _build_where(ioc_type, severity, search)
    params.append(page_size)
    params.append((page - 1) * page_size)
    sql = (
        "SELECT id, ioc_type, ioc_value, first_seen, last_seen, source, severity, "
        "COALESCE(tags, '{}') AS tags, notes FROM iocs "
        f"{where} ORDER BY id DESC "
        f"LIMIT ${len(params) - 1} OFFSET ${len(params)}"
    )
    rows = await conn.fetch(sql, *params)
    return [dict(r) for r in rows]


async def count_iocs(conn, ioc_type, severity, search) -> int:
    where, params = _build_where(ioc_type, severity, search)
    return await conn.fetchval(f"SELECT COUNT(*) FROM iocs {where}", *params)