"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navFor } from "@/lib/nav";
import type { Role } from "@/lib/auth/roles";

export function BottomNavLinks({ items, role }: { items: { href: string; label: string }[]; role: Role | null }) {
  const pathname = usePathname();
  const icons = new Map(navFor(role).map((i) => [i.href, i.icon]));
  return (
    <nav aria-label="Primary mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper md:hidden">
      <ul className="mx-auto flex max-w-md justify-between px-1 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ href, label }) => {
          const Icon = icons.get(href)!;
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium ${active ? "text-oxblood" : "text-muted"}`}
              >
                <Icon size={20} strokeWidth={1.75} />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
