# Verger

The front-desk agent for volunteer-run organizations. Verger answers the org
inbox end to end under its policy, and every autonomous action leaves a
hash-chained receipt a human can audit. It runs on its own and holds each send
for the trustee's explicit yes.

**Built for the AWS Agents for Humans hackathon** (Strands Agents SDK). Built
by [Raphie](https://x.com/a_raphie).

## The shape

- `agent/` : the Strands agent (Python). Tools: read_inbox, read_message,
  send_mail. The send gate is a Strands hook (`BeforeToolCallEvent`): allowlist
  check, then an interrupt that pauses the whole loop until the trustee
  decides. Interrupt state persists across processes via `FileSessionManager`,
  so approvals can land hours later.
- `agent/ledger.py` : append-only sha256 hash chain of receipts; the agent
  publishes its own verify verdict (`chain.json`) on every append.
- `web/` : the desk. Front door + decision porch + receipt ledger, reading the
  agent's real state files. No mock data anywhere.

## Run it

```
brew install mailpit && mailpit &                  # SMTP :1025, API :8025
python3.12 -m venv .venv
VIRTUAL_ENV=.venv uv pip install strands-agents openai python-dotenv pillow
cp a .env with GROQ_API_KEY (or set BEDROCK creds after redeeming hackathon credits)
python agent/seed.py                               # synthetic org inbox
./.venv/bin/python agent/cli.py run                # unattended round; pauses at the gate
./.venv/bin/python agent/cli.py pending            # what waits for the trustee
./.venv/bin/python agent/cli.py decide <id> approve
./.venv/bin/python agent/cli.py verify             # re-walk the chain
cd web && bun run dev                              # the desk on :3001
```

Scheduled rounds: `./agent/loop.sh` (every 30 min by default). The mail server
is Mailpit in the demo; the Gmail IMAP adapter is a documented integration
slice, not faked.

## Honesty table

| Claim | Truth |
|---|---|
| "Answers the inbox end to end" | Proven: 5 real SMTP messages read, 4 replies sent on camera |
| "Nothing leaves without your yes" | Enforced by a Strands interrupt at the tool-call layer; deny path proven too |
| "Receipt for every action" | 17-row sha256 chain, verified by the agent on every write |
| "Runs on a schedule" | `agent/loop.sh` runs unattended rounds on an interval |
| Reads a REAL external mailbox | Spike runs on Mailpit (real SMTP server, local). Gmail IMAP adapter is the next integration slice |
| Model | Groq gpt-oss-20b via OpenAI-compatible API ($0). Bedrock + AgentCore deploy lands when the hackathon's $50 credit code is redeemed |
| Known drafts flaw | One draft invented shift times before the facts policy was tightened; the gate is why drafts are reviewed |

## The canonical-form migration (disclosed)

On Sep 9 the ledger's canonical JSON changed to `ensure_ascii=False` after 14
spike rows were written; `agent/migrate_resign.py` re-signed those rows in
order. Legitimate on test data only; a production ledger would start a new
genesis instead.
