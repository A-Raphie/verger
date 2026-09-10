#!/bin/bash
# Verger's scheduled rounds: run one round every INTERVAL seconds (default 1800).
# The agent reads the inbox, drafts, and the bell holds every send for the
# trustee. Runs forever until killed; safe to run under launchd/cron as-is.
#
#   ./agent/loop.sh            # every 30 minutes
#   INTERVAL=900 ./agent/loop.sh
set -euo pipefail
cd "$(dirname "$0")/.."
INTERVAL="${INTERVAL:-1800}"
echo "verger loop: a round every ${INTERVAL}s"
while true; do
  ./.venv/bin/python agent/cli.py run || echo "round failed; continuing"
  sleep "$INTERVAL"
done
