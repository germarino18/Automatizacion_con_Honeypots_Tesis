"""Unified honeypot -> n8n bridge (soc-sidecar).

Reads the cowrie jsonlog (always) and -- when present -- the dionaea
jsonlog (dormant source, task 6.6), normalizes each event and POSTs it
to the corresponding n8n webhook with retries and an in-memory queue.

If dionaea.json does not exist the dionaea source stays dormant and the
sidecar forwards only cowrie events (spec: 'ataque-registro' scenario
'dionaea.json ausente').
"""

import logging
import os
import signal
import sys
import time

from app.config import Config, from_env
from app.normalizer import parse_line, to_cowrie_payload, to_dionaea_payload
from app.poster import PostClient
from app.tailer import FileTailer

log = logging.getLogger("sidecar")


def _enqueue_line(line, poster, envelope_fn):
    event = parse_line(line)
    if event is None:
        return
    poster.enqueue(envelope_fn(event))


def _ensure_dionaea_source(path, current_tailer, poster, skip_existing=False):
    """Return a dionaea tailer once the file exists; None while dormant.

    skip_existing reflects whether the file already existed at sidecar
    boot: a file that appears later is a fresh source and is read from
    the beginning.
    """
    if current_tailer is not None:
        return current_tailer
    if not os.path.exists(path):
        return None
    tailer = FileTailer(
        path,
        lambda line: _enqueue_line(line, poster, to_dionaea_payload),
        skip_existing=skip_existing,
    )
    log.info("dionaea source active: tailing %s", path)
    return tailer


def run(config, *, max_polls=None, sleep_fn=time.sleep, opener=None):
    """Run the bridge loop until interrupted or max_polls cycles.

    max_polls / sleep_fn / opener exist for deterministic tests; in the
    container the loop runs forever and uses the real HTTP opener.
    """
    cowrie_poster = PostClient(
        config.n8n_cowrie_url,
        timeout=config.post_timeout,
        max_attempts=config.post_max_attempts,
        base_backoff_seconds=config.post_base_backoff,
        max_backoff_seconds=config.post_max_backoff,
        opener=opener,
    )
    dionaea_poster = PostClient(
        config.n8n_dionaea_url,
        timeout=config.post_timeout,
        max_attempts=config.post_max_attempts,
        base_backoff_seconds=config.post_base_backoff,
        max_backoff_seconds=config.post_max_backoff,
        opener=opener,
    )

    cowrie_tailer = FileTailer(
        config.cowrie_jsonlog_path,
        lambda line: _enqueue_line(line, cowrie_poster, to_cowrie_payload),
        skip_existing=os.path.exists(config.cowrie_jsonlog_path),
    )
    dionaea_tailer = None
    dionaea_seen_at_boot = os.path.exists(config.dionaea_jsonlog_path)

    polls = 0
    while max_polls is None or polls < max_polls:
        cowrie_tailer.poll()
        cowrie_poster.flush()

        dionaea_tailer = _ensure_dionaea_source(
            config.dionaea_jsonlog_path, dionaea_tailer, dionaea_poster,
            skip_existing=dionaea_seen_at_boot,
        )
        if dionaea_tailer is not None:
            dionaea_tailer.poll()
            dionaea_poster.flush()

        polls += 1
        if max_polls is not None and polls >= max_polls:
            break
        sleep_fn(config.poll_interval)

    log.info(
        "sidecar stopped: cowrie_pending=%d dionaea_pending=%d",
        cowrie_poster.pending,
        dionaea_poster.pending,
    )


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    config = from_env()
    log.info("starting sidecar: cowrie=%s dionaea=%s", config.cowrie_jsonlog_path,
             config.dionaea_jsonlog_path)

    def _handle(signum, _frame):
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, _handle)
    signal.signal(signal.SIGINT, _handle)

    while True:
        try:
            run(config)
        except KeyboardInterrupt:
            log.info("shutting down")
            sys.exit(0)
        except SystemExit:
            raise
        except Exception:
            log.exception("unexpected error in run loop; restarting in 5s")
            time.sleep(5)


if __name__ == "__main__":
    main()