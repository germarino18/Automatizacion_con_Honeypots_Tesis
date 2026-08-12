"""Unit tests for the PostClient (task 6.3).

Covers: delivery, FIFO order, retries + exponential backoff with cap,
no event loss while n8n is down, and non-2xx handling. HTTP is mocked
via an injected opener so tests are deterministic.
"""

import json

import pytest

from app.poster import PostClient


class Boom(Exception):
    pass


def failing_opener_once(responses, calls):
    """responses: list where None == success, otherwise the exception to raise."""

    def opener(url, data, timeout):
        calls.append((url, json.loads(data)))
        if responses:
            exc = responses.pop(0)
            if exc is not None:
                raise exc

    return opener


def make_client(responses, base_backoff=0.5, max_backoff=30.0, max_attempts=5):
    calls = []
    sleeps = []
    client = PostClient(
        "http://n8n:5678/webhook/cowrie",
        max_attempts=max_attempts,
        base_backoff_seconds=base_backoff,
        max_backoff_seconds=max_backoff,
        sleep_fn=sleeps.append,
        opener=failing_opener_once(responses, calls),
    )
    return client, calls, sleeps


def test_delivers_event_to_configured_url():
    client, calls, _ = make_client([None])
    client.enqueue({"source_honeypot": "cowrie", "event": {"eventid": "x"}})
    delivered = client.flush()
    assert delivered == 1
    assert client.pending == 0
    assert calls == [
        ("http://n8n:5678/webhook/cowrie", {"source_honeypot": "cowrie", "event": {"eventid": "x"}})
    ]


def test_queue_delivers_in_fifo_order():
    client, calls, _ = make_client([None, None])
    client.enqueue({"n": 1})
    client.enqueue({"n": 2})
    assert client.flush() == 2
    assert [c[1]["n"] for c in calls] == [1, 2]


def test_retries_transient_failure_until_success():
    client, calls, sleeps = make_client(
        [Boom("down"), Boom("down"), None], base_backoff=1.0, max_attempts=3
    )
    client.enqueue({"eventid": "cowrie.login.success"})
    assert client.flush() == 1
    assert client.pending == 0
    assert len(calls) == 3
    assert len(sleeps) == 2


def test_no_event_lost_when_server_down_then_recovered():
    client, calls, _ = make_client([Boom("down")] * 10, max_attempts=2)
    client.enqueue({"eventid": "a"})
    assert client.flush() == 0
    assert client.pending == 1
    assert len(calls) == 2
    client2, calls2, _ = make_client([None], max_attempts=2)
    client2.enqueue({"eventid": "a"})
    assert client2.flush() == 1
    assert client2.pending == 0


def test_backoff_grows_exponentially_and_is_capped():
    client, _, sleeps = make_client(
        [Boom()] * 10, base_backoff=1.0, max_backoff=6.0, max_attempts=5
    )
    client.enqueue({"eventid": "x"})
    assert client.flush() == 0
    assert sleeps == [1.0, 2.0, 4.0, 6.0]
    assert client.pending == 1


def test_non_2xx_status_is_treated_as_failure():
    client, calls, _ = make_client([Boom("HTTP 500")], max_attempts=1)
    client.enqueue({"eventid": "x"})
    assert client.flush() == 0
    assert client.pending == 1
    assert len(calls) == 1


def test_flush_with_empty_queue_returns_zero():
    client, calls, _ = make_client([None])
    assert client.flush() == 0
    assert calls == []


def test_head_of_line_failure_blocks_rest_preserving_fifo():
    client, calls, _ = make_client([Boom("down")], max_attempts=1)
    client.enqueue({"n": 1})
    client.enqueue({"n": 2})
    client.enqueue({"n": 3})
    assert client.flush() == 0
    assert client.pending == 3
    assert len(calls) == 1
    assert calls[0][1]["n"] == 1
