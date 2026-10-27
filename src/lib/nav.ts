import {
  Bell,
  ClipboardList,
  Droplets,
  FilePlus2,
  History,
  Home,
  LayoutDashboard,
  LogIn,
  Package,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/auth/roles";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const find: NavItem = { href: "/availability", label: "Find blood", icon: Search };
const request: NavItem = { href: "/request-blood", label: "Request", icon: FilePlus2 };
const alerts: NavItem = { href: "/notifications", label: "Alerts", icon: Bell };
const account: NavItem = { href: "/settings", label: "Account", icon: UserRound };

export function navFor(role: Role | null): NavItem[] {
  switch (role) {
    case "donor":
      return [
        { href: "/donor/dashboard", label: "Donate", icon: Droplets },
        { href: "/donor/profile", label: "Profile", icon: UserRound },
        find,
        alerts,
        account,
      ];
    case "staff":
      return [
        { href: "/hospital/dashboard", label: "Overview", icon: LayoutDashboard },
        { href: "/hospital/inventory", label: "Inventory", icon: Package },
        { href: "/hospital/requests", label: "Requests", icon: ClipboardList },
        alerts,
        account,
      ];
    case "admin":
      return [
        { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
        { href: "/admin/verifications", label: "Verify", icon: ShieldCheck },
        { href: "/admin/users", label: "Accounts", icon: Users },
        { href: "/admin/audit-logs", label: "Audit", icon: History },
        account,
      ];
    case "requester":
      return [{ href: "/", label: "Home", icon: Home }, find, request, alerts, account];
    default:
      return [
        { href: "/", label: "Home", icon: Home },
        find,
        request,
        { href: "/about", label: "About", icon: Droplets },
        { href: "/auth/sign-in", label: "Sign in", icon: LogIn },
      ];
  }
}
