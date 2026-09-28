import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  CreditCard,
  FolderKanban,
  House,
  MapPin,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Full IA — single source of truth (previously lived in sidebar.tsx). */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: House },
      { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
      { href: "/dashboard/sites", label: "Sites", icon: MapPin },
    ],
  },
  {
    label: "Labour",
    items: [
      { href: "/dashboard/labour", label: "All Labour", icon: UsersRound },
      { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
      { href: "/dashboard/salary", label: "Salary", icon: Wallet },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/dashboard/materials", label: "Materials", icon: Boxes },
      { href: "/dashboard/stock", label: "Stock", icon: Package },
      { href: "/dashboard/purchases", label: "Purchases", icon: ShoppingCart },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
      { href: "/dashboard/payments", label: "Client Payments", icon: CreditCard },
      { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings }],
  },
];

/**
 * Dock = destinations (daily physical/business objects).
 * Home · Projects · Sites · Labour · More
 */
export const DOCK_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/sites", label: "Sites", icon: Building2 },
  { href: "/dashboard/labour", label: "Labour", icon: UsersRound },
];

/**
 * More = workflows performed around the dock destinations.
 * Dock destinations are NOT duplicated here (Home covers Dashboard,
 * Labour covers All Labour, etc.).
 */
export const MORE_GROUPS: NavGroup[] = [
  {
    label: "Labour",
    items: [
      { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
      { href: "/dashboard/salary", label: "Salary", icon: Wallet },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/dashboard/materials", label: "Materials", icon: Boxes },
      { href: "/dashboard/stock", label: "Stock", icon: Package },
      { href: "/dashboard/purchases", label: "Purchases", icon: ShoppingCart },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
      { href: "/dashboard/payments", label: "Client Payments", icon: CreditCard },
      { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings }],
  },
];

/** Flat href list for the "More" active-dot check. */
export const MORE_HREFS: string[] = MORE_GROUPS.flatMap((g) =>
  g.items.map((i) => i.href),
);

export function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
