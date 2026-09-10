import { NextResponse } from "next/server";
import { execFile, spawn } from "node:child_process";
import { PYTHON_BIN, REPO_ROOT } from "@/lib/state";

// Trustee decision: executed deterministically (the pending item holds the
// full draft), then a fresh round fires in the background for the rest of the
// inbox. The decision itself returns instantly.
function decide(id: string, decision: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      PYTHON_BIN,
      [`${REPO_ROOT}/agent/cli.py`, "decide", id, decision],
      { cwd: REPO_ROOT, timeout: 60000, maxBuffer: 1024 * 1024, encoding: "utf8" },
      (err, stdout) => {
        if (err && !stdout) return reject(err);
        resolve(stdout);
      },
    );
  });
}

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
    const out = await decide(id, decision!);
    // the CLI prints a result JSON on its last line
    const lines = out.trim().split("\n");
    const last = lines[lines.length - 1];
    let parsed: { stop_reason?: string } = {};
    try {
      parsed = JSON.parse(last);
    } catch {
      return NextResponse.json({ ok: true, raw: out.slice(-400) });
    }
    // after an approval, fire a fresh round so the rest of the inbox is handled
    let nextRound: number | undefined;
    if (parsed.stop_reason === "sent") {
      const child = spawn(PYTHON_BIN, [`${REPO_ROOT}/agent/cli.py`, "run"], {
        cwd: REPO_ROOT,
        env: process.env,
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      nextRound = child.pid ?? undefined;
    }
    return NextResponse.json({ ok: true, result: parsed, nextRound });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "decide failed" },
      { status: 500 },
    );
  }
}
