#!/usr/bin/env python
"""Verger CLI: run the round, decide pending sends, verify the ledger.

    verger run                 # unattended round; pauses on trustee decisions
    verger pending             # show what waits for the trustee
    verger decide <id> approve|deny [more-ids...]   # resume the session
    verger receipts            # print the receipt ledger
    verger verify              # re-walk the hash chain
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from agent.ledger import Ledger  # noqa: E402
from agent.verger import (  # noqa: E402
    DATA_DIR,
    _load_pending,
    execute_decision,
    start_round,
)


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"
    if cmd == "run":
        print(json.dumps(start_round(), indent=2))
    elif cmd == "pending":
        items = _load_pending()
        if not items:
            print("nothing waits for the trustee")
        for iid, it in items.items():
            r = it["reason"]
            print(f"{iid}\n  to: {r.get('to')}\n  subject: {r.get('subject')}\n  body: {r.get('body', '')[:120]}...")
    elif cmd == "decide":
        target = sys.argv[2]
        decision = sys.argv[3] if len(sys.argv) > 3 else "approve"
        ids = sys.argv[4:] or None
        if target == "all":
            print(json.dumps(execute_decision(decision, None), indent=2))
        else:
            print(json.dumps(execute_decision(decision, target), indent=2))
    elif cmd == "receipts":
        ledger = Ledger(os.path.join(DATA_DIR, "receipts.jsonl"))
        for row in ledger.rows:
            print(f"{row['seq']:3d} {row['action']:14s} {json.dumps(row['payload'])[:100]}")
        print(f"({len(ledger.rows)} receipts, head {ledger.prev_hash[:16]})")
    elif cmd == "verify":
        print(json.dumps(Ledger(os.path.join(DATA_DIR, "receipts.jsonl")).verify(), indent=2))
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
