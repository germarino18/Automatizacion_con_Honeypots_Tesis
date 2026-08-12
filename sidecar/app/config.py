"""Configuration for the sidecar, sourced from environment variables."""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    cowrie_jsonlog_path: str
    dionaea_jsonlog_path: str
    n8n_cowrie_url: str
    n8n_dionaea_url: str
    poll_interval: float
    post_timeout: float
    post_max_attempts: int
    post_base_backoff: float
    post_max_backoff: float


def from_env(env=None):
    """Build a Config from a dict of environment variables (default: os.environ)."""
    env = dict(os.environ) if env is None else dict(env)

    def get(name, default):
        value = env.get(name)
        return default if value is None or value == "" else value

    return Config(
        cowrie_jsonlog_path=get("COWRIE_JSONLOG_PATH", "/logs/cowrie/cowrie.json"),
        dionaea_jsonlog_path=get("DIONAEA_JSONLOG_PATH", "/logs/dionaea/dionaea/dionaea.json"),
        n8n_cowrie_url=get("N8N_COWRIE_URL", "http://n8n:5678/webhook/cowrie"),
        n8n_dionaea_url=get("N8N_DIONAEA_URL", "http://n8n:5678/webhook/dionaea"),
        poll_interval=float(get("SIDECAR_POLL_INTERVAL", "0.5")),
        post_timeout=float(get("SIDECAR_POST_TIMEOUT", "10")),
        post_max_attempts=int(get("SIDECAR_POST_MAX_ATTEMPTS", "5")),
        post_base_backoff=float(get("SIDECAR_POST_BASE_BACKOFF", "0.5")),
        post_max_backoff=float(get("SIDECAR_POST_MAX_BACKOFF", "30.0")),
    )