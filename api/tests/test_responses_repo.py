"""Repository tests for responses.py (task 3.7)."""

from datetime import datetime, timedelta, timezone

import pytest

from app.repositories import responses as repo
from tests.conftest import insert_event, insert_response

BASE = datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_list_responses_ordered_by_timestamp_desc(conn):
    await insert_response(conn, action_type="bloqueo", timestamp=BASE)
    await insert_response(conn, action_type="alerta", timestamp=BASE + timedelta(hours=1))
    await insert_response(conn, action_type="playbook", timestamp=BASE + timedelta(hours=2))

    items = await repo.list_responses(conn, {}, 1, 50)

    assert [r["action_type"] for r in items] == ["playbook", "alerta", "bloqueo"]


@pytest.mark.asyncio
async def test_filter_by_action_type(conn):
    await insert_response(conn, action_type="bloqueo")
    await insert_response(conn, action_type="alerta")
    await insert_response(conn, action_type="bloqueo")

    items = await repo.list_responses(conn, {"action_type": "bloqueo"}, 1, 50)

    assert len(items) == 2
    assert all(r["action_type"] == "bloqueo" for r in items)


@pytest.mark.asyncio
async def test_filter_by_status(conn):
    await insert_response(conn, status="completed")
    await insert_response(conn, status="failed")

    items = await repo.list_responses(conn, {"status": "failed"}, 1, 50)

    assert len(items) == 1
    assert items[0]["status"] == "failed"


@pytest.mark.asyncio
async def test_filter_by_event_id(conn):
    ev1 = await insert_event(conn, src_ip="1.1.1.1")
    ev2 = await insert_event(conn, src_ip="2.2.2.2")
    await insert_response(conn, event_id=ev1["id"])
    await insert_response(conn, event_id=ev1["id"])
    await insert_response(conn, event_id=ev2["id"])

    items = await repo.list_responses(conn, {"event_id": ev1["id"]}, 1, 50)

    assert len(items) == 2
    assert all(r["event_id"] == ev1["id"] for r in items)


@pytest.mark.asyncio
async def test_filter_by_date_range(conn):
    await insert_response(conn, timestamp=BASE)
    await insert_response(conn, timestamp=BASE + timedelta(days=10))
    await insert_response(conn, timestamp=BASE + timedelta(days=30))

    filters = {"from_": BASE + timedelta(days=5), "to": BASE + timedelta(days=20)}
    items = await repo.list_responses(conn, filters, 1, 50)

    assert len(items) == 1


@pytest.mark.asyncio
async def test_combined_filters(conn):
    await insert_response(conn, action_type="bloqueo", status="completed")
    await insert_response(conn, action_type="alerta", status="completed")
    await insert_response(conn, action_type="bloqueo", status="failed")

    items = await repo.list_responses(
        conn, {"action_type": "bloqueo", "status": "completed"}, 1, 50
    )

    assert len(items) == 1
    assert items[0]["action_type"] == "bloqueo"
    assert items[0]["status"] == "completed"


@pytest.mark.asyncio
async def test_pagination_and_count(conn):
    for i in range(5):
        await insert_response(conn, action_type="alerta")

    page1 = await repo.list_responses(conn, {}, 1, 2)
    page3 = await repo.list_responses(conn, {}, 3, 2)
    total = await repo.count_responses(conn, {})

    assert len(page1) == 2
    assert len(page3) == 1
    assert total == 5


@pytest.mark.asyncio
async def test_empty_table(conn):
    items = await repo.list_responses(conn, {}, 1, 50)
    total = await repo.count_responses(conn, {})
    assert items == []
    assert total == 0