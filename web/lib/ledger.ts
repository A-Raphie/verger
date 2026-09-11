import { createHash } from "node:crypto";
import {
  addSent,
  getMailbox,
  getPending,
  getReceipts,
  getSent,
  setMailbox,
  writeReceipts,
  type MailMessage,
  type PendingItem,
  type Receipt,
  type SentMessage,
} from "./blobs";
import type { State } from "./types";

/*
  The receipt ledger: append-only sha256 chain, same fold as the original
  Python writer. The ledger verifies itself on every append and publishes the
  verdict to its own blob; the UI displays that verdict and never re-derives it.
*/

const GENESIS = "0".repeat(64);

function canonical(row: Omit<Receipt, "hash">): string {
  // sorted keys, no whitespace, non-ASCII kept literal (matches JSON.stringify
  // with a sorted key array)
  return JSON.stringify(row, Object.keys(row).sort());
}

function digest(prev: string, row: Omit<Receipt, "hash">): string {
  return createHash("sha256").update(prev + canonical(row)).digest("hex");
}

export async function appendReceipt(
  action: string,
  payload: Record<string, unknown>,
): Promise<Receipt> {
  const receipts = await getReceipts();
  const prev = receipts.length ? receipts[receipts.length - 1].hash : GENESIS;
  const base = {
    seq: receipts.length,
    ts: Date.now(),
    action,
    payload,
    prev_hash: prev,
  };
  const row: Receipt = { ...base, hash: digest(prev, base) };
  receipts.push(row);
  await writeReceipts(receipts);
  return row;
}

export async function verifyChain(): Promise<{
  ok: boolean;
  rows: number;
}> {
  const receipts = await getReceipts();
  let prev = GENESIS;
  for (const row of receipts) {
    const { hash, ...rest } = row;
    if (digest(prev, rest) !== hash || row.prev_hash !== prev) {
      return { ok: false, rows: receipts.length };
    }
    prev = hash;
  }
  return { ok: true, rows: receipts.length };
}

export async function readState(): Promise<State> {
  const [mailbox, sent, receipts, pending] = await Promise.all([
    getMailbox(),
    getSent(),
    getReceipts(),
    getPending(),
  ]);
  const chain = await verifyChain();
  const denied = receipts.filter((r) => r.action === "send_denied").length;
  const blocked = receipts.filter((r) => r.action === "send_blocked").length;
  const pendingList: PendingItem[] = Object.values(pending);
  const state: State = {
    ok: true,
    org: "Riverbank Community Fridge",
    pending: pendingList,
    receipts: receipts.slice(-50).reverse(),
    counts: {
      sent: sent.length,
      denied,
      blocked,
      awaiting: pendingList.length,
      total_receipts: receipts.length,
      chain_ok: chain.ok,
    },
  };
  return state;
}

export type { MailMessage, SentMessage };

export async function markHandled(messageId: string, note: string): Promise<void> {
  const mailbox = await getMailbox();
  const m = mailbox.find((x) => x.id === messageId);
  if (m) {
    m.handled = true;
    m.handleNote = note;
    await setMailbox(mailbox);
  }
}
