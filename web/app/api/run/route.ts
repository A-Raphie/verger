import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { PYTHON_BIN, REPO_ROOT } from "@/lib/state";

// Starts an unattended agent round. Fire-and-forget: the desk polls /api/state
// and the bell does its one job when a decision lands. Local demo control
// plane; no auth by design (test org data only).
export async function POST() {
  const child = spawn(PYTHON_BIN, [`${REPO_ROOT}/agent/cli.py`, "run"], {
    cwd: REPO_ROOT,
    env: process.env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return NextResponse.json({ ok: true, started: true, pid: child.pid });
}
