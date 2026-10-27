import Link from "next/link";

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="REDLINK home">
      <span aria-hidden className="relative flex h-6 w-6 items-center justify-center rounded-full bg-oxblood">
        <span className="h-0.5 w-3.5 bg-ivory" />
      </span>
      <span className="font-display text-xl font-semibold tracking-tight text-charcoal">REDLINK</span>
    </Link>
  );
}
