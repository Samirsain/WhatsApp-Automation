import type { Permission } from "@/lib/rbac";

/** Three screens, nothing else: send, see what failed, see who tapped BRAND. */
export type NavIcon = "send" | "failed" | "leads";

export type NavItem = {
  href: string;
  label: string;
  permission: Permission;
  icon: NavIcon;
};

export const NAV: NavItem[] = [
  { href: "/send", label: "Bulk send", permission: "batch:manage", icon: "send" },
  { href: "/failed", label: "Not delivered", permission: "batch:read", icon: "failed" },
  { href: "/leads", label: "BRAND leads", permission: "qualified:read", icon: "leads" },
];
