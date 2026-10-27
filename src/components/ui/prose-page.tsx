import type { ReactNode } from "react";

export function ProsePage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <article className="max-w-2xl py-10 md:py-14">
      <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
      {intro && <p className="mt-3 text-base leading-relaxed text-charcoal/80">{intro}</p>}
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-charcoal/85 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-charcoal">
        {children}
      </div>
    </article>
  );
}
