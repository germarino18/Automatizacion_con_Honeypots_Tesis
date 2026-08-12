"""Unit tests for the FileTailer (task 6.2).

Covers: new-line emission, no duplicates, partial-line buffering,
file recreation (rotation), truncation, missing file and skip-existing
start behaviour.
"""

import os

import pytest

from app.tailer import FileTailer


@pytest.fixture
def logfile(tmp_path):
    path = tmp_path / "cowrie.json"
    return path


def write(path, text):
    with open(path, "ab") as fh:
        fh.write(text.encode("utf-8"))


def make_tailer(path, **kwargs):
    emitted = []

    def emit_fn(line):
        emitted.append(line)

    tailer = FileTailer(str(path), emit_fn, **kwargs)
    return tailer, emitted


def test_emits_complete_lines_on_first_poll(logfile):
    write(logfile, '{"a":1}\n{"b":2}\n')
    tailer, emitted = make_tailer(logfile, skip_existing=False)
    n = tailer.poll()
    assert n == 2
    assert emitted == ['{"a":1}', '{"b":2}']


def test_tails_only_new_lines_no_duplicates(logfile):
    write(logfile, '{"a":1}\n')
    tailer, emitted = make_tailer(logfile, skip_existing=False)
    assert tailer.poll() == 1
    assert emitted == ['{"a":1}']
    write(logfile, '{"b":2}\n')
    assert tailer.poll() == 1
    assert emitted == ['{"a":1}', '{"b":2}']
    assert tailer.poll() == 0
    assert len(emitted) == 2


def test_partial_line_held_until_terminated(logfile):
    write(logfile, '{"a":1}\n{"par')
    tailer, emitted = make_tailer(logfile, skip_existing=False)
    assert tailer.poll() == 1
    assert emitted == ['{"a":1}']
    write(logfile, 'tial":2}\n')
    assert tailer.poll() == 1
    assert emitted == ['{"a":1}', '{"partial":2}']


def test_poll_returns_number_of_emitted_lines(logfile):
    write(logfile, '{"a":1}\n{"b":2}\n{"c":3}\n')
    tailer, _ = make_tailer(logfile, skip_existing=False)
    assert tailer.poll() == 3
    assert tailer.poll() == 0


def test_detects_file_recreated_after_rotation(logfile):
    write(logfile, '{"a":1}\n')
    tailer, emitted = make_tailer(logfile, skip_existing=False)
    assert tailer.poll() == 1
    os.replace(str(logfile), str(logfile) + ".1")
    write(logfile, '{"b":2}\n')
    assert tailer.poll() == 1
    assert emitted == ['{"a":1}', '{"b":2}']


def test_detects_truncated_file_and_rewinds(logfile):
    write(logfile, '{"a":1}\n')
    tailer, emitted = make_tailer(logfile, skip_existing=False)
    assert tailer.poll() == 1
    with open(logfile, "w", encoding="utf-8") as fh:
        fh.truncate(0)
    assert tailer.poll() == 0
    write(logfile, '{"b":2}\n')
    assert tailer.poll() == 1
    assert emitted == ['{"a":1}', '{"b":2}']


def test_missing_file_at_start_no_error_then_reads_from_beginning(logfile):
    tailer, emitted = make_tailer(logfile, skip_existing=True)
    assert tailer.poll() == 0
    assert emitted == []
    write(logfile, '{"a":1}\n')
    assert tailer.poll() == 1
    assert emitted == ['{"a":1}']


def test_skip_existing_start_mode_skips_history(logfile):
    write(logfile, '{"old":1}\n{"old":2}\n')
    tailer, emitted = make_tailer(logfile, skip_existing=True)
    assert tailer.poll() == 0
    assert emitted == []
    write(logfile, '{"new":3}\n')
    assert tailer.poll() == 1
    assert emitted == ['{"new":3}']


def test_rotation_by_rename_then_recreate_no_duplication(logfile):
    write(logfile, '{"a":1}\n')
    tailer, emitted = make_tailer(logfile, skip_existing=False)
    assert tailer.poll() == 1
    os.rename(str(logfile), str(logfile) + "-2026-08-11")
    write(logfile, '{"b":2}\n{"c":3}\n')
    assert tailer.poll() == 2
    assert emitted == ['{"a":1}', '{"b":2}', '{"c":3}']
