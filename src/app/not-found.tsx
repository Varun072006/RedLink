import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-oxblood">404</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">This page isn&apos;t here.</h1>
      <p className="mt-3 max-w-md text-charcoal/80">The link may be mistyped or the page may have moved.</p>
      <Link href="/" className="mt-6 inline-block rounded-md bg-forest px-4 py-2.5 text-sm font-medium text-ivory">
        Back to home
      </Link>
    </div>
  );
}
