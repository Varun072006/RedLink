"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Subscribes to row changes the signed-in user is already authorised to read (RLS applies to
 * Realtime) and refreshes the server-rendered data. It never carries record contents.
 */
export function LiveRefresh({ table, filter, channel }: { table: string; filter?: string; channel: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createBrowserSupabase();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = supabase
      .channel(channel)
      .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 400);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(sub);
    };
  }, [table, filter, channel, router]);
  return null;
}
