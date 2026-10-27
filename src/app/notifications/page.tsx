import type { Metadata } from "next";
import Link from "next/link";
import { MarkAllRead, MarkRead } from "@/components/account/account-forms";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("notifications")
    .select("id,title,body,link,read_at,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <div className="pb-10">
      <LiveRefresh channel={`notif-${user.id}`} table="notifications" filter={`user_id=eq.${user.id}`} />
      <PageHeader title="Notifications" intro={unread ? `${unread} unread` : "You are all caught up."} actions={<MarkAllRead disabled={unread === 0} />} />
      {items.length === 0 ? (
        <EmptyState title="No notifications yet">Updates about your requests, responses and facility verification appear here.</EmptyState>
      ) : (
        <ul className="mx-auto max-w-2xl divide-y divide-line rounded-[var(--radius-card)] border border-line bg-paper">
          {items.map((n) => (
            <li key={n.id} className={`flex items-start gap-3 p-4 ${n.read_at ? "" : "bg-[#f1ece0]"}`}>
              <span aria-hidden className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-oxblood"}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${n.read_at ? "" : "font-semibold"}`}>
                  {!n.read_at && <span className="sr-only">Unread: </span>}
                  {n.title}
                </p>
                {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                  <time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString()}</time>
                  {n.link && <Link href={safeNext(n.link, "/")} className="font-semibold text-forest underline underline-offset-4">Open</Link>}
                  {!n.read_at && <MarkRead id={n.id} />}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
