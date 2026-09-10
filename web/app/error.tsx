"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="micro">Something slipped</p>
      <h1 className="display text-4xl text-ink">The desk hit a snag.</h1>
      <p className="max-w-sm text-sm text-ink-2">
        The ledger on disk is untouched; this is only the view. Retry the page.
      </p>
      <button className="btn btn-primary mt-2 text-sm" onClick={reset}>
        Retry
      </button>
    </main>
  );
}
