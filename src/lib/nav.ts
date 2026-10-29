import type { Permission } from "@/lib/rbac";

/** Broadcast, see what failed, who stayed quiet, who tapped Brand or Member, chat with one number, files customers sent. */
export type NavIcon = "send" | "message" | "failed" | "noReply" | "leads" | "media";

export type NavItem = {
  href: string;
  label: string;
  permission: Permission;
  icon: NavIcon;
};

export const NAV: NavItem[] = [
  { href: "/send", label: "Broadcast", permission: "batch:manage", icon: "send" },
  { href: "/failed", label: "Not Delivered", permission: "batch:read", icon: "failed" },
  { href: "/no-reply", label: "No Reply", permission: "batch:read", icon: "noReply" },
  // Brand Leads (/leads/brand) and Final Leads (/leads): one button, steps switch inside.
  { href: "/leads", label: "Leads", permission: "qualified:read", icon: "leads" },
  { href: "/message", label: "Chats", permission: "batch:manage", icon: "message" },
  { href: "/media", label: "Media", permission: "batch:manage", icon: "media" },
];
