import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { REPO_ROOT } from "@/lib/state";

// Trustee decision: resumes the agent session through the proven CLI and
// waits for it (a resumed round can take a couple of minutes on Groq).
const PYTHON = `${REPO_ROOT}/.venv/bin/python`;
const CLI = `${REPO_ROOT}/agent/cli.py`;

function decide(id: string, decision: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      PYTHON,
      [CLI, "decide", id, decision],
      { cwd: REPO_ROOT, timeout: 240000, maxBuffer: 1024 * 1024, encoding: "utf8" },
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
    try {
      return NextResponse.json({ ok: true, result: JSON.parse(last) });
    } catch {
      return NextResponse.json({ ok: true, raw: out.slice(-400) });
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "decide failed" },
      { status: 500 },
    );
  }
}
