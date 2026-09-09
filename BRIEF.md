# Verger — Build Brief
AWS Agents for Humans (Devpost) · Good Neighbor track · deadline Sep 14, 2026 5:00pm PT
Status: AWAITING RAPHIE'S APPROVAL (his brief gate)

## Positioning (Rule 0)
For volunteer-run community organizations that cannot afford a coordinator, Verger is an autonomous front-desk agent that answers the org's inbox end to end under its policy, files and chases the routine work, leaves a signed receipt for every action, and only interrupts the trustee when a real decision is theirs, unlike inbox tools that draft-for-you or chatbots that need babysitting, because autonomy without an audit trail is exactly what a trustee cannot accept.

## One-liner for the submission
"The front-desk agent for volunteer-run organizations. It answers the inbox, does the follow-up, and shows you a receipt for everything it did."

## Product-risk review (before-you-build)
- **User / job / current workaround:** the trustee or coordinator of a small org (food bank, residents' association, youth club) keeps info@ alive in their spare evenings. Current workaround: one volunteer checks the inbox nightly, or it rots and people stop writing in.
- **Demand evidence:** sponsor-listed demand. The event's own Good Neighbor copy describes exactly this pain ("helping a small nonprofit answer questions and coordinate events without a full-time coordinator"), and the FAQ encourages building for real orgs with synthetic data. Politeness-bias rule noted: no user interviews claimed.
- **Riskiest assumption:** a trustee would let an autonomous agent act on the org's behalf at all. Answered by design, not hope: policy-gated sends (limits per day, recipient allowlist), a pause-and-resume decision gate at the hook layer, a signed receipt for every action, and one-click stand-down. The trust surface IS the product.
- **Second risk:** "AI answers email" reads generic. Countered by species: scheduled background autonomy over a real mailbox with persistent org memory, not a chat panel. The demo shows a working week, not one clever reply.
- **Next small test:** the de-risk spike (below) is that test. If the hook-gated pause/resume on a real mailbox with persisted receipts cannot be proven in 48 hours, reassess.

## De-risk spike (before any UI, kill-check in force)
1. Real IMAP (or Gmail API) mailbox: read thread, classify, draft.
2. Strands agent loop with tools; scheduled run fires unattended.
3. Guardrail/hook gate: agent must pause a send at the policy line, persist state, resume on approval.
4. Receipt ledger: every tool call writes a verifiable, hash-chained receipt row.
Kill-check: if the mechanic reduces to "a prompt drafts replies", stop and reassess.
AgentCore: Runtime + Memory deploy attempt in the spike window; if cost/complexity blows the budget, deploy plain and disclose (page says AgentCore strengthens Technical Implementation, not required).

## Judging mapping
- Technical Implementation: Strands hooks/guardrails as the enforcement mechanism, AgentCore attempt, live demo link.
- Design: complete product (front door, inbox view, receipt ledger, decision porch), every state audited.
- Potential Impact: one named org archetype, hours-per-week saved, shown with numbers.
- Creativity & Originality: trust surface for delegated autonomy; the bell.
- Presentation: before/after week demo, ≤5 min video, VO gated on him.
- Bonus: up to 3 builder.aws.com posts, "Agents for Humans" in title, 0.2 each (needs AWS Builder ID + public posts before deadline).

## Design brief (design-direction block)
- **Consensus default (banned):** dark navy dashboard, purple/blue gradient hero, glassmorphic bento stat cards, AI chat panel front and center, emoji feature icons, "Powered by" footer.
- **Axes pushed:** (1) Color: warm parish-paper field, AWS smile-orange #fa6f00 as the only accent (mined from a0.awsstatic.com live CSS Sep 9; deep #eb5f07 hover; Squid Ink #232f3e ink ladder; console grey #eaeded), receipt-green reserved exclusively for verified-sent state. (2) Typography: humanist serif display (Fraunces-class), editorial but not engraved, distinct from scrip's security-print Bodoni. (3) Motion: scarcity-event choreography, motion exists only when the agent acts or asks.
- **Axes kept conventional:** layout (centered one-column fold per the document-not-stack lesson; inner screens quiet for usability).
- **Signature move:** THE DECISION BELL. The product promise made physical: the bell rings only when a real judgment call surfaces; a silent week is the on-screen success state. Mechanism test: it shows the gating mechanic itself, not decoration. 5-minute test: a competitor can render a bell, but bell-silent-by-design with live decision binding and receipt lineage is the product's own state machine. Demo test: the money moment IS the bell ringing live.
- **Avoid-list:** document/ledger layout, stamp strikes, mono-first, terminal instrument, stillness-as-pitch, desaturated verdict pairs, dark+single-accent (all owned by prior ledger entries), plus the consensus list above.
- **Familiarity anchor:** one quiet "on duty" status strip.
- **Chains to:** semantic-tokens → component-harvest → ui-craft → deterministic-design.

## Scope plan (5 days)
- Day 1 (Sep 9-10): scaffold + spike on real infra; AgentCore attempt; footage of the first autonomous round.
- Day 2 (Sep 10-11): UI family in full, front door, decision porch, receipt ledger; deploy early.
- Day 3 (Sep 11-12): state coverage audit (populated/empty/offline/mobile), mock-hunter, polish; three builder.aws posts drafted.
- Day 4 (Sep 12-13): demo-script storyboard, VO gated on him, takes per desktop rules, final gate.
- Day 5 (Sep 13-14): README-as-submission, architecture diagram, claims-verify, submission form, HIS submit click before Sep 14 5:00pm PT.

## Non-negotiables carried in
- No em dashes anywhere in UI strings, README, docs, or posts.
- Footer credits "built by Raphie" with the link to https://x.com/a_raphie.
- Public repo with MIT license visible in About before submission; new code only, pre-existing code disclosed.
- Clean URL is his call; never ship silently on a hash URL; SSO disabled after every deploy.
