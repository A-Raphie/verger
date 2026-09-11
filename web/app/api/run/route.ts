import { NextResponse } from "next/server";
import { ensureMailboxSeeded } from "@/lib/blobs";
import { processNextMessage } from "@/lib/verger";

// One chunk of a round: exactly one inbox message gets the agent's attention
// (Netlify functions cap at ~10s; the desk chains chunks until done/held).
export async function POST() {
  try {
    await ensureMailboxSeeded();
    const result = await processNextMessage();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "round chunk failed" },
      { status: 500 },
    );
  }
}
