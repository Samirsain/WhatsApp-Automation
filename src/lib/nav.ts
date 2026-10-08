import type { Permission } from "@/lib/rbac";

/** Broadcast, chat with one number, files customers sent, see what failed, who stayed quiet, who tapped Brand, who tapped Member. */
export type NavIcon = "send" | "message" | "failed" | "noReply" | "brand" | "leads" | "media";

export type NavItem = {
  href: string;
  label: string;
  permission: Permission;
  icon: NavIcon;
};

export const NAV: NavItem[] = [
  { href: "/send", label: "Broadcast", permission: "batch:manage", icon: "send" },
  { href: "/message", label: "Chats", permission: "batch:manage", icon: "message" },
  { href: "/media", label: "Media", permission: "batch:manage", icon: "media" },
  { href: "/failed", label: "Not Delivered", permission: "batch:read", icon: "failed" },
  { href: "/no-reply", label: "No Reply", permission: "batch:read", icon: "noReply" },
  { href: "/brand-leads", label: "Brand Leads", permission: "qualified:read", icon: "brand" },
  { href: "/leads", label: "Final Leads", permission: "qualified:read", icon: "leads" },
];
