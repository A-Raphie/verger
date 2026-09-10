#!/bin/bash
# One process-space, three residents: Mailpit, the scheduled agent rounds, the desk.
set -euo pipefail

mailpit &

# Wait for SMTP before seeding: the seed races Mailpit's bind otherwise.
for i in $(seq 1 30); do
  if (exec 3<>/dev/tcp/localhost/1025) 2>/dev/null; then exec 3>&-; break; fi
  sleep 0.5
done

# Seed an EMPTY mailbox on every boot (idempotent: never duplicates).
COUNT=$(curl -s "http://localhost:8025/api/v1/messages?limit=1" | grep -o '"total":[0-9]*' | grep -o '[0-9]*' || echo 0)
if [ "${COUNT:-0}" = "0" ]; then
  /opt/verger-venv/bin/python agent/seed.py || true
fi

# Scheduled rounds back the "runs on a schedule" claim; the bell holds sends.
/opt/verger-venv/bin/python - <<'PY' &
import subprocess, time, os
interval = int(os.environ.get("ROUND_INTERVAL", "1800"))
time.sleep(3)  # let the seed land before the first read
while True:
    try:
        subprocess.run(["/opt/verger-venv/bin/python", "agent/cli.py", "run"], cwd="/app")
    except Exception as e:
        print("round failed:", e)
    time.sleep(interval)
PY

cd /app/web
HOSTNAME=0.0.0.0 NODE_ENV=production exec node server.js
