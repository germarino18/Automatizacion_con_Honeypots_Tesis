"""Repository tests for geo.py (task 3.5)."""

import pytest

from app.repositories import geo as repo
from tests.conftest import insert_event


@pytest.mark.asyncio
async def test_countries_extracted_from_enrichment_data(conn):
    await insert_event(conn, src_ip="1.1.1.1", enrichment_data={"country": "AR"})
    await insert_event(conn, src_ip="2.2.2.2", enrichment_data={"country": "BR"})
    await insert_event(conn, src_ip="3.3.3.3", enrichment_data={"country": "AR"})

    result = await repo.list_countries(conn, None, None)

    assert result["fallback_used"] is False
    assert result["total"] == 3
    assert [(c["country"], c["count"]) for c in result["countries"]] == [
        ("AR", 2),
        ("BR", 1),
    ]


@pytest.mark.asyncio
async def test_countries_from_nested_geo_path(conn):
    await insert_event(
        conn, src_ip="1.1.1.1", enrichment_data={"geo": {"country": "DE"}}
    )

    result = await repo.list_countries(conn, None, None)

    assert result["countries"] == [{"country": "DE", "count": 1}]


@pytest.mark.asyncio
async def test_no_geo_data_falls_back_to_ip_ranges(conn):
    await insert_event(conn, src_ip="8.8.8.8")   # US range
    await insert_event(conn, src_ip="5.188.206.7")  # RU range
    await insert_event(conn, src_ip="8.8.8.9")   # US range

    result = await repo.list_countries(conn, None, None)

    assert result["fallback_used"] is True
    assert result["total"] == 3
    assert [(c["country"], c["count"]) for c in result["countries"]] == [
        ("US", 2),
        ("RU", 1),
    ]


@pytest.mark.asyncio
async def test_mixed_geo_and_unknown_keeps_desconocido_bucket(conn):
    await insert_event(conn, src_ip="8.8.8.8", enrichment_data={"country": "AR"})
    await insert_event(conn, src_ip="9.9.9.9")  # no geo -> Desconocido

    result = await repo.list_countries(conn, None, None)

    assert result["fallback_used"] is False
    by_country = {c["country"]: c["count"] for c in result["countries"]}
    assert by_country == {"AR": 1, "Desconocido": 1}


@pytest.mark.asyncio
async def test_empty_table_returns_empty(conn):
    result = await repo.list_countries(conn, None, None)
    assert result["countries"] == []
    assert result["total"] == 0
    assert result["fallback_used"] is False


def test_country_for_ip_known_and_unknown():
    assert repo.country_for_ip("8.8.8.8") == "US"
    assert repo.country_for_ip("5.188.206.7") == "RU"
    assert repo.country_for_ip("192.168.1.1") is None