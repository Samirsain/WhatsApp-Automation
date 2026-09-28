import type { Permission } from "@/lib/rbac";

/** Send, message one number, see what failed, who got it but stayed quiet, who tapped BRAND. */
export type NavIcon = "send" | "message" | "failed" | "noReply" | "leads";

export type NavItem = {
  href: string;
  label: string;
  permission: Permission;
  icon: NavIcon;
};

export const NAV: NavItem[] = [
  { href: "/send", label: "Bulk send", permission: "batch:manage", icon: "send" },
  { href: "/message", label: "Message one", permission: "batch:manage", icon: "message" },
  { href: "/failed", label: "Not delivered", permission: "batch:read", icon: "failed" },
  { href: "/no-reply", label: "No reply", permission: "batch:read", icon: "noReply" },
  { href: "/leads", label: "BRAND leads", permission: "qualified:read", icon: "leads" },
];
