"""Payload normalization for the honeypot -> n8n bridge.

Each event is flattened with the `source_honeypot` tag at the TOP level,
because the n8n workflows (PB-H1 "Normalizar Datos", "Mapear Dionaea")
read the honeypot fields directly from the webhook body root:

    { "source_honeypot": "cowrie", "session": "...", "src_ip": "...", ... }

For cowrie, the password from login events is stripped by default
(security policy); the n8n workflow filters it regardless.
"""

import json

SENSITIVE_FIELDS = ("password",)


def _strip_sensitive(event):
    return {key: value for key, value in event.items() if key not in SENSITIVE_FIELDS}


def to_cowrie_payload(event, *, strip_password=True):
    """Flatten a cowrie jsonlog event with the source_honeypot tag."""
    clean = _strip_sensitive(event) if strip_password else dict(event)
    clean["source_honeypot"] = "cowrie"
    return clean


def to_dionaea_payload(event):
    """Flatten a dionaea connection event with the source_honeypot tag."""
    payload = dict(event)
    payload["source_honeypot"] = "dionaea"
    return payload


def parse_line(line):
    """Parse one log line into a dict, or None if it is not a JSON object."""
    try:
        value = json.loads(line)
    except (ValueError, TypeError):
        return None
    return value if isinstance(value, dict) else None