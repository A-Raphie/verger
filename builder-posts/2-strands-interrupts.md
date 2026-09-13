# Agents for Humans: Pausing an AI agent mid-run with Strands interrupts

The hardest part of building a trustworthy agent is not making it competent. It is making it stop.

This is the technical story of Verger, my entry for the AWS Agents for Humans hackathon: a front-desk agent for volunteer-run organizations that reads an inbox and drafts replies autonomously, where every outbound send is gated by a human decision. The enforcement mechanism is the interesting part, and it is built entirely from Strands primitives.

## The gate is a hook, not a prompt

The naive version of "the agent asks permission" is a prompt instruction: please ask before sending. That is a suggestion. The agent can ignore it, and you cannot audit a suggestion.

Verger enforces the gate at the tool-call layer instead. Every outbound send goes through one tool, and a hook registered on `BeforeToolCallEvent` inspects each call before it executes:

- First, a hard policy check: is the recipient on the trustee allowlist? If not, the hook cancels the call outright. This runs before anything else, so an off-list send never even becomes a pending decision.
- Then, the hook raises a Strands interrupt. The agent loop stops, the run returns with a stop reason of interrupt, and the draft sits in a pending store with the recipient, subject, and full body.

The agent does not get to argue with a hook. That difference is the product.

## The decision is deterministic

When the trustee approves, the pending item already contains the exact draft they reviewed. The approval sends precisely what was shown, appends an approval and a send receipt to the ledger, and starts the next round for the rest of the inbox. A denial records the refusal the same way. I deliberately moved the decision execution out of the model entirely: the reviewed text is the payload, so what the trustee read is bit-for-bit what gets sent.

## Serverless reality: one message per invocation

Verger runs on Netlify Functions with all state in Netlify Blobs, which shapes the agent loop. A function invocation has a hard time budget, so a "round" is chunked: each invocation handles exactly one inbox message with a fresh agent, and the desk chains invocations until the inbox is clear or a hold is pending.

Two lessons from shipping this shape:

1. Do not share conversation history across chunks. An early version carried the agent's messages forward, and the model answered the previous sender while processing the current message. Fresh agent per message, no cross-invocation state.
2. Serialize your rounds. A scheduled function and a user-triggered round can race the mailbox and produce duplicate holds. A single-flight lock with an owner token fixed it in twenty lines.

## Why this reads as Strands being used properly

The judge question for any agent hackathon entry is whether the sponsor SDK is load-bearing. Here it is the enforcement surface: a `BeforeToolCallEvent` hook that raises interrupts, policy cancellation with reasons, and the tool registry deciding what the model can touch. Remove Strands and there is no gate, no pause, no resume. The rest of the stack (Next.js front end, Blobs, the ledger) exists to make that surface visible to a human.

Live desk: https://vergerdesk.netlify.app
Source (MIT): https://github.com/A-Raphie/verger

#AWS #StrandsAgents #AIAgents #AgentsforHumans #Serverless
