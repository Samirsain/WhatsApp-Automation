import type { Permission } from "@/lib/rbac";

/** Four screens, nothing else: send, see what failed, who got it but stayed quiet, who tapped BRAND. */
export type NavIcon = "send" | "failed" | "noReply" | "leads";

export type NavItem = {
  href: string;
  label: string;
  permission: Permission;
  icon: NavIcon;
};

export const NAV: NavItem[] = [
  { href: "/send", label: "Bulk send", permission: "batch:manage", icon: "send" },
  { href: "/failed", label: "Not delivered", permission: "batch:read", icon: "failed" },
  { href: "/no-reply", label: "No reply", permission: "batch:read", icon: "noReply" },
  { href: "/leads", label: "BRAND leads", permission: "qualified:read", icon: "leads" },
];
