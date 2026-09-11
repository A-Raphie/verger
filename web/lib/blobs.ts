import { getStore } from "@netlify/blobs";

/*
  All Verger state lives in Netlify Blobs: the demo mailbox, the sent folder,
  the hash-chained receipt ledger, and the pending trustee decisions.
  Strong consistency: chunked rounds read-then-write across invocations.
*/

export type MailMessage = {
  id: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: number;
  handled: boolean;
  handleNote?: string;
};

export type SentMessage = {
  to: string;
  subject: string;
  body: string;
  sentAt: number;
  messageId: string;
  via: string;
};

export type Receipt = {
  seq: number;
  ts: number;
  action: string;
  payload: Record<string, unknown>;
  prev_hash: string;
  hash: string;
};

export type PendingItem = {
  id: string;
  name: string;
  reason: { to?: string; subject?: string; body?: string };
};

const STORE = "verger-state";

function store() {
  return getStore({ name: STORE, consistency: "strong" });
}

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await store().get(key, { type: "text" });
  if (!raw) return fallback;
  return JSON.parse(raw) as T;
}

async function setJSON(key: string, value: unknown): Promise<void> {
  await store().setJSON(key, value as Record<string, unknown> & unknown[]);
}

export async function getMailbox(): Promise<MailMessage[]> {
  return getJSON<MailMessage[]>("mailbox", []);
}

export async function setMailbox(messages: MailMessage[]): Promise<void> {
  await setJSON("mailbox", messages);
}

export async function getSent(): Promise<SentMessage[]> {
  return getJSON<SentMessage[]>("mailbox:sent", []);
}

export async function addSent(msg: SentMessage): Promise<void> {
  const all = await getSent();
  all.push(msg);
  await setJSON("mailbox:sent", all);
}

export async function getReceipts(): Promise<Receipt[]> {
  const raw = await store().get("receipts", { type: "text" });
  if (!raw) return [];
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export async function writeReceipts(receipts: Receipt[]): Promise<void> {
  const body = receipts.map((r) => JSON.stringify(r)).join("\n");
  await store().set("receipts", body);
}

export async function getPending(): Promise<Record<string, PendingItem>> {
  return getJSON<Record<string, PendingItem>>("pending", {});
}

export async function setPending(p: Record<string, PendingItem>): Promise<void> {
  await setJSON("pending", p);
}

export async function getRoundMessages(): Promise<unknown[]> {
  return getJSON<unknown[]>("round:messages", []);
}

export async function setRoundMessages(messages: unknown[]): Promise<void> {
  await setJSON("round:messages", messages);
}

export async function clearRound(): Promise<void> {
  await setJSON("round:messages", []);
}

// Seed exactly once: an empty mailbox gets the synthetic org inbox.
export async function ensureMailboxSeeded(): Promise<void> {
  const existing = await getMailbox();
  if (existing.length > 0) return;
  const now = Date.now();
  const seeds: MailMessage[] = [
    {
      id: "seed-1",
      from: "volunteer.maya@example.org",
      subject: "Volunteering this weekend?",
      body: "Hi! I'd like to volunteer this Saturday morning. What time do shifts start and do I need to bring anything? Thanks, Maya",
      receivedAt: now - 5000,
      handled: false,
    },
    {
      id: "seed-2",
      from: "elder.housing@example.org",
      subject: "Do you deliver to Elder Housing?",
      body: "Hello, we serve 40 residents at the Elder Housing complex. Do you deliver surplus food to us on weekdays? We have cold storage. Regards, Sam (activity coordinator)",
      receivedAt: now - 4000,
      handled: false,
    },
    {
      id: "seed-3",
      from: "donor.john@example.org",
      subject: "Change of pickup date?",
      body: "Hi, John here. I usually drop off bread Tuesdays but I'm travelling this week. Can we move my pickup donation to Thursday next week instead?",
      receivedAt: now - 3000,
      handled: false,
    },
    {
      id: "seed-4",
      from: "events@example.org",
      subject: "Booking the community hall",
      body: "Could we book the hall next Friday 6-9pm for a neighbourhood meeting? Roughly 30 people, we'd need chairs. Who confirms this?",
      receivedAt: now - 2000,
      handled: false,
    },
    {
      id: "seed-5",
      from: "no-reply@definitelyspam.biz",
      subject: "YOU HAVE WON!!!",
      body: "Congratulations!!! Click to claim your prize now!!! Limited time!!!",
      receivedAt: now - 1000,
      handled: false,
    },
  ];
  await setMailbox(seeds);
}
