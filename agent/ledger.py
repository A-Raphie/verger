"""Append-only hash-chained receipt ledger.

Every Verger action (inbox read, draft, gated send, approval) writes one
receipt row. Each row carries prev_hash, so any edit to history breaks the
chain and `verify` catches it.

Complexity: append O(1) amortized (hash = sha256(prev_hash + payload)),
verify O(n) single pass; space O(n). n = agent actions (~10^2-10^3),
not a hot path. Family: linear append + monoid reduction (hash fold).
"""

import hashlib
import json
import os
import time

GENESIS = "0" * 64


def _canonical(obj: dict) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


def _digest(prev: str, payload: dict) -> str:
    return hashlib.sha256((prev + _canonical(payload)).encode()).hexdigest()


class Ledger:
    def __init__(self, path: str):
        self.path = path
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.rows: list[dict] = []
        if os.path.exists(path):
            with open(path) as f:
                for line in f:
                    line = line.strip()
                    if line:
                        self.rows.append(json.loads(line))

    @property
    def prev_hash(self) -> str:
        return self.rows[-1]["hash"] if self.rows else GENESIS

    def append(self, action: str, payload: dict) -> dict:
        row = {
            "seq": len(self.rows),
            "ts": round(time.time(), 3),
            "action": action,
            "payload": payload,
            "prev_hash": self.prev_hash,
        }
        row["hash"] = _digest(row["prev_hash"], {k: v for k, v in row.items() if k != "hash"})
        self.rows.append(row)
        with open(self.path, "a") as f:
            f.write(_canonical(row) + "\n")
        return row

    def verify(self) -> dict:
        """Re-walk the chain; returns {ok, rows, first_bad_seq}."""
        prev = GENESIS
        for row in self.rows:
            expected = _digest(prev, {k: v for k, v in row.items() if k != "hash"})
            if expected != row.get("hash") or row.get("prev_hash") != prev:
                return {"ok": False, "rows": len(self.rows), "first_bad_seq": row["seq"]}
            prev = row["hash"]
        return {"ok": True, "rows": len(self.rows), "first_bad_seq": None}
