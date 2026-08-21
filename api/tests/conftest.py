"""Shared pytest fixtures for the soc-api test suite.

The tests run against a throwaway PostgreSQL container (soc-test-postgres,
exposed on 127.0.0.1:54329). The credentials below are TEST-ONLY and belong to
that local container; they are never production credentials and are not read
from .env.
"""

import json
import os
from datetime import datetime

import asyncpg
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

TEST_ENV = {
    "POSTGRES_HOST": "127.0.0.1",
    "POSTGRES_PORT": "54329",
    "POSTGRES_USER": "soc_test",
    "POSTGRES_PASSWORD": "soc_test_pw",
    "POSTGRES_DB": "soc_test",
    "SOC_ADMIN_USER": "socadmin",
    "SOC_ADMIN_PASSWORD": "soc-admin-pass",
    "SOC_JWT_SECRET": "test-jwt-secret-only-for-ci-0123456789",
    "JWT_EXPIRES_MINUTES": "480",
    "N8N_BASIC_AUTH_USER": "n8n-test-user",
    "N8N_BASIC_AUTH_PASSWORD": "n8n-test-pass",
    "N8N_INTERNAL_URL": "http://n8n:5678",
}
for _k, _v in TEST_ENV.items():
    os.environ.setdefault(_k, _v)

from app import config, db  # noqa: E402
from app.main import app  # noqa: E402

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS honeypot_events (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source_honeypot VARCHAR(50) NOT NULL,
    src_ip INET NOT NULL,
    dst_port INTEGER,
    protocol VARCHAR(20),
    username VARCHAR(100),
    commands TEXT,
    malware_hash VARCHAR(64),
    malware_filename VARCHAR(255),
    playbook_id VARCHAR(50),
    risk_score DECIMAL(3,2) DEFAULT 0.00,
    att_ck_technique VARCHAR(20),
    enrichment_data JSONB,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS responses (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES honeypot_events(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    action_type VARCHAR(50) NOT NULL,
    actor VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    evidence_uri TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS iocs (
    id SERIAL PRIMARY KEY,
    ioc_type VARCHAR(20) NOT NULL,
    ioc_value TEXT NOT NULL,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE,
    source VARCHAR(50),
    severity VARCHAR(20) DEFAULT 'medium',
    tags TEXT[],
    notes TEXT,
    UNIQUE(ioc_type, ioc_value)
);

CREATE TABLE IF NOT EXISTS attack_sessions (
    id SERIAL PRIMARY KEY,
    src_ip INET NOT NULL,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE,
    total_events INTEGER DEFAULT 0,
    techniques_detected TEXT[],
    risk_score DECIMAL(3,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB
);

CREATE OR REPLACE VIEW metrics_summary AS
SELECT DATE(timestamp) as fecha, COUNT(*) as total_eventos,
       COUNT(DISTINCT src_ip) as ips_unicas,
       COUNT(DISTINCT att_ck_technique) as tecnicas_detectadas,
       AVG(risk_score) as riesgo_promedio, MAX(risk_score) as riesgo_maximo
FROM honeypot_events GROUP BY DATE(timestamp) ORDER BY fecha DESC;

CREATE OR REPLACE VIEW top_attackers AS
SELECT src_ip, COUNT(*) as total_ataques,
       COUNT(DISTINCT att_ck_technique) as tecnicas_usadas,
       MAX(risk_score) as max_riesgo, AVG(risk_score) as riesgo_promedio,
       MIN(timestamp) as primer_ataque, MAX(timestamp) as ultimo_ataque
FROM honeypot_events GROUP BY src_ip ORDER BY total_ataques DESC;
"""

TRUNCATE_SQL = (
    "TRUNCATE honeypot_events, responses, iocs, attack_sessions RESTART IDENTITY CASCADE"
)


async def _ensure_schema():
    conn = await asyncpg.connect(db.get_dsn())
    try:
        await conn.execute(SCHEMA_SQL)
    finally:
        await conn.close()


async def _truncate(pool):
    async with pool.acquire() as conn:
        await conn.execute(TRUNCATE_SQL)


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def db_pool():
    await _ensure_schema()
    pool = await db.create_pool()
    yield pool
    await db.close_pool()


@pytest_asyncio.fixture(autouse=True, loop_scope="session")
async def _clean_tables(db_pool):
    await _truncate(db_pool)
    yield
    await _truncate(db_pool)


@pytest_asyncio.fixture
async def client(db_pool):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def conn(db_pool):
    async with db_pool.acquire() as c:
        yield c


@pytest_asyncio.fixture
async def auth_client(client):
    """AsyncClient already authenticated via the session cookie."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "username": TEST_ENV["SOC_ADMIN_USER"],
            "password": TEST_ENV["SOC_ADMIN_PASSWORD"],
        },
    )
    assert resp.status_code == 200, resp.text
    yield client


EVENT_COLUMNS = (
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
)

DEFAULT_EVENT = {
    "timestamp": "2026-01-01T00:00:00+00:00",
    "source_honeypot": "cowrie",
    "src_ip": "1.2.3.4",
    "dst_port": 22,
    "protocol": "ssh",
    "username": "root",
    "commands": None,
    "malware_hash": None,
    "malware_filename": None,
    "playbook_id": None,
    "risk_score": 0.5,
    "att_ck_technique": None,
    "enrichment_data": None,
    "raw_data": None,
}


async def insert_event(conn, **overrides) -> dict:
    """Insert a honeypot event with parameterized SQL and return the row."""
    values = dict(DEFAULT_EVENT)
    values.update(overrides)
    if isinstance(values["timestamp"], str):
        values["timestamp"] = datetime.fromisoformat(
            values["timestamp"].replace("Z", "+00:00")
        )
    for col in ("enrichment_data", "raw_data"):
        if isinstance(values[col], dict):
            values[col] = json.dumps(values[col])
    columns = list(EVENT_COLUMNS)
    if values.get("created_at") is not None:
        columns.append("created_at")
    params = [values[c] for c in columns]
    placeholders = ", ".join(f"${i}" for i in range(1, len(params) + 1))
    row = await conn.fetchrow(
        f"INSERT INTO honeypot_events ({', '.join(columns)}) "
        f"VALUES ({placeholders}) RETURNING *",
        *params,
    )
    return dict(row)


async def insert_response(conn, **overrides) -> dict:
    defaults = {
        "event_id": None,
        "action_type": "bloqueo",
        "actor": "n8n-automated",
        "status": "completed",
        "evidence_uri": None,
        "details": None,
    }
    defaults.update(overrides)
    if isinstance(defaults["details"], dict):
        defaults["details"] = json.dumps(defaults["details"])
    columns = ["event_id", "action_type", "actor", "status", "evidence_uri", "details"]
    if defaults.get("timestamp") is not None:
        columns.append("timestamp")
    params = [defaults[c] for c in columns]
    placeholders = ", ".join(f"${i}" for i in range(1, len(params) + 1))
    row = await conn.fetchrow(
        f"INSERT INTO responses ({', '.join(columns)}) "
        f"VALUES ({placeholders}) RETURNING *",
        *params,
    )
    return dict(row)


async def insert_ioc(conn, **overrides) -> dict:
    defaults = {
        "ioc_type": "ip",
        "ioc_value": "9.9.9.9",
        "source": "honeypot",
        "severity": "high",
        "tags": ["scanner"],
        "notes": None,
    }
    defaults.update(overrides)
    row = await conn.fetchrow(
        "INSERT INTO iocs (ioc_type, ioc_value, source, severity, tags, notes) "
        "VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
        defaults["ioc_type"], defaults["ioc_value"], defaults["source"],
        defaults["severity"], defaults["tags"], defaults["notes"],
    )
    return dict(row)