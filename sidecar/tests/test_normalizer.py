"""Unit tests for payload normalization (decisions 4/6).

The payload is FLATTENED: the n8n workflows (PB-H1 'Normalizar Datos',
'Dionaea Webhook' -> 'Mapear Dionaea') read the honeypot fields from
the webhook body root, so the sidecar puts them at the top level and
adds the `source_honeypot` tag.
"""

from app.normalizer import parse_line, to_cowrie_payload, to_dionaea_payload

COWRIE_EVENT = {
    "session": "abc",
    "eventid": "cowrie.login.success",
    "src_ip": "1.2.3.4",
    "src_port": 52710,
    "dst_ip": "10.0.0.5",
    "dst_port": 2222,
    "protocol": "ssh",
    "username": "root",
    "password": "hunter2",
    "timestamp": "2026-08-11T10:00:00.000Z",
    "sensor": "soc-cowrie",
    "message": "login attempt",
}


def test_cowrie_payload_flat_with_source_tag():
    payload = to_cowrie_payload(COWRIE_EVENT)
    assert payload["source_honeypot"] == "cowrie"
    assert payload["src_ip"] == "1.2.3.4"
    assert payload["eventid"] == "cowrie.login.success"
    assert payload["username"] == "root"


def test_cowrie_preserves_canonical_fields():
    payload = to_cowrie_payload(COWRIE_EVENT)
    for key in ("session", "eventid", "src_ip", "src_port", "dst_ip", "dst_port",
                "protocol", "username", "timestamp", "sensor", "message"):
        assert payload[key] == COWRIE_EVENT[key]


def test_cowrie_strips_password_by_default():
    payload = to_cowrie_payload(COWRIE_EVENT)
    assert "password" not in payload


def test_cowrie_can_keep_password_when_disabled():
    payload = to_cowrie_payload(COWRIE_EVENT, strip_password=False)
    assert payload["password"] == "hunter2"


def test_dionaea_payload_flat_with_source_tag():
    event = {
        "connection": {"protocol": "smbd", "transport": "tcp", "type": "accept"},
        "src_ip": "5.6.7.8",
        "src_port": 40000,
        "dst_port": 445,
        "timestamp": "2026-08-11T10:00:00",
    }
    payload = to_dionaea_payload(event)
    assert payload["source_honeypot"] == "dionaea"
    assert payload["connection"] == event["connection"]
    assert payload["src_ip"] == "5.6.7.8"
    assert payload["dst_port"] == 445


def test_parse_line_valid_json():
    assert parse_line('{"eventid": "cowrie.login.success"}') == {"eventid": "cowrie.login.success"}


def test_parse_line_invalid_json_returns_none():
    assert parse_line("this is not json") is None


def test_parse_line_non_object_returns_none():
    assert parse_line("[1,2,3]") is None
    assert parse_line("42") is None