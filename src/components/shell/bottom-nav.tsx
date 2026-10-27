import { getSessionUser } from "@/lib/auth/session";
import { navFor } from "@/lib/nav";
import { BottomNavLinks } from "./bottom-nav-links";

export async function BottomNav() {
  const user = await getSessionUser();
  const items = navFor(user?.role ?? null).map(({ href, label }) => ({ href, label }));
  return <BottomNavLinks items={items} role={user?.role ?? null} />;
}
