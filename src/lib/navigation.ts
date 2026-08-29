import {
  Calendar,
  Home,
  Library,
  Megaphone,
  Package,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";

export type BuyerSectionKey = "search" | "home" | "schedule" | "materials" | "notifications";

export type SellerSectionKey =
  | "products"
  | "announcements"
  | "materials"
  | "schedule"
  | "users"
  | "account";

export type RailSectionKey = BuyerSectionKey | SellerSectionKey;

export const BUYER_NAV_ITEMS: {
  key: Exclude<BuyerSectionKey, "notifications">;
  labelKey: "navSearch" | "navHome" | "schedule" | "materials";
  icon: LucideIcon;
  to: string;
}[] = [
  { key: "search", labelKey: "navSearch", icon: Search, to: "/" },
  { key: "home", labelKey: "navHome", icon: Home, to: "/dashboard" },
  { key: "schedule", labelKey: "schedule", icon: Calendar, to: "/dashboard/schedule" },
  { key: "materials", labelKey: "materials", icon: Library, to: "/dashboard/materials" },
];

export const BUYER_NOTIFICATIONS_PATH = "/dashboard/notifications";

export const SELLER_NAV_ITEMS: {
  key: SellerSectionKey;
  labelKey: "products" | "announcements" | "materials" | "schedule" | "users";
  icon: LucideIcon;
}[] = [
  { key: "products", labelKey: "products", icon: Package },
  { key: "announcements", labelKey: "announcements", icon: Megaphone },
  { key: "materials", labelKey: "materials", icon: Library },
  { key: "schedule", labelKey: "schedule", icon: Calendar },
  { key: "users", labelKey: "users", icon: Users },
];

export function buyerSectionFromPath(pathname: string): BuyerSectionKey | null {
  if (pathname === "/") return "search";
  if (pathname.startsWith("/dashboard/schedule")) return "schedule";
  if (pathname.startsWith("/dashboard/materials")) return "materials";
  if (pathname.startsWith("/dashboard/notifications")) return "notifications";
  if (pathname === "/dashboard" || pathname === "/dashboard/") return "home";
  return null;
}

export function isSellerSection(key: string): key is SellerSectionKey {
  return SELLER_NAV_ITEMS.some((item) => item.key === key) || key === "account";
}

export function creatorTabFromPath(pathname: string, search: string): SellerSectionKey {
  if (!pathname.startsWith("/creator")) return "products";
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  if (tab && isSellerSection(tab)) return tab;
  return "products";
}
