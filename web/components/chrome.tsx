import Link from "next/link";

/* Shared chrome: wordmark + way back. Conventions over invention (Jakob). */
export function TopBar({ right }: { right?: React.ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 pt-6">
      <Link href="/" className="display text-2xl text-ink hover:text-accent">
        Verger
      </Link>
      {right}
    </header>
  );
}
