"""Repository tests for overview.py (task 3.3)."""

from datetime import datetime, timedelta, timezone

import pytest

from app.repositories import overview as repo
from tests.conftest import insert_event, insert_response

BASE = datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_overview_empty_range_returns_zeros(conn):
    data = await repo.get_overview(conn, None, None)

    assert data["total_eventos"] == 0
    assert data["ips_unicas"] == 0
    assert data["eventos_por_honeypot"] == []
    assert data["top_ips"] == []
    assert data["alertas_criticas"] == []
    assert data["total_malware"] == 0
    assert data["mttd_seconds"] is None
    assert data["mttr_seconds"] is None


@pytest.mark.asyncio
async def test_overview_totals_and_honeypot_breakdown(conn):
    await insert_event(conn, source_honeypot="cowrie", src_ip="1.1.1.1")
    await insert_event(conn, source_honeypot="cowrie", src_ip="1.1.1.1")
    await insert_event(conn, source_honeypot="dionaea", src_ip="2.2.2.2")

    data = await repo.get_overview(conn, None, None)

    assert data["total_eventos"] == 3
    assert data["ips_unicas"] == 2
    breakdown = {b["source_honeypot"]: b["count"] for b in data["eventos_por_honeypot"]}
    assert breakdown == {"cowrie": 2, "dionaea": 1}


@pytest.mark.asyncio
async def test_top_ips_ordered_by_attack_count(conn):
    for _ in range(3):
        await insert_event(conn, src_ip="9.9.9.9", risk_score=0.8, att_ck_technique="T1059")
    for _ in range(1):
        await insert_event(conn, src_ip="8.8.8.8", risk_score=0.2)

    data = await repo.get_overview(conn, None, None)
    assert [t["src_ip"] for t in data["top_ips"]] == ["9.9.9.9", "8.8.8.8"]
    top = data["top_ips"][0]
    assert top["total_ataques"] == 3
    assert top["max_riesgo"] == 0.8
    assert top["riesgo_promedio"] == pytest.approx(0.8)
    assert top["tecnicas_usadas"] == 1


@pytest.mark.asyncio
async def test_critical_alerts_only_critical_bucket(conn):
    await insert_event(conn, risk_score=0.90, src_ip="1.1.1.1", att_ck_technique="T1190")
    await insert_event(conn, risk_score=0.86, src_ip="2.2.2.2")
    await insert_event(conn, risk_score=0.70, src_ip="3.3.3.3")

    data = await repo.get_overview(conn, None, None)

    assert [a["src_ip"] for a in data["alertas_criticas"]] == ["2.2.2.2", "1.1.1.1"]
    for alert in data["alertas_criticas"]:
        assert alert["risk_score"] >= 0.85


@pytest.mark.asyncio
async def test_total_malware_counts_non_null_hashes(conn):
    await insert_event(conn, malware_hash="a" * 64, src_ip="1.1.1.1")
    await insert_event(conn, malware_hash="b" * 64, src_ip="2.2.2.2")
    await insert_event(conn, src_ip="3.3.3.3")

    data = await repo.get_overview(conn, None, None)
    assert data["total_malware"] == 2


@pytest.mark.asyncio
async def test_mttd_computed_from_created_at_minus_timestamp(conn):
    await insert_event(
        conn,
        timestamp=BASE,
        created_at=BASE + timedelta(minutes=5),
        src_ip="1.1.1.1",
    )
    data = await repo.get_overview(conn, None, None)
    assert data["mttd_seconds"] == pytest.approx(300.0)


@pytest.mark.asyncio
async def test_mttr_computed_from_response_delta(conn):
    ev = await insert_event(conn, timestamp=BASE, src_ip="1.1.1.1")
    await insert_response(
        conn, event_id=ev["id"], action_type="bloqueo", timestamp=BASE + timedelta(minutes=10)
    )
    data = await repo.get_overview(conn, None, None)
    assert data["mttr_seconds"] == pytest.approx(600.0)


@pytest.mark.asyncio
async def test_mttr_null_when_no_responses(conn):
    await insert_event(conn, src_ip="1.1.1.1")
    data = await repo.get_overview(conn, None, None)
    assert data["mttr_seconds"] is None


@pytest.mark.asyncio
async def test_overview_range_filters(conn):
    await insert_event(conn, timestamp=BASE, src_ip="1.1.1.1")
    await insert_event(conn, timestamp=BASE + timedelta(days=30), src_ip="2.2.2.2")

    data = await repo.get_overview(
        conn, BASE - timedelta(days=1), BASE + timedelta(days=1)
    )

    assert data["total_eventos"] == 1
    assert data["ips_unicas"] == 1


@pytest.mark.asyncio
async def test_eventos_por_hora_returns_24_utc_buckets(conn):
    anchor = datetime(2026, 2, 1, 12, 0, 0, tzinfo=timezone.utc)

    # Dos eventos en dos horas distintas dentro de la ventana de 24h.
    await insert_event(conn, timestamp=anchor - timedelta(hours=20), src_ip="1.1.1.1")
    await insert_event(conn, timestamp=anchor - timedelta(hours=20), src_ip="2.2.2.2")
    await insert_event(conn, timestamp=anchor - timedelta(hours=3), src_ip="3.3.3.3")

    data = await repo.get_overview(conn, None, anchor)

    buckets = data["eventos_por_hora"]
    assert len(buckets) == 24
    # Los buckets vienen ordenados ascendentemente y cada uno es una hora UTC.
    hours = [b["hour"] for b in buckets]
    for i in range(1, len(hours)):
        assert hours[i] - hours[i - 1] == timedelta(hours=1)
    assert hours[0] == anchor.replace(minute=0, second=0, microsecond=0) - timedelta(hours=23)
    assert hours[-1] == anchor.replace(minute=0, second=0, microsecond=0)

    by_hour = {b["hour"]: b["count"] for b in buckets}
    # anchor-20h cae en hours[0]+3h; anchor-3h cae en hours[0]+20h.
    assert by_hour[hours[0] + timedelta(hours=3)] == 2
    assert by_hour[hours[0] + timedelta(hours=20)] == 1
    # El resto de los buckets queda en cero.
    assert sum(by_hour.values()) == 3


@pytest.mark.asyncio
async def test_eventos_por_hora_empty_returns_24_zero_buckets(conn):
    anchor = datetime(2026, 2, 1, 12, 0, 0, tzinfo=timezone.utc)

    data = await repo.get_overview(conn, None, anchor)

    buckets = data["eventos_por_hora"]
    assert len(buckets) == 24
    assert all(b["count"] == 0 for b in buckets)


@pytest.mark.asyncio
async def test_bloqueos_ufw_counts_block_automation_actions(conn):
    await insert_response(conn, action_type="bloqueo", status="completed")
    await insert_response(conn, action_type="bloqueo", status="completed")
    await insert_response(conn, action_type="alerta", status="completed")
    await insert_response(conn, action_type="bloqueo", status="failed")

    data = await repo.get_overview(conn, None, None)

    assert data["bloqueos_ufw"] == 3


@pytest.mark.asyncio
async def test_full_overview_includes_trend_and_bloqueos_keys(conn):
    data = await repo.get_overview(conn, None, None)

    assert "eventos_por_hora" in data
    assert "bloqueos_ufw" in data
    assert isinstance(data["bloqueos_ufw"], int)
    assert isinstance(data["eventos_por_hora"], list)