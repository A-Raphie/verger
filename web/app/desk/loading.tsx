import { Skeleton } from "@/components/kit";

export default function DeskLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-24">
      <div className="flex items-center gap-4 border-b border-line py-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="mt-10 flex flex-col gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </main>
  );
}
