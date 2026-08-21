"""SSE live feed tests (tasks 5.1-5.4).

httpx's ASGITransport buffers the whole response body before returning, so an
infinite SSE stream cannot be exercised through it. The ``SSEHarness`` below
drives the ASGI app directly, consuming body chunks incrementally and closing
the stream the way a real browser does on disconnect.
"""

import asyncio
import json
import time
from contextlib import suppress
from datetime import datetime, timezone

import pytest

from app import config
from app.main import app
from app.services.auth import create_token
from app.services.live import event_stream, format_event_frame, format_ping
from tests.conftest import TEST_ENV, insert_event


def parse_frame(frame: str) -> tuple[str, str]:
    """Split an SSE frame into (event, data)."""
    event = None
    data = ""
    for line in frame.split("\n"):
        if line.startswith("event:"):
            event = line.split(":", 1)[1].strip()
        elif line.startswith("data:"):
            data = line.split(":", 1)[1].strip()
    return event, data


class SSEHarness:
    """Drive ``app`` directly to subscribe to /events/live as a client.

    Captures status/headers from the response start message, buffers body
    chunks into a queue, and cancels the task on close (client disconnect).
    """

    def __init__(self, token: str):
        self.queue: asyncio.Queue[str] = asyncio.Queue()
        self._task: asyncio.Task | None = None
        self.error: BaseException | None = None
        self.status_code: int | None = None
        self.headers: dict[str, str] = {}
        self._token = token

    async def start(self) -> "SSEHarness":
        self._task = asyncio.create_task(self._run())
        return self

    def _scope(self):
        return {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.4"},
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": "/api/v1/events/live",
            "raw_path": b"/api/v1/events/live",
            "query_string": b"",
            "root_path": "",
            "headers": [
                (b"authorization", f"Bearer {self._token}".encode()),
                (b"host", b"test"),
            ],
            "server": ("test", 80),
            "client": ("127.0.0.1", 40000),
            "state": {},
        }

    async def _run(self):
        async def send(message):
            if message["type"] == "http.response.start":
                self.status_code = message.get("status")
                self.headers = {
                    k.decode(): v.decode()
                    for k, v in message.get("headers", [])
                }
            elif message["type"] == "http.response.body":
                body = message.get("body", b"")
                if body:
                    await self.queue.put(body.decode("utf-8"))

        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        try:
            await app(self._scope(), receive, send)
        except asyncio.CancelledError:
            raise
        except BaseException as exc:
            self.error = exc

    async def next_frame(self, timeout: float = 5.0) -> str:
        return await asyncio.wait_for(self.queue.get(), timeout)

    async def next_event(self, event_name: str, timeout: float = 5.0) -> str:
        async def _read():
            while True:
                frame = await self.queue.get()
                evt, data = parse_frame(frame)
                if evt == event_name:
                    return data

        return await asyncio.wait_for(_read(), timeout)

    async def close(self):
        if self._task is not None:
            self._task.cancel()
            with suppress(asyncio.CancelledError):
                await self._task
            self._task = None


def _token() -> str:
    return create_token(TEST_ENV["SOC_ADMIN_USER"])


# --- 5.1 / 5.2: frame formatting and generator behavior ---------------------


def test_format_event_frame_shape():
    frame = format_event_frame({"id": 7, "source_honeypot": "cowrie"})

    assert frame.startswith("event: event\n")
    assert "data: " in frame
    assert frame.endswith("\n\n")
    payload = json.loads(frame.split("data: ", 1)[1].strip())
    assert payload["id"] == 7
    assert payload["source_honeypot"] == "cowrie"


def test_format_event_frame_serializes_datetimes():
    frame = format_event_frame(
        {"id": 1, "timestamp": datetime(2026, 1, 1, tzinfo=timezone.utc)}
    )
    payload = json.loads(frame.split("data: ", 1)[1].strip())
    assert payload["timestamp"].startswith("2026-01-01")


def test_format_ping_shape():
    assert format_ping() == "event: ping\ndata: {}\n\n"


@pytest.mark.asyncio
async def test_event_stream_emits_ping_when_no_events(conn, monkeypatch):
    monkeypatch.setattr(config.settings, "sse_poll_interval_seconds", 0.05)
    monkeypatch.setattr(config.settings, "sse_heartbeat_seconds", 0.2)

    gen = event_stream(conn)
    frame = await asyncio.wait_for(anext(gen), 3.0)

    evt, data = parse_frame(frame)
    assert evt == "ping"
    assert data == "{}"
    await gen.aclose()


@pytest.mark.asyncio
async def test_event_stream_emits_events_in_id_order(conn, monkeypatch):
    monkeypatch.setattr(config.settings, "sse_poll_interval_seconds", 0.05)
    monkeypatch.setattr(config.settings, "sse_heartbeat_seconds", 60.0)
    await insert_event(conn, src_ip="1.1.1.1")
    await insert_event(conn, src_ip="2.2.2.2")

    gen = event_stream(conn)
    ids = []

    async def collect():
        async for frame in gen:
            evt, data = parse_frame(frame)
            if evt == "event":
                ids.append(json.loads(data)["id"])
                if len(ids) == 2:
                    break

    await asyncio.wait_for(collect(), 5.0)
    assert ids == [1, 2]
    await gen.aclose()


@pytest.mark.asyncio
async def test_event_stream_continues_after_batch_limit(conn, monkeypatch):
    monkeypatch.setattr(config.settings, "sse_poll_interval_seconds", 0.05)
    monkeypatch.setattr(config.settings, "sse_heartbeat_seconds", 60.0)
    monkeypatch.setattr(config.settings, "sse_batch_size", 2)
    for i in range(5):
        await insert_event(conn, src_ip=f"10.0.0.{i}")

    gen = event_stream(conn)
    ids = []

    async def collect():
        async for frame in gen:
            evt, data = parse_frame(frame)
            if evt == "event":
                ids.append(json.loads(data)["id"])
                if len(ids) == 5:
                    break

    await asyncio.wait_for(collect(), 8.0)
    assert ids == [1, 2, 3, 4, 5]
    await gen.aclose()


# --- 5.3: clean teardown on disconnect --------------------------------------


@pytest.mark.asyncio
async def test_event_stream_aclose_no_error(conn, monkeypatch):
    monkeypatch.setattr(config.settings, "sse_poll_interval_seconds", 0.01)
    monkeypatch.setattr(config.settings, "sse_heartbeat_seconds", 0.05)

    gen = event_stream(conn)
    await asyncio.wait_for(anext(gen), 3.0)
    await gen.aclose()


@pytest.mark.asyncio
async def test_event_stream_cancellation_is_clean(conn, monkeypatch):
    monkeypatch.setattr(config.settings, "sse_poll_interval_seconds", 0.05)
    monkeypatch.setattr(config.settings, "sse_heartbeat_seconds", 60.0)

    gen = event_stream(conn)
    task = asyncio.create_task(anext(gen))
    await asyncio.sleep(0.2)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    await gen.aclose()


@pytest.mark.asyncio
async def test_live_clean_disconnect_no_error(conn, monkeypatch):
    monkeypatch.setattr(config.settings, "sse_poll_interval_seconds", 0.05)
    monkeypatch.setattr(config.settings, "sse_heartbeat_seconds", 0.2)

    harness = await SSEHarness(_token()).start()
    try:
        await harness.next_frame(timeout=3.0)
    finally:
        await harness.close()
    assert harness.error is None


# --- 5.2 / 5.4: HTTP behavior -----------------------------------------------


@pytest.mark.asyncio
async def test_live_401_without_token(client):
    resp = await client.get("/api/v1/events/live")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_live_streaming_headers(conn, monkeypatch):
    monkeypatch.setattr(config.settings, "sse_poll_interval_seconds", 0.05)
    monkeypatch.setattr(config.settings, "sse_heartbeat_seconds", 0.2)

    harness = await SSEHarness(_token()).start()
    try:
        await harness.next_frame(timeout=3.0)
    finally:
        await harness.close()

    assert harness.status_code == 200
    assert harness.headers["content-type"].startswith("text/event-stream")
    assert harness.headers["cache-control"] == "no-cache"
    assert harness.headers["x-accel-buffering"] == "no"


@pytest.mark.asyncio
async def test_live_subscriber_receives_new_event_within_5s(conn, monkeypatch):
    monkeypatch.setattr(config.settings, "sse_poll_interval_seconds", 0.1)
    monkeypatch.setattr(config.settings, "sse_heartbeat_seconds", 60.0)

    harness = await SSEHarness(_token()).start()
    try:
        await asyncio.sleep(0.3)
        ev = await insert_event(
            conn, source_honeypot="dionaea", src_ip="2.2.2.2", risk_score=0.9
        )

        started = time.monotonic()
        data = await harness.next_event("event", timeout=5.0)
        elapsed = time.monotonic() - started

        assert elapsed <= 5.0
        payload = json.loads(data)
        assert payload["id"] == ev["id"]
        assert payload["source_honeypot"] == "dionaea"
        assert payload["src_ip"] == "2.2.2.2"
        assert payload["severity"] == "critical"
    finally:
        await harness.close()


@pytest.mark.asyncio
async def test_live_heartbeat_when_no_events(conn, monkeypatch):
    monkeypatch.setattr(config.settings, "sse_poll_interval_seconds", 0.05)
    monkeypatch.setattr(config.settings, "sse_heartbeat_seconds", 0.2)

    harness = await SSEHarness(_token()).start()
    try:
        data = await harness.next_event("ping", timeout=3.0)
        assert data == "{}"
    finally:
        await harness.close()