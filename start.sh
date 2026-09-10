#!/bin/bash
# One process-space, three residents: Mailpit, the scheduled agent rounds, the desk.
set -euo pipefail

mailpit &

# First boot on a fresh volume: seed the synthetic org inbox so the desk is alive.
if [ ! -f /data/.seeded ]; then
  /opt/verger-venv/bin/python agent/seed.py || true
  touch /data/.seeded
fi

# Scheduled rounds back the "runs on a schedule" claim; the bell holds sends.
/opt/verger-venv/bin/python - <<'PY' &
import subprocess, time, os
interval = int(os.environ.get("ROUND_INTERVAL", "1800"))
while True:
    try:
        subprocess.run(["/opt/verger-venv/bin/python", "agent/cli.py", "run"], cwd="/app")
    except Exception as e:
        print("round failed:", e)
    time.sleep(interval)
PY

cd /app/web
HOSTNAME=0.0.0.0 NODE_ENV=production exec node server.js
