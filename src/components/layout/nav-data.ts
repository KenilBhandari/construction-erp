import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  CreditCard,
  FolderKanban,
  House,
  Landmark,
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

/** A MODULE: one slot in the bottom dock. */
export interface NavArea {
  label: string;
  /** Landing route when the dock slot is tapped. */
  href: string;
  icon: LucideIcon;
  /** SUBMODULES: shown in the topbar when this module is active. Empty = no subnav. */
  children: NavItem[];
}

/** Full IA — single source of truth. */
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
 * MODULES (dock) → SUBMODULES (topbar).
 * Home has no submodules. Projects absorbs Sites as a submodule.
 */
export const NAV_AREAS: NavArea[] = [
  { label: "Home", href: "/dashboard", icon: House, children: [] },
  {
    label: "Projects",
    href: "/dashboard/projects",
    icon: FolderKanban,
    children: [
      { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
      { href: "/dashboard/sites", label: "Sites", icon: MapPin },
    ],
  },
  {
    label: "Labour",
    href: "/dashboard/labour",
    icon: UsersRound,
    children: [
      { href: "/dashboard/labour", label: "All Labour", icon: UsersRound },
      { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
      { href: "/dashboard/salary", label: "Salary", icon: Wallet },
    ],
  },
  {
    label: "Inventory",
    href: "/dashboard/materials",
    icon: Boxes,
    children: [
      { href: "/dashboard/materials", label: "Materials", icon: Boxes },
      { href: "/dashboard/stock", label: "Stock", icon: Package },
      { href: "/dashboard/purchases", label: "Purchases", icon: ShoppingCart },
    ],
  },
  {
    label: "Finance",
    href: "/dashboard/expenses",
    icon: Landmark,
    children: [
      { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
      { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
      { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
    ],
  },
];

export function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The module the current route belongs to (child match wins, Home is exact). */
export function activeArea(pathname: string): NavArea | undefined {
  if (pathname === "/dashboard") return NAV_AREAS[0];
  return NAV_AREAS.slice(1).find((area) =>
    area.children.some((child) => isActive(pathname, child.href)),
  );
}