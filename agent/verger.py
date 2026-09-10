"""Verger: the front-desk agent for a volunteer-run org.

One round = read the inbox, answer what should be answered, and attempt the
sends. Every send passes the gate hook: allowlist check first, then a Strands
interrupt pauses the whole loop until the trustee decides. Interrupt state
persists in the session, so the trustee can decide hours later from a fresh
process (verger decide).
"""

import json
import os
import uuid

from openai import OpenAI
from strands import Agent, tool
from strands.hooks import BeforeToolCallEvent, HookProvider, HookRegistry
from strands.models.openai import OpenAIModel
from strands.session.file_session_manager import FileSessionManager

from agent import mail
from agent.ledger import Ledger
from agent.policy import ALLOWLIST, ORG_NAME, SYSTEM_PROMPT, gate

DATA_DIR = os.environ.get("VERGER_DATA", os.path.join(os.path.dirname(__file__), "..", ".data"))

_seen: set[str] = set()  # processed Message-IDs for O(1) membership across the round
ledger = Ledger(os.path.join(DATA_DIR, "receipts.jsonl"))


@tool
def read_inbox() -> list[dict]:
    """List the messages sitting in the org inbox."""
    msgs = mail.list_inbox()
    ledger.append(
        "inbox_read",
        {"count": len(msgs), "senders": sorted({m["from"] for m in msgs})},
    )
    return msgs


@tool
def read_message(message_id: str) -> str:
    """Read the full plain-text body of one inbox message by its id."""
    return mail.read_message(message_id)


@tool
def send_mail(to: str, subject: str, body: str) -> str:
    """Send one reply from the org desk. Every send passes the trustee gate."""
    mid = mail.send_mail(to, subject, body)
    ledger.append("mail_sent", {"to": to, "subject": subject, "message_id": mid})
    return f"sent to {to} (message-id {mid})"


class TrusteeGate(HookProvider):
    """The product's core promise, enforced at the tool-call layer.

    Hard policy first (allowlist); then a Strands interrupt pauses the loop so
    a human decides. Nothing leaves the org without that decision, and the
    decision can arrive hours later from a fresh process.
    """

    def register_hooks(self, registry: HookRegistry, **kwargs) -> None:
        registry.add_callback(BeforeToolCallEvent, self.check)

    def check(self, event: BeforeToolCallEvent) -> None:
        if event.tool_use["name"] != "send_mail":
            return
        to = event.tool_use["input"].get("to", "")
        subject = event.tool_use["input"].get("subject", "")
        ok, why = gate(to)
        if not ok:
            event.cancel_tool = f"BLOCKED BY POLICY: {why}"
            ledger.append("send_blocked", {"to": to, "subject": subject, "why": why})
            return
        decision = event.interrupt(
            "trustee-send-approval",
            reason={"to": to, "subject": subject, "body": event.tool_use["input"].get("body", "")[:400]},
        )
        if decision.strip().lower() not in ("approve", "y", "yes"):
            event.cancel_tool = f"Trustee did not approve the send to {to}."
            ledger.append("send_denied", {"to": to, "subject": subject})
        else:
            ledger.append("send_approved", {"to": to, "subject": subject})


def build_agent(session_id: str) -> Agent:
    key = os.environ["GROQ_API_KEY"]
    model = OpenAIModel(
        client_args={
            "api_key": key,
            "base_url": "https://api.groq.com/openai/v1",
        },
        model_id=os.environ.get("VERGER_MODEL", "openai/gpt-oss-120b"),
        params={"max_tokens": 1600, "temperature": 0.4},
    )
    return Agent(
        name="verger",
        model=model,
        system_prompt=SYSTEM_PROMPT,
        tools=[read_inbox, read_message, send_mail],
        hooks=[TrusteeGate()],
        callback_handler=None,
        session_manager=FileSessionManager(session_id=session_id, storage_dir=os.path.join(DATA_DIR, "session")),
    )


def _pending_path() -> str:
    return os.path.join(DATA_DIR, "pending-interrupts.json")


def _load_pending() -> dict:
    path = _pending_path()
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {}


def _save_pending(items: dict) -> None:
    with open(_pending_path(), "w") as f:
        json.dump(items, f, indent=2, sort_keys=True)


def _session_path() -> str:
    return os.path.join(DATA_DIR, "current-session")


def _current_session() -> str | None:
    if os.path.exists(_session_path()):
        with open(_session_path()) as f:
            return f.read().strip() or None
    return None


def _start_session() -> str:
    sid = f"round-{uuid.uuid4().hex[:10]}"
    with open(_session_path(), "w") as f:
        f.write(sid)
    return sid


def run_round(agent: Agent) -> dict:
    """Run one round until it ends or pauses on trustee decisions."""
    result = agent(f"It's Monday morning. Do your round for {ORG_NAME}.")
    pending = _load_pending()
    rounds = 0
    while result.stop_reason == "interrupt":
        rounds += 1
        for intr in result.interrupts:
            pending[intr.id] = {
                "id": intr.id,
                "name": intr.name,
                "reason": intr.reason,
            }
            ledger.append("send_awaiting", {"interrupt_id": intr.id, "reason": intr.reason})
        _save_pending(pending)
        break  # unattended run ends here; the trustee decides on their time
    if not pending and result.stop_reason != "interrupt":
        # the round completed: archive the session so the next round starts fresh
        os.remove(_session_path())
    return {
        "stop_reason": str(result.stop_reason),
        "pending_total": len(pending),
        "paused_this_run": rounds > 0,
    }


def start_round() -> dict:
    """Public entry for the CLI: refuse a new round while one is paused, else start fresh."""
    pending = _load_pending()
    if pending:
        return {
            "stop_reason": "refused",
            "pending_total": len(pending),
            "note": "a round is paused awaiting trustee decisions; decide first",
        }
    sid = _start_session()
    return run_round(build_agent(sid))


def execute_decision(decision: str, interrupt_id: str | None = None) -> dict:
    """Trustee decided. Execute deterministically; never bet on a paused session.

    The pending item holds the full draft, so approval sends EXACTLY what the
    trustee saw (policy re-checked), denial records the refusal, and either way
    the paused round is closed. A fresh round picks up the remaining inbox.
    """
    pending = _load_pending()
    targets = [interrupt_id] if interrupt_id else list(pending.keys())
    if not targets:
        return {"stop_reason": "nothing-pending", "still_pending": 0}
    # the paused round is dead either way; its session is retired
    sid = _current_session()
    if sid:
        import shutil

        shutil.rmtree(os.path.join(DATA_DIR, "session", f"session_{sid}"), ignore_errors=True)
        os.remove(_session_path())

    item = pending[targets[0]]
    to = item["reason"].get("to", "")
    subject = item["reason"].get("subject", "")
    ok, why = gate(to)
    if not ok:
        ledger.append("send_blocked", {"to": to, "subject": subject, "why": why, "interrupt_id": item["id"]})
        pending.pop(item["id"], None)
        _save_pending(pending)
        return {"stop_reason": "blocked", "still_pending": len(pending)}

    if decision.strip().lower() in ("approve", "y", "yes"):
        ledger.append("send_approved", {"to": to, "subject": subject, "interrupt_id": item["id"]})
        mid = mail.send_mail(to, subject, item["reason"].get("body", ""))
        ledger.append("mail_sent", {"to": to, "subject": subject, "message_id": mid})
        outcome = "sent"
    else:
        ledger.append("send_denied", {"to": to, "subject": subject, "interrupt_id": item["id"]})
        outcome = "denied"
    pending.pop(item["id"], None)
    _save_pending(pending)
    return {"stop_reason": outcome, "still_pending": len(pending)}
