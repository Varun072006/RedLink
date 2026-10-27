import "server-only";
import webpush from "web-push";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isPushConfigured, isServiceConfigured } from "@/lib/env";

const MAX_ATTEMPTS = 3;
let configured = false;

function setup() {
  if (configured) return true;
  if (!isPushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.org",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
  return true;
}

/**
 * Delivers pending push notifications. In-app notifications are already persisted, so a push
 * failure never loses the message; after repeated failures the push is marked failed.
 */
export async function dispatchPendingPush(limit = 50): Promise<{ sent: number; failed: number }> {
  if (!isServiceConfigured() || !setup()) return { sent: 0, failed: 0 };
  const sb = createAdminSupabase();
  const { data: pending } = await sb
    .from("notifications")
    .select("id,user_id,title,body,link,push_attempts")
    .eq("push_status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  let sent = 0;
  let failed = 0;
  for (const n of pending ?? []) {
    const { data: subs } = await sb.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", n.user_id);
    if (!subs?.length) {
      await sb.from("notifications").update({ push_status: "none" }).eq("id", n.id);
      continue;
    }
    let delivered = false;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: n.title, body: n.body, url: n.link ?? "/notifications" }),
          { TTL: 3600 },
        );
        delivered = true;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await sb.from("push_subscriptions").delete().eq("id", s.id);
      }
    }
    const attempts = n.push_attempts + 1;
    if (delivered) {
      sent++;
      await sb.from("notifications").update({ push_status: "sent", push_attempts: attempts }).eq("id", n.id);
    } else {
      failed++;
      await sb
        .from("notifications")
        .update({ push_status: attempts >= MAX_ATTEMPTS ? "failed" : "pending", push_attempts: attempts })
        .eq("id", n.id);
    }
  }
  return { sent, failed };
}
