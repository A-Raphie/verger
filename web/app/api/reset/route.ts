import { NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";

// Demo reset: back to Monday morning (fresh genesis). Guarded by a shared
// secret so no stranger can wipe the ledger mid-judging. QA harness + demo-day
// reset, kept in the repo per ship-rehearsal Phase 3.
export async function POST(request: Request) {
  const token = process.env.RESET_TOKEN;
  if (!token || request.headers.get("x-reset-token") !== token) {
    return NextResponse.json({ ok: false, error: "not authorized" }, { status: 403 });
  }
  const store = getStore({ name: "verger-state", consistency: "strong" });
  for (const key of ["mailbox", "mailbox:sent", "receipts", "pending", "round:messages"]) {
    await store.delete(key);
  }
  return NextResponse.json({ ok: true, reset: true });
}
