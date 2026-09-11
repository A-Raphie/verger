import { NextResponse } from "next/server";
import { readState } from "@/lib/ledger";

// Blobs live only inside the Netlify runtime; never prerender this route.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await readState());
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "state unreadable" },
      { status: 500 },
    );
  }
}
