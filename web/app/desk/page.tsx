import type { Metadata } from "next";
import { TopBar } from "@/components/chrome";
import { DeskClient } from "@/components/desk-client";
import { readState } from "@/lib/state";

export const metadata: Metadata = {
  title: "The desk",
  description:
    "Approve what Verger drafted, deny what it should not send, and read the receipt ledger.",
};

export const dynamic = "force-dynamic";

export default async function DeskPage() {
  const state = await readState();
  return (
    <main className="min-h-screen">
      <TopBar />
      <DeskClient initialState={state} />
    </main>
  );
}
