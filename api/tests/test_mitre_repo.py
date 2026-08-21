"""Repository tests for mitre.py (task 3.4)."""

from datetime import datetime, timedelta, timezone

import pytest

from app.repositories import mitre as repo
from tests.conftest import insert_event

BASE = datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_techniques_grouped_with_counts(conn):
    await insert_event(conn, att_ck_technique="T1059", src_ip="1.1.1.1")
    await insert_event(conn, att_ck_technique="T1059", src_ip="2.2.2.2")
    await insert_event(conn, att_ck_technique="T1190", src_ip="3.3.3.3")

    items = await repo.list_techniques(conn, None, None)

    by_tech = {t["technique"]: t["count"] for t in items}
    assert by_tech == {"T1059": 2, "T1190": 1}


@pytest.mark.asyncio
async def test_techniques_empty_when_no_data(conn):
    items = await repo.list_techniques(conn, None, None)
    assert items == []


@pytest.mark.asyncio
async def test_techniques_range_filter(conn):
    await insert_event(conn, timestamp=BASE, att_ck_technique="T1059", src_ip="1.1.1.1")
    await insert_event(conn, timestamp=BASE + timedelta(days=30), att_ck_technique="T1190", src_ip="2.2.2.2")

    items = await repo.list_techniques(
        conn, BASE - timedelta(days=1), BASE + timedelta(days=1)
    )

    assert [t["technique"] for t in items] == ["T1059"]


def test_catalog_loads_metadata():
    meta = repo.get_technique_metadata("T1059")
    assert meta == {"tactic": "Execution", "name": "Command and Scripting Interpreter"}


def test_catalog_unknown_technique_returns_none():
    assert repo.get_technique_metadata("T9999") is None


def test_catalog_contains_expected_ids():
    catalog = repo.load_catalog()
    assert "T1059" in catalog
    assert "T1190" in catalog