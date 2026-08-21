"""Geolocation repository (best-effort, spec api-soc).

Primary source: country extracted from enrichment_data (JSONB) trying
several common paths. When NO geo data exists in the range, falls back to
the embedded IP-range table (api/app/data/ip_ranges.json) to classify
source IPs into countries. Results are ordered by count descending.
"""

import ipaddress
import json
from functools import lru_cache
from pathlib import Path

RANGES_PATH = Path(__file__).resolve().parent.parent / "data" / "ip_ranges.json"

COUNTRY_PATHS = (
    "{country}",
    "{geo,country}",
    "{geolocation,country}",
    "{abuseipdb,country}",
    "{virustotal,country}",
    "{location,country}",
)


@lru_cache(maxsize=1)
def load_ranges() -> dict[str, list[str]]:
    with RANGES_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


@lru_cache(maxsize=1024)
def country_for_ip(ip: str) -> str | None:
    """Classify an IP against the embedded range table (best-effort fallback).

    Cached: src_ips repeat across events (esp. scanners), so a linear scan of
    ~110k networks is amortized per unique IP instead of per event.
    """
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return None
    for country, ranges in load_ranges().items():
        for cidr in ranges:
            if addr in ipaddress.ip_network(cidr, strict=False):
                return country
    return None


def _range_clause(from_, to):
    clauses = []
    params = []
    if from_ is not None:
        params.append(from_)
        clauses.append(f"timestamp >= ${len(params)}")
    if to is not None:
        params.append(to)
        clauses.append(f"timestamp <= ${len(params)}")
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return where, params


def _extract_expression() -> str:
    parts = [f"NULLIF(enrichment_data #>> '{p}', '')" for p in COUNTRY_PATHS]
    return f"COALESCE({', '.join(parts)})"


async def list_countries(conn, from_, to) -> dict:
    where, params = _range_clause(from_, to)
    sql = (
        f"SELECT COALESCE(NULLIF({_extract_expression()}, ''), 'Desconocido') AS country, "
        f"COUNT(*) AS count FROM honeypot_events {where} "
        "GROUP BY 1 ORDER BY count DESC, country ASC"
    )
    rows = await conn.fetch(sql, *params)
    countries = [dict(r) for r in rows]

    has_real_geo = any(c["country"] != "Desconocido" for c in countries)

    if not has_real_geo and countries:
        return await _ip_range_fallback(conn, where, params)

    return {
        "countries": countries,
        "total": sum(c["count"] for c in countries),
        "fallback_used": False,
    }


async def _ip_range_fallback(conn, where, params):
    sql = (
        f"SELECT src_ip, COUNT(*) AS count FROM honeypot_events {where} "
        "GROUP BY src_ip"
    )
    rows = await conn.fetch(sql, *params)
    per_country: dict[str, int] = {}
    for r in rows:
        country = country_for_ip(str(r["src_ip"])) or "Desconocido"
        per_country[country] = per_country.get(country, 0) + r["count"]
    countries = [
        {"country": k, "count": v}
        for k, v in sorted(per_country.items(), key=lambda item: (-item[1], item[0]))
    ]
    return {
        "countries": countries,
        "total": sum(c["count"] for c in countries),
        "fallback_used": True,
    }