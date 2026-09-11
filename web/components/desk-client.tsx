"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "@/components/bell";
import {
  Badge,
  Card,
  EmptyState,
  LedgerRow,
  SectionHeader,
  StatusDot,
} from "@/components/kit";
import type { PendingItem, State } from "@/lib/state";

function timeOf(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DeskClient({ initialState }: { initialState: State }) {
  const [state, setState] = useState<State>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [roundWorking, setRoundWorking] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [armedDenyId, setArmedDenyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [ringKey, setRingKey] = useState<string | undefined>(undefined);
  const knownPending = useRef<Set<string>>(
    new Set(initialState.pending.map((p) => p.id)),
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const next = (await res.json()) as State;
      if (!next.ok) throw new Error(next.error ?? "state unreadable");
      setState(next);
      setError(null);
      for (const p of next.pending) {
        if (!knownPending.current.has(p.id)) {
          knownPending.current.add(p.id);
          setRingKey(p.id); // the bell rings once per genuinely new decision
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not reach the desk");
    }
  }, []);

  useEffect(() => {
    // Poll only while the tab is visible; hidden tabs burn edge requests (60s cap, was 4s)
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60000);
    return () => clearInterval(t);
  }, [refresh]);

  const runRound = async () => {
    setRoundWorking(true);
    setFlash(null);
    try {
      // A round is chunked: one inbox message per call (serverless budget).
      // The desk chains chunks so a full round still reads as one motion.
      for (let i = 0; i < 12; i++) {
        const res = await fetch("/api/run", { method: "POST" });
        const out = await res.json();
        if (!out.ok) {
          setFlash(`The round hit an error: ${out.error ?? "unknown"}`);
          break;
        }
        if (out.kind === "held") {
          setFlash(
            `Verger drafted a reply to ${out.to} and is holding it for your yes below.`,
          );
          break;
        }
        if (out.kind === "done") {
          setFlash("Round complete. The porch shows anything waiting on you.");
          break;
        }
        if (out.kind === "handled") {
          setFlash(`Handled: ${out.from} (${out.how}). Moving to the next…`);
          await refresh();
        }
      }
      await refresh();
    } catch {
      setFlash("Could not start the round. Try again.");
    } finally {
      setRoundWorking(false);
    }
  };

  const decide = async (item: PendingItem, decision: "approve" | "deny") => {
    // Deny is irreversible (the message is handled forever): arm first.
    if (decision === "deny" && armedDenyId !== item.id) {
      setArmedDenyId(item.id);
      setTimeout(() => setArmedDenyId((cur) => (cur === item.id ? null : cur)), 4000);
      return;
    }
    setArmedDenyId(null);
    setDecidingId(item.id);
    setFlash(null);
    try {
      const res = await fetch("/api/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, decision }),
      });
      const out = await res.json();
      if (out.ok) {
        setFlash(
          decision === "approve"
            ? `Approved. The reply went out: ${item.reason.subject ?? ""} · receipt recorded. The round continues below.`
            : `Denied. Verger was told no; the draft was cancelled and the denial is on the ledger.`,
        );
        // a decision unblocks the round: keep chaining
        setTimeout(() => void runRound(), 800);
      } else {
        setFlash(`The decision did not land: ${out.error ?? "unknown error"}`);
      }
      await refresh();
    } catch {
      setFlash("The decision did not land. Try again.");
    } finally {
      setDecidingId(null);
    }
  };

  const { counts } = state;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-24">
      {/* status strip: mono, real values only */}
      <div className="flex items-center gap-4 border-b border-line py-3 font-mono text-xs uppercase tracking-wide text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <StatusDot tone={counts.chain_ok === null ? "idle" : counts.chain_ok ? "live" : "error"} />
          {state.org}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <StatusDot tone={counts.chain_ok === null ? "idle" : counts.chain_ok ? "live" : "error"} />
          {counts.chain_ok === null
            ? `chain unverified · ${counts.total_receipts}`
            : counts.chain_ok
              ? `chain verified · ${counts.total_receipts}`
              : "chain broken"}
        </span>
        <span className="ml-auto inline-flex items-center gap-2">
          <Bell count={counts.awaiting} ringKey={ringKey} />
        </span>
      </div>

      {flash && (
        <p className="mt-4 rounded-[var(--radius-input)] border border-line bg-accent-subtle px-4 py-3 text-sm text-ink">
          {flash}
        </p>
      )}

      {error && (
        <Card className="mt-4 border-error/30">
          <p className="text-sm text-ink">{error}</p>
          <button className="btn btn-ghost mt-3" onClick={() => void refresh()}>
            Retry
          </button>
        </Card>
      )}

      {/* 01 · decision porch */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <SectionHeader index="01" label="Decision porch" />
          <button
            className="btn btn-primary text-sm"
            onClick={() => void runRound()}
            disabled={roundWorking}
          >
            {roundWorking ? "Starting the round…" : "Run a round"}
          </button>
        </div>
        <p className="mt-2 text-sm text-ink-2">
          Verger drafts every reply and holds each send here. Nothing leaves the
          organization without your yes.
        </p>

        <div className="mt-5 flex flex-col gap-4">
          {state.pending.length === 0 ? (
            <EmptyState
              title="The porch is quiet."
              body="Verger is holding nothing for you. Run a round and it will read the inbox, draft replies, and ring the bell if a send needs your yes."
              action={
                <button
                  className="btn btn-primary text-sm"
                  onClick={() => void runRound()}
                  disabled={roundWorking}
                >
                  {roundWorking ? "Starting the round…" : "Run a round"}
                </button>
              }
            />
          ) : (
            state.pending.map((p) => (
              <Card key={p.id} className="border-line-strong">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="waiting">Needs your yes</Badge>
                  <span className="font-mono text-xs text-ink-3">{p.reason.to}</span>
                </div>
                <h3 className="display mt-3 text-xl text-ink">{p.reason.subject}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-2">
                  {p.reason.body}
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    className="btn btn-primary text-sm"
                    onClick={() => void decide(p, "approve")}
                    disabled={decidingId === p.id}
                  >
                    {decidingId === p.id ? "Sending…" : "Approve · send it"}
                  </button>
                  <button
                    className={`btn text-sm ${armedDenyId === p.id ? "border border-error bg-error text-white" : "btn-ghost"}`}
                    onClick={() => void decide(p, "deny")}
                    disabled={decidingId === p.id}
                  >
                    {decidingId === p.id ? "Working…" : armedDenyId === p.id ? "Confirm deny" : "Deny"}
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* 02 · the week */}
      <section className="mt-12">
        <SectionHeader index="02" label="The week" />
        <div className="mt-4 grid grid-cols-3 gap-4">
          <Card className="text-center">
            <p className="number-lg text-3xl text-ink">{counts.sent}</p>
            <p className="micro mt-1">Answered</p>
          </Card>
          <Card className="text-center">
            <p className="number-lg text-3xl text-ink">{counts.awaiting}</p>
            <p className="micro mt-1">Waiting on you</p>
          </Card>
          <Card className="text-center">
            <p className="number-lg text-3xl text-ink">{counts.denied + counts.blocked}</p>
            <p className="micro mt-1">Kept out</p>
          </Card>
        </div>
      </section>

      {/* 03 · receipt ledger */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <SectionHeader index="03" label="Receipt ledger" />
          <Badge tone={counts.chain_ok === null ? "waiting" : counts.chain_ok ? "sent" : "error"}>
            {counts.chain_ok === null
              ? `chain unverified · ${counts.total_receipts} receipts`
              : counts.chain_ok
                ? `chain verified · ${counts.total_receipts} receipts`
                : "chain broken"}
          </Badge>
        </div>
        <Card className="mt-4">
          {state.receipts.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-2">
              No receipts yet. Run a round and every action lands here, hashed in
              order.
            </p>
          ) : (
            state.receipts.map((r) => (
              <LedgerRow
                key={r.seq}
                action={r.action}
                detail={
                  [
                    r.payload.to,
                    r.payload.subject,
                    typeof r.payload.count === "number" ? `${r.payload.count} messages` : undefined,
                  ]
                    .filter(Boolean)
                    .join(" · ") || r.action.replaceAll("_", " ")
                }
                time={timeOf(r.ts)}
              />
            ))
          )}
        </Card>
        <p className="mt-2 text-xs text-ink-3">
          Every row is hash-chained to the one before it. The verdict above is
          computed by the agent itself on every write, never by this page.
        </p>
      </section>

      <p className="mt-14 text-center text-xs text-ink-3">
        <Link href="/" className="text-ink-2 underline underline-offset-2 hover:text-accent">
          Back to the front door
        </Link>
      </p>
    </div>
  );
}
