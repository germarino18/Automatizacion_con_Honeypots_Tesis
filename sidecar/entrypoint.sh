#!/bin/sh
# soc-sidecar entrypoint. Runs the bridge in the foreground so docker
# logs capture diagnostics; "-u" keeps line buffering for cron-less logs.
set -eu
exec python -u -m app.main