import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-ivory-deep">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted md:flex-row md:items-center md:justify-between md:px-6">
        <p className="max-w-xl">
          REDLINK coordinates information. It does not provide medical advice. In an emergency, contact the treating
          hospital or an authorized blood bank immediately.
        </p>
        <nav aria-label="Footer" className="flex gap-4">
          <Link href="/about" className="underline-offset-4 hover:underline">
            About
          </Link>
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
