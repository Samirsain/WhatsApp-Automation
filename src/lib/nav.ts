import type { Permission } from "@/lib/rbac";

/** Broadcast, chat with one number, see what failed, who got it but stayed quiet, who tapped Brand. */
export type NavIcon = "send" | "message" | "failed" | "noReply" | "leads";

export type NavItem = {
  href: string;
  label: string;
  permission: Permission;
  icon: NavIcon;
};

export const NAV: NavItem[] = [
  { href: "/send", label: "Broadcast", permission: "batch:manage", icon: "send" },
  { href: "/message", label: "Chats", permission: "batch:manage", icon: "message" },
  { href: "/failed", label: "Not delivered", permission: "batch:read", icon: "failed" },
  { href: "/no-reply", label: "No reply", permission: "batch:read", icon: "noReply" },
  { href: "/leads", label: "Brand leads", permission: "qualified:read", icon: "leads" },
];
