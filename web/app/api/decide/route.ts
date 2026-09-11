import { NextResponse } from "next/server";
import { executeDecision } from "@/lib/verger";

// Trustee decision, deterministic: the pending item holds the exact draft, so
// approval sends precisely what was shown and denial records the refusal. The
// desk chains the next round chunk right after.
export async function POST(request: Request) {
  let body: { id?: string; decision?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const { id, decision } = body;
  if (!id || !["approve", "deny"].includes(decision ?? "")) {
    return NextResponse.json(
      { ok: false, error: "id and decision (approve|deny) required" },
      { status: 400 },
    );
  }
  try {
    const result = await executeDecision(decision!, id);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "decide failed" },
      { status: 500 },
    );
  }
}
