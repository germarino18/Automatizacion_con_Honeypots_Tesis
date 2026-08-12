"""Integration-ish tests for the main run loop and dormant dionaea source (6.6).

The run loop is wired to real FileTailer/PostClient but with an injected
mock HTTP opener and a fake sleep that appends log lines between polls,
so behaviour is deterministic.
"""

import json

import pytest

from app.config import Config
from app.main import run


@pytest.fixture
def sample_config(tmp_path):
    return Config(
        cowrie_jsonlog_path=str(tmp_path / "cowrie.json"),
        dionaea_jsonlog_path=str(tmp_path / "dionaea.json"),
        n8n_cowrie_url="http://n8n:5678/webhook/cowrie",
        n8n_dionaea_url="http://n8n:5678/webhook/dionaea",
        poll_interval=0.001,
        post_timeout=5,
        post_max_attempts=2,
        post_base_backoff=0.001,
        post_max_backoff=0.005,
    )


def receiving_opener(calls):
    def opener(url, data, timeout):
        calls.append((url, json.loads(data)))

    return opener


def test_run_forwards_cowrie_event_to_n8n(sample_config, tmp_path):
    cowrie_path = tmp_path / "cowrie.json"
    open(cowrie_path, "a", encoding="utf-8").close()
    calls = []
    appended = []

    def fake_sleep(_seconds):
        if not appended:
            line = json.dumps({
                "session": "s1",
                "eventid": "cowrie.login.success",
                "src_ip": "1.2.3.4",
                "username": "root",
                "timestamp": "2026-08-11T10:00:00Z",
            })
            appended.append(True)
            with open(cowrie_path, "a", encoding="utf-8") as fh:
                fh.write(line + "\n")

    run(sample_config, max_polls=2, sleep_fn=fake_sleep, opener=receiving_opener(calls))
    assert len(calls) == 1
    url, payload = calls[0]
    assert url == "http://n8n:5678/webhook/cowrie"
    assert payload["source_honeypot"] == "cowrie"
    assert payload["src_ip"] == "1.2.3.4"


def test_dionaea_source_dormant_when_file_missing(sample_config, tmp_path):
    open(tmp_path / "cowrie.json", "a", encoding="utf-8").close()
    calls = []

    def fake_sleep(_seconds):
        return None

    run(sample_config, max_polls=2, sleep_fn=fake_sleep, opener=receiving_opener(calls))
    assert calls == []


def test_dionaea_source_activates_when_file_appears(sample_config, tmp_path):
    cowrie_path = tmp_path / "cowrie.json"
    dionaea_path = tmp_path / "dionaea.json"
    open(cowrie_path, "a", encoding="utf-8").close()
    calls = []
    written = []

    def fake_sleep(_seconds):
        if not written:
            written.append(True)
            with open(dionaea_path, "a", encoding="utf-8") as fh:
                fh.write(json.dumps({
                    "connection": {"protocol": "smbd", "transport": "tcp", "type": "accept"},
                    "src_ip": "5.6.7.8",
                    "dst_port": 445,
                    "timestamp": "2026-08-11T10:00:00",
                }) + "\n")

    run(sample_config, max_polls=2, sleep_fn=fake_sleep, opener=receiving_opener(calls))
    assert len(calls) == 1
    url, payload = calls[0]
    assert url == "http://n8n:5678/webhook/dionaea"
    assert payload["source_honeypot"] == "dionaea"
    assert payload["src_ip"] == "5.6.7.8"


def test_run_survives_malformed_line(sample_config, tmp_path):
    cowrie_path = tmp_path / "cowrie.json"
    open(cowrie_path, "a", encoding="utf-8").close()
    calls = []
    written = []

    def fake_sleep(_seconds):
        if not written:
            written.append(True)
            with open(cowrie_path, "a", encoding="utf-8") as fh:
                fh.write("not-json-broken-line\n")

    run(sample_config, max_polls=2, sleep_fn=fake_sleep, opener=receiving_opener(calls))
    assert calls == []