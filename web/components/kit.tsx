import type { ReactNode } from "react";

/*
  The Verger component kit: the ONLY source of UI primitives.
  Commodity grammar harvested from MIT sources and re-expressed on Verger
  semantic tokens (zero raw hex): badge/pill + status dot + table + skeleton +
  empty state from coss.com/ui and beautifului.dev patterns; the Bell is the
  bespoke signature and lives in bell.tsx, never here.
*/

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "sent" | "waiting" | "error";
}) {
  /* pill grammar: coss.com/ui Badge, re-expressed on token status scale */
  const tones: Record<string, string> = {
    neutral: "bg-subtle text-ink-2 border-line",
    accent: "bg-accent-subtle text-ink border-line",
    sent: "bg-sent/10 text-sent-ink border-sent/25",
    waiting: "bg-subtle text-ink-2 border-line-strong",
    error: "bg-error/10 text-error border-error/25",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone = "idle" }: { tone?: "live" | "idle" | "error" }) {
  /* mono status-strip dot: winsznx landing anatomy; label always adjacent */
  const tones = {
    live: "bg-sent",
    idle: "bg-ink-3",
    error: "bg-error",
  } as const;
  return <span className={`inline-block size-1.5 rounded-full ${tones[tone]}`} aria-hidden />;
}

export function SectionHeader({ index, label }: { index: string; label: string }) {
  /* numbered section header: 01 / LABEL, mono accent per landing anatomy */
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-sm font-bold text-accent">{index} /</span>
      <span className="micro">{label}</span>
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  /* skeleton shaped like real content, not a spinner */
  return <div className={`animate-pulse rounded bg-subtle ${className}`} aria-hidden />;
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  /* empty teaches + exactly one action */
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line px-6 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-sm text-ink-2">{body}</p>
      {action}
    </div>
  );
}

export function LedgerRow({
  action,
  detail,
  time,
}: {
  action: string;
  detail: string;
  time: string;
}) {
  return (
    <div className="flex items-baseline gap-3 border-b border-line py-2.5 last:border-0">
      <span className="w-32 shrink-0 font-mono text-xs font-semibold uppercase tracking-wide text-ink-2">
        {action.replaceAll("_", " ")}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{detail}</span>
      <span className="shrink-0 font-mono text-xs tabular-nums text-ink-3">{time}</span>
    </div>
  );
}
