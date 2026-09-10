import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="micro">404 · nothing at this address</p>
      <h1 className="display text-4xl text-ink">This page is not on the round.</h1>
      <p className="max-w-sm text-sm text-ink-2">
        The desk and the front door are the two rooms there are.
      </p>
      <Link href="/" className="btn btn-primary mt-2 text-sm">
        Back to the front door
      </Link>
    </main>
  );
}
