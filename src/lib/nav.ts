import type { Permission } from "@/lib/rbac";

/** Broadcast, chat with one number, see what failed, who stayed quiet, who tapped Brand, who tapped Member. */
export type NavIcon = "send" | "message" | "failed" | "noReply" | "brand" | "leads";

export type NavItem = {
  href: string;
  label: string;
  /** One word for the phone tab bar, where six tabs share the width. */
  short: string;
  permission: Permission;
  icon: NavIcon;
};

export const NAV: NavItem[] = [
  { href: "/send", short: "Broadcast", label: "Broadcast", permission: "batch:manage", icon: "send" },
  { href: "/message", short: "Chats", label: "Chats", permission: "batch:manage", icon: "message" },
  { href: "/failed", short: "Failed", label: "Not Delivered", permission: "batch:read", icon: "failed" },
  { href: "/no-reply", short: "No Reply", label: "No Reply", permission: "batch:read", icon: "noReply" },
  { href: "/brand-leads", short: "Brand", label: "Brand Leads", permission: "qualified:read", icon: "brand" },
  { href: "/leads", short: "Final", label: "Final Leads", permission: "qualified:read", icon: "leads" },
];
