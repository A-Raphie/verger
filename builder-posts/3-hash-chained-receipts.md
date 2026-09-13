# Agents for Humans: Hash-chained receipts for AI agent actions

If an AI agent works while you sleep, the morning question is not "what did it do?" It is "can you prove what it did did not change after the fact?"

Verger, my AWS Agents for Humans hackathon build, is a front-desk agent that answers a volunteer organization's inbox. The answer to that morning question is the receipt ledger, and this post is about how it works.

## The shape of the chain

Every action the agent takes appends one row: inbox reads, drafts held for review, approvals, denials, sends, spam rejections. Each row carries a sequence number, a timestamp, the action name, a payload, the hash of the previous row, and its own hash.

The hash is sha256 over the previous row's hash plus the row's canonical JSON. Change one character anywhere in history and every subsequent hash stops matching. The ledger is append-only: nothing edits rows in place.

The verification fold is a single pass over the rows: recompute each hash from the running previous value, compare, advance. Linear time, a few milliseconds at this scale, and the agent runs it on every write. The verdict is published next to the data.

## The rule that saved the design: one writer

The first version of this system had a subtle trap. I computed the canonical JSON in two places, the agent in Python-style sorted keys and the web UI in TypeScript. Non-ASCII characters serialize differently between the two, so a legitimate ledger would have failed verification purely because of an escaping difference.

The fix was architectural, not technical: verification happens in exactly one place, the writer. The agent re-walks the chain on every append and publishes the verdict as its own record. The UI displays that verdict with its provenance and never recomputes hashes. If a display layer cannot independently verify a claim, it should show the authoritative verifier's signed answer, not its own guess.

## What the ledger buys

For the trustee, the ledger answers the trust question in one screen. Every draft that was held, every approval, every send, every denial: in order, in the open, with a badge stating the chain verified. The success state of the whole product is a quiet week with an unbroken chain.

For the agent, the ledger is a mirror. Writes happen at the moment of action, so the agent cannot act and summarize later. There is no code path from an action to anywhere except through a receipt.

## The boring parts that matter

- Rows are written as canonical JSON with sorted keys, and the canonical form is part of the compatibility contract. Changing it means re-signing history, which is only legitimate on throwaway data and only with a disclosed migration.
- The chain verifier's verdict lives beside the data it describes, written by the same process that writes the rows.
- Human-readable details (recipient, subject) ride in the payload, so the audit view needs no decoding.

Verger is live with this ledger at the core: https://vergerdesk.netlify.app
Source under MIT: https://github.com/A-Raphie/verger

The deeper lesson generalizes past this hackathon: an AI agent's audit trail is not a logging feature. It is the product's source of truth, and it deserves the same design rigor as the agent itself.

#AWS #AIAgents #AgentsforHumans #Security #Serverless
