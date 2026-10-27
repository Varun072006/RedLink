import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, FlaskConical, Info } from "lucide-react";

const tones = {
  info: { cls: "border-line bg-paper text-charcoal", Icon: Info, label: "Information" },
  warn: { cls: "border-warn/40 bg-[#f6ecd6] text-charcoal", Icon: AlertTriangle, label: "Warning" },
  error: { cls: "border-oxblood/40 bg-[#f3dfe1] text-oxblood-ink", Icon: AlertTriangle, label: "Error" },
  success: { cls: "border-forest/40 bg-[#dfeae4] text-forest", Icon: CheckCircle2, label: "Success" },
  demo: { cls: "border-warn/50 bg-[#f6ecd6] text-charcoal", Icon: FlaskConical, label: "Demonstration data" },
} as const;

export function Notice({ tone = "info", title, children }: { tone?: keyof typeof tones; title?: string; children?: ReactNode }) {
  const { cls, Icon, label } = tones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-[var(--radius-card)] border p-3.5 text-sm ${cls}`}>
      <Icon size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-label={label} />
      <div className="space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}

export function DemoBanner() {
  return (
    <Notice tone="demo" title="Synthetic demonstration data">
      No database is connected, so these centres, stock levels and confirmation times are simulated. They are not real facilities and
      must not be used to make decisions.
    </Notice>
  );
}

export function SetupNotice() {
  return (
    <Notice tone="warn" title="Backend not configured">
      This deployment has no Supabase connection yet. Add the environment variables described in the README to enable accounts,
      requests and live data.
    </Notice>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-charcoal/25 px-5 py-10 text-center">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {children && <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-ivory-deep motion-reduce:animate-none ${className}`} />;
}

export function PageHeader({ title, intro, actions }: { title: string; intro?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 pb-6 pt-8 md:flex-row md:items-end md:justify-between md:pt-12">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        {intro && <p className="mt-2 text-[15px] leading-relaxed text-charcoal/75">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[var(--radius-card)] border border-line bg-paper p-4 md:p-5 ${className}`}>{children}</section>;
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warn" | "bad" | "info"; children: ReactNode }) {
  const cls = {
    neutral: "bg-ivory-deep text-charcoal",
    good: "bg-[#dfeae4] text-forest",
    warn: "bg-[#f6ecd6] text-[#6b4510]",
    bad: "bg-[#f3dfe1] text-oxblood-ink",
    info: "bg-[#e5e8ea] text-charcoal",
  }[tone];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}
