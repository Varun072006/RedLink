import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="space-y-4 py-10" role="status" aria-label="Loading">
      <Skeleton className="h-9 w-2/3 max-w-md" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-40 w-full" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
