import { Agent, tool, BeforeToolCallEvent } from "@strands-agents/sdk";
import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import { z } from "zod";
import {
  addSent,
  getMailbox,
  getPending,
  getRoundMessages,
  setMailbox,
  setPending,
  setRoundMessages,
  type MailMessage,
} from "./blobs";
import { appendReceipt, markHandled } from "./ledger";
import type { PendingItem } from "./types";

/*
  The Verger agent, serverless edition: the Strands TypeScript SDK running
  inside one Netlify function invocation per inbox message (~10s budget).

  The round is chunked: the caller (the desk, or the scheduled function) keeps
  invoking processNextMessage until it reports done or held. Conversation
  continuity rides in Blobs, so chunk N remembers what chunk N-1 answered.

  The gate is the product: a BeforeToolCallEvent hook checks the allowlist and
  raises a Strands interrupt on every send. The interrupt surfaces as
  stopReason 'interrupt'; the trustee decides; the send executes
  deterministically in /api/decide. A quiet round is the success state.
*/

export const ORG_NAME = "Riverbank Community Fridge";

const ALLOWLIST: Record<string, string> = {
  "volunteer.maya@example.org": "volunteer",
  "elder.housing@example.org": "partner org",
  "donor.john@example.org": "donor",
  "events@example.org": "hall enquiries",
};

const SYSTEM_PROMPT = `You are Verger, the front-desk agent for ${ORG_NAME} (desk@foodbank.local), a volunteer-run community food project. You keep the org's inbox alive so trustees don't have to.

You handle ONE inbox message per turn. For the message you were given:
1. read_message to see it in full if you need more than the summary.
2. Decide: routine question, judgment call, or spam.
3. Routine: send_mail with a warm, short, specific reply (under 120 words).
4. Judgment call (dates, money, access, safety): still send_mail, and say in one leading sentence that the trustee will confirm.
5. FACTS POLICY (absolute): never state a time, date, quantity, price, name, or CAPABILITY that was not in the message or given to you. This includes promises like "we do deliver" or "shifts start at 9" unless the message said so. For any such detail, write that the trustee will confirm it. An invented detail is the worst thing you can do.
6. Spam: call no_reply and move on.

You reply to people, never lecture them.`;

export type ChunkResult =
  | { kind: "done"; note: string }
  | { kind: "held"; pendingId: string; to: string; subject: string }
  | { kind: "handled"; how: string; from: string; subject: string };

function buildModel() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY missing");
  return new OpenAIModel({
    api: "chat",
    modelId: process.env.VERGER_MODEL ?? "openai/gpt-oss-20b",
    apiKey,
    clientConfig: { baseURL: "https://api.groq.com/openai/v1" },
  });
}

export async function processNextMessage(): Promise<ChunkResult> {
  const mailbox = await getMailbox();
  const next = mailbox.find((m: MailMessage) => !m.handled);
  if (!next) {
    await setRoundMessages([]);
    return { kind: "done", note: "inbox clear" };
  }

  let heldPendingId: string | null = null;
  let heldInfo = { to: "", subject: "" };

  const readMessage = tool({
    name: "read_message",
    description: "Read the full text of the inbox message you are handling.",
    inputSchema: z.object({}),
    callback: async () => {
      const fresh = (await getMailbox()).find((m) => m.id === next.id);
      return fresh
        ? { from: fresh.from, subject: fresh.subject, body: fresh.body }
        : { error: "message vanished" };
    },
  });

  const sendMail = tool({
    name: "send_mail",
    description:
      "Send one reply from the org desk. Every send passes the trustee gate.",
    inputSchema: z.object({
      to: z.string().describe("recipient email address"),
      subject: z.string().describe("reply subject line"),
      body: z.string().describe("plain-text reply body"),
    }),
    callback: async (input: { to: string; subject: string; body: string }) => {
      // The gate hook raises the interrupt; this body only runs once approved.
      const messageId = `verger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await addSent({
        to: input.to,
        subject: input.subject,
        body: input.body,
        sentAt: Date.now(),
        messageId,
        via: "netlify-demo-transport",
      });
      await markHandled(next.id, `replied: ${input.subject}`);
      await appendReceipt("mail_sent", {
        to: input.to,
        subject: input.subject,
        message_id: messageId,
      });
      return `sent to ${input.to}`;
    },
  });

  const noReply = tool({
    name: "no_reply",
    description:
      "Record that this message deliberately gets no reply (spam, abuse, nothing to act on).",
    inputSchema: z.object({ reason: z.string().describe("one short line") }),
    callback: async (input: { reason: string }) => {
      await markHandled(next.id, `no reply: ${input.reason}`);
      await appendReceipt("no_reply", {
        from: next.from,
        subject: next.subject,
        reason: input.reason,
      });
      return "recorded";
    },
  });

  const agent = new Agent({
    model: buildModel(),
    systemPrompt: SYSTEM_PROMPT,
    tools: [readMessage, sendMail, noReply],
    printer: false,
    messages: (await getRoundMessages()) as never,
  });

  // The gate: allowlist is the hard floor, then a Strands interrupt pauses the
  // send until the trustee decides. Registered post-construction via addHook.
  agent.addHook(BeforeToolCallEvent, (event) => {
    if (event.toolUse.name !== "send_mail") return;
    const input = event.toolUse.input as {
      to?: string;
      subject?: string;
      body?: string;
    };
    const to = String(input?.to ?? "").trim();
    if (!(to in ALLOWLIST)) {
      event.cancel = `BLOCKED BY POLICY: recipient ${to} is not on the trustee allowlist`;
      void appendReceipt("send_blocked", {
        to,
        subject: String(input?.subject ?? ""),
      });
      return;
    }
    event.interrupt({
      name: "trustee-send-approval",
      reason: {
        to: input.to ?? "",
        subject: input.subject ?? "",
        body: (input.body ?? "").slice(0, 400),
      },
    });
  });

  const result = await agent.invoke(
    `Handle this inbox message. From: ${next.from} | Subject: ${next.subject}`,
  );

  // carry the conversation forward for the next chunk of this round
  await setRoundMessages(agent.messages);

  if (result.stopReason === "interrupt") {
    const pending = await getPending();
    for (const intr of result.interrupts ?? []) {
      const reason = (intr.reason ?? {}) as {
        to?: string;
        subject?: string;
        body?: string;
      };
      heldPendingId = intr.id;
      heldInfo = { to: reason.to ?? "", subject: reason.subject ?? "" };
      pending[intr.id] = {
        id: intr.id,
        name: intr.name,
        reason,
      };
      await appendReceipt("send_awaiting", {
        interrupt_id: intr.id,
        to: reason.to,
        subject: reason.subject,
      });
    }
    await setPending(pending);
    await markHandled(next.id, `held at the gate: ${heldInfo.subject}`);
    return {
      kind: "held",
      pendingId: heldPendingId ?? "",
      to: heldInfo.to,
      subject: heldInfo.subject,
    };
  }

  // if the model finished without acting, do not silently strand the message
  const fresh = (await getMailbox()).find((m) => m.id === next.id);
  if (fresh && !fresh.handled) {
    await markHandled(next.id, "agent closed without action");
    await appendReceipt("no_reply", {
      from: next.from,
      subject: next.subject,
      reason: "agent closed without acting",
    });
  }

  if (result.stopReason === "cancelled_tool") {
    return {
      kind: "handled",
      how: "blocked by policy",
      from: next.from,
      subject: next.subject,
    };
  }
  return {
    kind: "handled",
    how: "agent handled it",
    from: next.from,
    subject: next.subject,
  };
}

// Deterministic trustee decision: approve sends the EXACT approved draft, deny
// records the refusal; either way the message is handled and the round continues.
export async function executeDecision(
  decision: string,
  interruptId: string | null,
): Promise<{ stop_reason: string; still_pending: number }> {
  const pending = await getPending();
  const id = interruptId ?? Object.keys(pending)[0];
  if (!id || !pending[id]) return { stop_reason: "nothing-pending", still_pending: Object.keys(pending).length };
  const item = pending[id];
  const to = item.reason.to ?? "";
  const subject = item.reason.subject ?? "";

  if (!(to in ALLOWLIST)) {
    await appendReceipt("send_blocked", { to, subject, why: "not on allowlist", interrupt_id: id });
    delete pending[id];
    await setPending(pending);
    await markHandledByTo(to, "blocked by allowlist");
    return { stop_reason: "blocked", still_pending: Object.keys(pending).length };
  }

  if (decision.trim().toLowerCase() in { approve: 1, y: 1, yes: 1 }) {
    await appendReceipt("send_approved", { to, subject, interrupt_id: id });
    const messageId = `verger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await addSent({
      to,
      subject,
      body: item.reason.body ?? "",
      sentAt: Date.now(),
      messageId,
      via: "netlify-demo-transport",
    });
    await appendReceipt("mail_sent", { to, subject, message_id: messageId });
    await markHandledByTo(to, `replied: ${subject}`);
    await deletePending(pending, id);
    return { stop_reason: "sent", still_pending: Object.keys(pending).length };
  }

  await appendReceipt("send_denied", { to, subject, interrupt_id: id });
  await markHandledByTo(to, `denied: ${subject}`);
  await deletePending(pending, id);
  return { stop_reason: "denied", still_pending: Object.keys(pending).length };
}

async function markHandledByTo(to: string, note: string): Promise<void> {
  const mailbox = await getMailbox();
  const m = mailbox.find(
    (x) => !x.handled && x.from === to, // the pending item's `to` is the original sender
  );
  if (m) {
    m.handled = true;
    m.handleNote = note;
    await setMailbox(mailbox);
  }
}

async function deletePending(
  pending: Record<string, PendingItem>,
  id: string,
): Promise<void> {
  delete pending[id];
  await setPending(pending);
}
