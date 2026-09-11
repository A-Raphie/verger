import Link from "next/link";
import { TopBar } from "@/components/chrome";
import { Bell } from "@/components/bell";
import { Badge, Card, LedgerRow, SectionHeader, StatusDot } from "@/components/kit";
import { readState } from "@/lib/state";

export const dynamic = "force-dynamic";

function timeOf(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default async function FrontDoor() {
  const s = await readState();
  const latest = s.receipts.slice(0, 3);

  return (
    <main className="min-h-screen">
      <TopBar
        right={
          <Link href="/desk" className="btn btn-ghost text-sm">
            Open the desk
          </Link>
        }
      />

      {/* hero: badge, title, sub, CTA, proof line */}
      <section className="mx-auto w-full max-w-3xl px-5 pt-20 text-center">
        <Badge tone="accent">For volunteer-run organizations</Badge>
        <h1 className="display mx-auto mt-6 max-w-2xl text-balance text-5xl text-ink sm:text-6xl">
          Your inbox answered. Every action on the record.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-ink-2">
          Verger is a front-desk agent that answers your organization&apos;s
          email, does the follow-up, and leaves a signed receipt for everything
          it did. It works on its own and holds each send for your yes.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/desk" className="btn btn-primary">
            Open the desk
          </Link>
        </div>
        <p className="mt-6 inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-xs uppercase tracking-wide text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <StatusDot tone={s.counts.chain_ok ? "live" : "idle"} />
            {s.org}
          </span>
          <span>{s.counts.sent} answered this week</span>
          <span className="inline-flex items-center gap-1.5">
            <Bell count={s.counts.awaiting} />
            {s.counts.awaiting > 0 ? `${s.counts.awaiting} waiting on the trustee` : "bell silent"}
          </span>
        </p>
      </section>

      {/* the framed live panel: real state, never a mock */}
      <section className="mx-auto mt-16 w-full max-w-3xl px-5">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <span className="micro">Live desk · {s.org}</span>
            <Bell count={s.counts.awaiting} />
          </div>
          <div className="px-5 py-2">
            {latest.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-2">
                No receipts yet. The first round writes the first row.
              </p>
            ) : (
              latest.map((r) => (
                <LedgerRow
                  key={r.seq}
                  action={r.action}
                  detail={
                    [r.payload.to, r.payload.subject]
                      .filter(Boolean)
                      .join(" · ") || r.action.replaceAll("_", " ")
                  }
                  time={timeOf(r.ts)}
                />
              ))
            )}
          </div>
          <div className="border-t border-line px-5 py-3">
            <Link
              href="/desk"
              className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
            >
              See the full ledger and the decision porch
            </Link>
          </div>
        </Card>
      </section>

      {/* the boundary: can / cannot beats a feature list */}
      <section className="mx-auto mt-24 w-full max-w-3xl px-5">
        <SectionHeader index="01" label="The boundary" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Card>
            <h2 className="font-semibold text-ink">What Verger does</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-ink-2">
              <li>Reads the org inbox on a schedule and answers routine email end to end</li>
              <li>Shows you every word of every draft before it can possibly go out</li>
              <li>Chases missing details and files what arrived</li>
              <li>Leaves a receipt for every action, hash-chained in order</li>
              <li>Rings the bell only when a real judgment call needs a human</li>
            </ul>
          </Card>
          <Card>
            <h2 className="font-semibold text-ink">What Verger will never do</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-ink-2">
              <li>Send a single email without the trustee&apos;s explicit yes</li>
              <li>Write to anyone outside the trustee&apos;s allowlist</li>
              <li>Act without leaving a receipt a human can audit later</li>
            </ul>
          </Card>
        </div>
      </section>

      {/* mechanism: three steps + one flow line */}
      <section className="mx-auto mt-24 w-full max-w-3xl px-5">
        <SectionHeader index="02" label="How a week works" />
        <div className="mt-5 flex flex-col gap-4">
          {[
            ["Monday morning", "Verger reads the weekend inbox and drafts a reply for everything that deserves one."],
            ["The gate", "Every draft stops at the porch. The bell rings once. You approve or deny on your time; the session resumes where it paused."],
            ["The record", "Approvals, denials, sends, and reads all land on a hash-chained ledger. A quiet week is the success state."],
          ].map(([step, body], i) => (
            <div key={step} className="flex gap-4">
              <span className="font-mono text-sm font-bold text-accent">0{i + 1}</span>
              <div>
                <h3 className="font-semibold text-ink">{step}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{body}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 rounded-[var(--radius-input)] border border-line bg-subtle px-4 py-3 font-mono text-xs text-ink-2">
          inbox → read · draft → gate → trustee yes/no → send → receipt chain
        </p>
      </section>

      {/* final CTA */}
      <section className="mx-auto mt-24 w-full max-w-3xl px-5 pb-24 text-center">
        <h2 className="display text-3xl text-ink">Hand the front desk to Verger.</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-ink-2">
          Trust arrives by receipt, not by promise.
        </p>
        <Link href="/desk" className="btn btn-primary mt-6">
          Open the desk
        </Link>
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-ink-2">
        Verger · demo organization and inbox are synthetic · built by{" "}
        <a
          href="https://x.com/a_raphie"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-accent"
        >
          Raphie
        </a>{" "}
        for the AWS Agents for Humans hackathon
      </footer>
    </main>
  );
}
