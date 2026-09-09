"""Real-protocol mail client: SMTP to send, Mailpit HTTP API to read (spike).

Built against a local Mailpit instance (SMTP :1025, HTTP :8025) so every byte
in the demo travels a real mail server. The production read path is a Gmail
IMAP adapter (stdlib imaplib) and is a separate integration slice; this spike
read path exists so the agent loop runs against a live mailbox on day one.

Inbox reads are one paginated API call per run (O(n) decode); the processed
Message-ID set gives O(1) membership. n ~ 10^1-10^2, not a hot path.
"""

import json
import os
import smtplib
import urllib.request
from email.message import EmailMessage

SMTP_HOST = os.environ.get("VERGER_SMTP_HOST", "localhost")
SMTP_PORT = int(os.environ.get("VERGER_SMTP_PORT", "1025"))
API_BASE = os.environ.get("VERGER_MAIL_API", "http://localhost:8025")
ORG_ADDRESS = os.environ.get("VERGER_ORG_ADDRESS", "desk@foodbank.local")


def send_mail(to: str, subject: str, body: str) -> str:
    msg = EmailMessage()
    msg["From"] = ORG_ADDRESS
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
        s.send_message(msg)
    return msg["Message-ID"] or ""


def list_inbox() -> list[dict]:
    """Return [{id, from, subject, date, snippet}] for messages in the mailbox."""
    with urllib.request.urlopen(f"{API_BASE}/api/v1/messages?limit=50", timeout=5) as r:
        data = json.loads(r.read())
    out = []
    for m in data.get("messages", []):
        out.append({
            "id": m.get("ID", ""),
            "from": m.get("From", {}).get("Address", ""),
            "subject": m.get("Subject", ""),
            "date": m.get("Date", ""),
            "snippet": (m.get("Snippet") or "")[:500],
        })
    return out


def read_message(mid: str) -> str:
    """Full plain-text body of one message."""
    with urllib.request.urlopen(f"{API_BASE}/api/v1/message/{mid}", timeout=5) as r:
        m = json.loads(r.read())
    for part in m.get("Attachments", []):
        pass
    text = m.get("Text") or ""
    return text[:4000]
