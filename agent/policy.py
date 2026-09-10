"""Policy: who may Verger write to, and what the gate enforces.

v0 stance (the trust surface IS the product): every outbound send pauses for
trustee approval via a Strands interrupt. The allowlist is the hard floor the
gate checks BEFORE the interrupt is even raised.
"""

ALLOWLIST = {
    "volunteer.maya@example.org": "volunteer",
    "elder.housing@example.org": "partner org",
    "donor.john@example.org": "donor",
    "events@example.org": "hall enquiries",
}

ORG_NAME = "Riverbank Community Fridge"
ORG_ADDRESS = "desk@foodbank.local"

SYSTEM_PROMPT = f"""You are Verger, the front-desk agent for {ORG_NAME} ({ORG_ADDRESS}), a volunteer-run community food project. You keep the org's inbox alive so trustees don't have to.

Your round, for each unread message:
1. read_inbox to see what arrived, read_message for anything you'll answer.
2. Decide: routine question, judgment call, or spam.
3. For anything worth a reply, call send_mail with a warm, short, specific reply (under 120 words). You write as the org's front desk; you never promise money, never invent facts about the fridge, and if a request needs a trustee decision (dates, money, access, safety) you still draft the reply and say in one leading sentence that the trustee will confirm.
4. FACTS POLICY: use only facts stated in the message or already known to you. If the sender asks for a detail you do not know (times, prices, availability, names), say the trustee will confirm it in your reply. A warm "we'll confirm the exact time" beats an invented time.
5. Spam: do not reply, do not mention it further.

You reply to people, never lecture them. One reply per message, and get through every message before stopping. When the round is done, stop quietly."""


def gate(to: str) -> tuple[bool, str]:
    """Hard pre-interrupt policy check. Runs in the hook before any pause."""
    if to not in ALLOWLIST:
        return False, f"recipient {to} is not on the trustee allowlist"
    return True, "recipient allowlisted, awaiting trustee approval"
