import Link from "next/link";
import { ArrowRight, Building2, Clock, HeartHandshake, Search, ShieldCheck } from "lucide-react";
import { InteractiveBloodDrop } from "@/components/ui/interactive-blood-drop";

const principles = [
  {
    icon: Clock,
    title: "Every figure carries a clock",
    body: "Stock shows the time staff last confirmed it. Old confirmations are labelled stale and never presented as current.",
  },
  {
    icon: ShieldCheck,
    title: "Willingness is not stock",
    body: "A donor saying yes and a blood bank confirming units are separate states. The interface never merges them.",
  },
  {
    icon: Search,
    title: "Matches explain themselves",
    body: "Each suggested source shows why it ranked where it did: verification, distance, freshness and response.",
  },
];

const audiences = [
  { href: "/request-blood", icon: ArrowRight, title: "I need blood", body: "Submit a request in four steps and follow it with a private link. No account needed." },
  { href: "/auth/sign-up?role=donor", icon: HeartHandshake, title: "I can donate", body: "Opt in, set when you are available, and see nearby requests without sharing your location." },
  { href: "/auth/sign-up?role=staff", icon: Building2, title: "We run a blood bank", body: "Register for verification, then keep stock current and respond to requests." },
];

export default function HomePage() {
  return (
    <div className="py-10 md:py-16">
      <section className="grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-oxblood">Blood availability &amp; donor coordination</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
            Know how recent the answer is before you act on it.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-charcoal/80 md:text-lg">
            REDLINK connects people who need blood with verified blood centres and willing donors, and shows how fresh every availability claim is.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/request-blood" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-oxblood px-5 py-3 text-sm font-semibold text-ivory hover:bg-oxblood-ink">
              Request blood <ArrowRight size={18} strokeWidth={1.75} aria-hidden />
            </Link>
            <Link href="/availability" className="inline-flex min-h-11 items-center justify-center rounded-md border border-charcoal/30 px-5 py-3 text-sm font-semibold hover:bg-ivory-deep">
              Search availability
            </Link>
          </div>
        </div>
        <div className="flex flex-col items-center justify-end gap-5">
          <div className="flex w-full items-center justify-center py-1">
            <InteractiveBloodDrop size="medium" />
          </div>
          <aside className="w-full rounded-[var(--radius-card)] border border-line bg-paper p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold">In an emergency</h2>
            <p className="mt-2 text-sm leading-relaxed text-charcoal/80">
              Contact the treating hospital or an authorized blood bank first. REDLINK helps widen the search; it cannot guarantee stock, compatibility or transfusion.
            </p>
          </aside>
        </div>
      </section>

      <section aria-labelledby="principles" className="mt-16 border-t border-line pt-10">
        <h2 id="principles" className="font-display text-2xl font-semibold">How REDLINK stays honest</h2>
        <ul className="mt-6 grid gap-6 md:grid-cols-3">
          {principles.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <Icon size={22} strokeWidth={1.75} className="text-forest" aria-hidden />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-charcoal/75">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="who" className="mt-16 border-t border-line pt-10">
        <h2 id="who" className="font-display text-2xl font-semibold">Where do you fit?</h2>
        <ul className="mt-6 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-paper">
          {audiences.map(({ href, icon: Icon, title, body }) => (
            <li key={href}>
              <Link href={href} className="flex items-center gap-4 p-4 hover:bg-ivory-deep">
                <Icon size={20} strokeWidth={1.75} className="shrink-0 text-oxblood" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-charcoal/75">{body}</span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
