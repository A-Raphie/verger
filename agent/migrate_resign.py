#!/usr/bin/env python
"""One-time re-sign migration for the spike ledger.

The canonical form changed on Sep 9 (ensure_ascii=False) after the first 14
spike receipts were hashed with Python's default escaping, so verification
fails at the first non-ASCII row. This script rewrites prev_hash/hash for
every row in order under the new canonical form, then publishes the verdict.

This is legitimate ONLY on test data. A production ledger would treat this as
tampering; the honest path there is a new genesis with a migration note.
"""

import sys

sys.path.insert(0, ".")
from agent.ledger import Ledger, _canonical, _digest  # noqa: E402

path = sys.argv[1] if len(sys.argv) > 1 else ".data/receipts.jsonl"
ledger = Ledger(path)
prev = "0" * 64
for row in ledger.rows:
    row["prev_hash"] = prev
    row["hash"] = _digest(prev, {k: v for k, v in row.items() if k != "hash"})
    prev = row["hash"]
with open(path, "w") as f:
    for row in ledger.rows:
        f.write(_canonical(row) + "\n")
ledger.rows = [  # reload through the writer's own verify
    {**r} for r in ledger.rows
]
verdict = Ledger(path).verify()
Ledger(path)._publish_chain()
print("re-signed", verdict)
