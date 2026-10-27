import type { ReactNode } from "react";

export function AuthCard({ title, intro, children, footer }: { title: string; intro?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md py-10 md:py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
      {intro && <p className="mt-2 text-sm leading-relaxed text-charcoal/75">{intro}</p>}
      <div className="mt-6 space-y-4 rounded-[var(--radius-card)] border border-line bg-paper p-5">{children}</div>
      {footer && <div className="mt-4 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}
