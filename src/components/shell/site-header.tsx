import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { navFor } from "@/lib/nav";
import { getSessionUser } from "@/lib/auth/session";
import { signOutAction } from "@/actions/auth";
import { unreadCount } from "@/lib/data/notifications";
import { Wordmark } from "./wordmark";

export async function SiteHeader() {
  const user = await getSessionUser();
  const unread = user ? await unreadCount(user.id) : 0;
  const items = navFor(user?.role ?? null).filter((i) => i.href !== "/settings" && i.href !== "/notifications" && i.href !== "/auth/sign-in");
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ivory/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 md:h-16 md:px-6">
        <Wordmark />
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {items.map(({ href, label }) => (
            <Link key={href} href={href} className="rounded-md px-3 py-2 text-sm font-medium text-charcoal/80 hover:bg-ivory-deep hover:text-charcoal">
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          {user ? (
            <>
              <Link href="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative rounded-md p-2 text-charcoal/80 hover:bg-ivory-deep">
                <Bell size={20} strokeWidth={1.75} />
                {unread > 0 && (
                  <span aria-hidden className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-oxblood px-1 text-center text-[10px] font-bold leading-4 text-ivory">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link href="/settings" className="hidden rounded-md px-3 py-2 text-sm font-medium text-charcoal/80 hover:bg-ivory-deep md:block">
                {user.displayName || "Account"}
              </Link>
              <form action={signOutAction}>
                <button type="submit" aria-label="Sign out" className="flex items-center gap-1.5 rounded-md border border-charcoal/25 px-3 py-2 text-sm font-medium hover:bg-ivory-deep">
                  <LogOut size={16} strokeWidth={1.75} />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </form>
            </>
          ) : (
            <Link href="/auth/sign-in" className="rounded-md bg-forest px-3.5 py-2 text-sm font-medium text-ivory hover:bg-forest/90">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
