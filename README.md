# Verger

The front-desk agent for volunteer-run organizations. Verger answers the org
inbox end to end under its policy, and every autonomous action leaves a
hash-chained receipt a human can audit. It runs on its own and holds each send
for the trustee's explicit yes.

**Built for the AWS Agents for Humans hackathon** (Strands Agents SDK,
TypeScript). Built by [Raphie](https://x.com/a_raphie).

Live: https://vergerdesk.netlify.app

Demo video: https://vimeo.com/1226324265

**Hackathon timeline:** submissions close Sep 14, 5:00pm PT · judging Sep 15 to
Oct 8 · winners around Oct 14.

**Builder series on AWS Builder Center:**

1. Agents for Humans: Building Verger, the front-desk agent volunteers can trust
2. Agents for Humans: pausing an AI agent mid-run with Strands interrupts
3. Agents for Humans: hash-chained receipts for AI agent actions

(links added as each publishes)

## The shape

- `web/lib/verger.ts` : the agent, on the Strands Agents TypeScript SDK
  (`@strands-agents/sdk`). Tools: read_message, send_mail, no_reply. The gate
  is a `BeforeToolCallEvent` hook: allowlist check first, then a Strands
  interrupt that raises `stopReason: "interrupt"` so nothing is sent without
  the trustee.
- `web/lib/blobs.ts` : all state in Netlify Blobs. The demo mailbox, the sent
  folder, the receipt ledger, the pending decisions. No server, no disk, no
  trial clocks.
- `web/lib/ledger.ts` : append-only sha256 hash chain; the ledger verifies
  itself on every append and the UI displays that verdict (it never re-derives
  hashes client-side).
- `web/netlify/functions/round.mts` : scheduled function; unattended rounds on
  a 10-minute tick.
- Rounds are chunked: one inbox message per function invocation (serverless
  budget), chained by the desk so a full round still reads as one motion.
- Trustee decisions execute deterministically: the pending item holds the
  exact draft, approval sends precisely what was shown, denial records the
  refusal. Both land on the ledger.

## Local

```
cd web && bun install && bun run build
netlify dev     # Blobs need the Netlify runtime
```

## Honesty table

| Claim | Truth |
|---|---|
| "Answers the inbox end to end" | Proven live: agent reads, drafts, sends after approval |
| "Nothing leaves without your yes" | Enforced by a Strands interrupt at the tool-call layer; deny path proven too |
| "Receipt for every action" | sha256 hash chain in Blobs, verified by the writer on every append |
| "Runs on a schedule" | Netlify scheduled function, every 10 minutes |
| Mail transport | Demo mailbox served from Blobs (synthetic org, sanctioned by the event FAQ). The Gmail IMAP adapter is the documented next slice; the tool interface stays identical |
| Model | Groq (OpenAI-compatible endpoint) for $0 builds; Bedrock is a config swap once the hackathon's AWS credits are redeemed |
| Trustee decisions | Deterministic execution of the exact approved draft, by design, after session-resume proved flaky across serverless boundaries |
| Known drafts flaw | Early drafts invented shift times before the facts policy was tightened; the gate is why drafts are reviewed |

## History

The first spike was a Python Strands agent against a local Mailpit SMTP server
(`agent/`, kept for reference). The shipped product is the TypeScript agent
above: same gate, same ledger, rebuilt for serverless so the demo cannot die
with an infrastructure trial.
