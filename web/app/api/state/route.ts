import { NextResponse } from "next/server";
import { readState } from "@/lib/state";

export async function GET() {
  try {
    return NextResponse.json(readState());
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "state unreadable" },
      { status: 500 },
    );
  }
}
