"""Normalized POST client with retries, exponential backoff and an
in-memory queue.

Events are appended to a FIFO queue and only removed once delivered
successfully (HTTP 2xx). If n8n is down, the event stays queued and is
retried on subsequent flush() calls -- no event is ever dropped.
"""

import json
import time
import urllib.request
from collections import deque


def _default_opener(url, data, timeout):
    """POST JSON bytes to url; raise on transport error or non-2xx."""
    request = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        status = getattr(response, "status", 200)
        if not 200 <= status < 300:
            raise RuntimeError("HTTP %s from %s" % (status, url))


class PostClient:
    """In-memory event queue with retrying POST delivery."""

    def __init__(self, url, *, timeout=10, max_attempts=5, base_backoff_seconds=0.5,
                 max_backoff_seconds=30.0, sleep_fn=time.sleep, opener=None):
        self.url = url
        self.timeout = timeout
        self.max_attempts = max_attempts
        self.base_backoff = base_backoff_seconds
        self.max_backoff = max_backoff_seconds
        self.sleep_fn = sleep_fn
        self._opener = opener if opener is not None else _default_opener
        self._queue = deque()

    def enqueue(self, event):
        """Queue an event (dict) for delivery."""
        self._queue.append(event)

    @property
    def pending(self):
        return len(self._queue)

    def flush(self):
        """Attempt delivery of queued events in FIFO order.

        Returns the number of events delivered. Stops at the first
        failure (strict order); undelivered events remain queued.
        """
        delivered = 0
        while self._queue:
            if not self._deliver_with_retries(self._queue[0]):
                break
            self._queue.popleft()
            delivered += 1
        return delivered

    def _deliver_with_retries(self, event):
        data = json.dumps(event, ensure_ascii=False).encode("utf-8")
        for attempt in range(self.max_attempts):
            try:
                self._opener(self.url, data, self.timeout)
                return True
            except Exception:
                if attempt + 1 >= self.max_attempts:
                    return False
                delay = min(self.base_backoff * (2 ** attempt), self.max_backoff)
                self.sleep_fn(delay)
        return False