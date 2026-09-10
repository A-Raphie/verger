"use client";

/*
  THE DECISION BELL: Verger's signature move, bespoke by rule.
  It swings exactly once per NEW pending trustee decision, then holds still.
  A silent bell is the product's success state on screen. The swing plays on
  the remount keyed by the newest pending id; interruptible by navigation and
  disabled under reduced motion via the global 0.01ms override.
*/

export function Bell({ count, ringKey }: { count: number; ringKey?: string }) {
  const ringing = Boolean(ringKey);
  return (
    <span className="relative inline-flex items-center" title={
      count > 0
        ? `${count} decision${count === 1 ? "" : "s"} waiting for the trustee`
        : "Silent: nothing needs the trustee"
    }>
      <svg
        key={ringKey ?? "still"}
        className={ringing ? "bell-swing" : ""}
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <path
          d="M12 3a6 6 0 0 0-6 6v3.2c0 .6-.2 1.2-.7 1.7L4 15.6c-.6.7-.1 1.9.9 1.9h14.2c1 0 1.5-1.2.9-1.9l-1.3-1.7c-.5-.5-.7-1.1-.7-1.7V9a6 6 0 0 0-6-6Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M10 20a2.2 2.2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      {count > 0 && (
        <span
          className="absolute -right-2 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-bold leading-4 text-accent-ink tabular-nums"
        >
          {count}
        </span>
      )}
    </span>
  );
}
