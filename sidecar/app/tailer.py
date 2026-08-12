"""Line tailer with rotation / recreation / truncation detection.

The honeypot log (cowrie.json) is appended by an external process and
rotated by Twisted's DailyLogFile at midnight (rename + recreate) or
possibly truncated. This tailer detects those transitions and re-reads
from the start of the new file without duplicating or dropping lines.

Only complete newline-terminated lines are emitted; a partial trailing
line is held back until it is terminated.

The file is opened per poll (read + close) so the file descriptor is
never held between polls -- this keeps rename/truncate by the writer
and by tools working on all platforms.
"""

import os


class FileTailer:
    """Follow a single file, emitting each new complete line once.

    File identity is tracked via (st_dev, st_ino); when it changes the
    file was recreated (rotation) and the tail restarts from offset 0.
    A same-inode file whose size shrank was truncated, also restarting
    from offset 0.
    """

    def __init__(self, path, emit_fn, *, skip_existing=True):
        """
        Args:
            path: absolute path of the file to tail.
            emit_fn: callable(line: str) invoked once per complete line.
            skip_existing: if True, a file that already exists when the
                tailer starts is not replayed (start at its end). This
                avoids flooding n8n with history on sidecar restarts.
        """
        self.path = path
        self.emit_fn = emit_fn
        self._skip_existing = skip_existing
        self._existed_at_start = os.path.exists(path)
        self._file_id = None
        self._offset = 0

    def poll(self):
        """Inspect the file and emit new complete lines.

        Returns the number of lines emitted in this poll.
        """
        try:
            st = os.stat(self.path)
        except FileNotFoundError:
            return 0

        identity = (st.st_dev, st.st_ino)

        if self._file_id is None:
            # First time we see the file.
            if self._skip_existing and self._existed_at_start:
                self._file_id = identity
                self._offset = st.st_size
                return 0
            self._file_id = identity
            self._offset = 0
        elif identity != self._file_id:
            # Recreated/rotated: a brand new file, tail from its start.
            self._file_id = identity
            self._offset = 0
        elif st.st_size < self._offset:
            # Same file truncated in place.
            self._offset = 0

        if st.st_size <= self._offset:
            return 0
        return self._read(st.st_size)

    def _read(self, end_offset):
        with open(self.path, "rb") as fh:
            fh.seek(self._offset)
            data = fh.read(end_offset - self._offset)
        self._offset = end_offset
        if not data:
            return 0

        emit_bytes = data
        if not data.endswith(b"\n"):
            # Hold back an unterminated trailing line: rewind the offset
            # to its start so the next poll can complete it.
            keep_from = data.rfind(b"\n") + 1
            self._offset = end_offset - (len(data) - keep_from)
            emit_bytes = data[:keep_from]
            if not emit_bytes:
                return 0

        emitted = 0
        for raw_line in emit_bytes.split(b"\n"):
            if not raw_line:
                continue
            self.emit_fn(raw_line.decode("utf-8", errors="replace"))
            emitted += 1
        return emitted