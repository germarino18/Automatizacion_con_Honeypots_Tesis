"""MITRE ATT&CK repository: techniques observed in a range + embedded catalog.

The catalog (api/app/data/mitre_catalog.json) maps technique ids to a static
tactic/name pair for offline use.
"""

import json
from functools import lru_cache
from pathlib import Path

CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "mitre_catalog.json"


@lru_cache(maxsize=1)
def load_catalog() -> dict:
    with CATALOG_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


def get_technique_metadata(technique: str) -> dict | None:
    return load_catalog().get(technique)


async def list_techniques(conn, from_, to) -> list[dict]:
    clauses = []
    params = []
    if from_ is not None:
        params.append(from_)
        clauses.append(f"timestamp >= ${len(params)}")
    if to is not None:
        params.append(to)
        clauses.append(f"timestamp <= ${len(params)}")
    clauses.append("att_ck_technique IS NOT NULL AND att_ck_technique <> ''")
    where = f"WHERE {' AND '.join(clauses)}"
    sql = (
        f"SELECT att_ck_technique AS technique, COUNT(*) AS count "
        f"FROM honeypot_events {where} "
        "GROUP BY att_ck_technique ORDER BY count DESC, technique ASC"
    )
    rows = await conn.fetch(sql, *params)
    return [dict(r) for r in rows]