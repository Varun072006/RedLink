import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";

export async function unreadCount(userId: string): Promise<number> {
  try {
    const supabase = await createServerSupabase();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}
