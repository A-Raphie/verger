import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// The desk serves the agent's own state files: no mock data anywhere.
// Chain integrity is verified by the single writer (agent/ledger.py publishes
// chain.json on every append); the UI reads that verdict, it never re-derives
// it. In containers REPO_ROOT/VERGER_DATA are set explicitly; the default
// assumes dev runs from web/.
export const REPO_ROOT = process.env.REPO_ROOT ?? join(process.cwd(), "..");
export const DATA_DIR = process.env.VERGER_DATA ?? join(REPO_ROOT, ".data");
// Containers get the system venv; local dev uses the repo venv.
export const PYTHON_BIN =
  process.env.PYTHON_BIN ?? join(REPO_ROOT, ".venv", "bin", "python");

export type Receipt = {
  seq: number;
  ts: number;
  action: string;
  payload: Record<string, unknown>;
};

export type PendingItem = {
  id: string;
  name: string;
  reason: { to?: string; subject?: string; body?: string };
};

export type State = {
  ok: boolean;
  org: string;
  pending: PendingItem[];
  receipts: Receipt[];
  chain: { ok: boolean; rows: number; head: string; ts: number } | null;
  counts: {
    sent: number;
    denied: number;
    blocked: number;
    awaiting: number;
    total_receipts: number;
    chain_ok: boolean | null; // null = the agent has not published a verdict yet
  };
  error?: string;
};

export function readState(): State {
  const receiptsPath = join(DATA_DIR, "receipts.jsonl");
  const pendingPath = join(DATA_DIR, "pending-interrupts.json");
  const chainPath = join(DATA_DIR, "chain.json");

  let receipts: Receipt[] = [];
  if (existsSync(receiptsPath)) {
    receipts = readFileSync(receiptsPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  let pending: PendingItem[] = [];
  if (existsSync(pendingPath)) {
    const raw = JSON.parse(readFileSync(pendingPath, "utf8")) as Record<
      string,
      PendingItem
    >;
    pending = Object.values(raw);
  }

  let chain: State["chain"] = null;
  if (existsSync(chainPath)) {
    chain = JSON.parse(readFileSync(chainPath, "utf8"));
  }

  const sent = receipts.filter((r) => r.action === "mail_sent").length;
  const denied = receipts.filter((r) => r.action === "send_denied").length;
  const blocked = receipts.filter((r) => r.action === "send_blocked").length;

  return {
    ok: true,
    org: "Riverbank Community Fridge",
    pending,
    receipts: receipts.slice(-50).reverse(),
    chain,
    counts: {
      sent,
      denied,
      blocked,
      awaiting: pending.length,
      total_receipts: receipts.length,
      // null = no verdict published yet: unverified, NOT broken
      chain_ok: chain ? chain.ok : (null as unknown as boolean),
    },
  };
}
