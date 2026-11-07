import type { Permission } from "@/lib/rbac";

/** Broadcast, follow the funnel, chat with one number, and who said no. */
export type NavIcon = "send" | "message" | "funnel" | "notInterested";

export type NavItem = {
  href: string;
  label: string;
  permission: Permission;
  icon: NavIcon;
};

export const NAV: NavItem[] = [
  { href: "/send", label: "Broadcast", permission: "batch:manage", icon: "send" },
  { href: "/funnel", label: "Funnel", permission: "batch:read", icon: "funnel" },
  { href: "/message", label: "Chats", permission: "batch:manage", icon: "message" },
  { href: "/not-interested", label: "Not Interested", permission: "batch:read", icon: "notInterested" },
];
