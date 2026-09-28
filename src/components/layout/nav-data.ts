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

/** A MODULE: one slot in the bottom dock. */
export interface NavArea {
  label: string;
  /** Landing route when the dock slot is tapped. */
  href: string;
  icon: LucideIcon;
  /** SUBMODULES: shown in the dock's second (subnav) state. Empty = no subnav. */
  children: NavItem[];
}

/**
 * Full IA — single source of truth for the bottom dock.
 * 5 slots: Dashboard (single, no subnav) + 4 modules with subnavs.
 */
export const NAV_AREAS: NavArea[] = [
  { label: "Dashboard", href: "/dashboard", icon: House, children: [] },
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
      {
        href: "/dashboard/attendance",
        label: "Attendance",
        icon: ClipboardCheck,
      },
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
      { href: "/dashboard/payments", label: "Client Payments", icon: CreditCard },
      { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
    ],
  },
];

export function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Extra pathname prefixes that belong to a module without being a
 * listed subnav pill. Overtime is reached via Attendance, so it
 * highlights Labour without adding nav clutter.
 */
const AREA_ALIASES: { area: string; prefixes: string[] }[] = [
  { area: "Labour", prefixes: ["/dashboard/overtime"] },
];

/** The module the current route belongs to (child match wins, Dashboard is exact). */
export function activeArea(pathname: string): NavArea | undefined {
  if (pathname === "/dashboard") return NAV_AREAS[0];
  const direct = NAV_AREAS.slice(1).find((area) =>
    area.children.some((child) => isActive(pathname, child.href)),
  );
  if (direct) return direct;
  const alias = AREA_ALIASES.find((a) =>
    a.prefixes.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    ),
  );
  return alias ? NAV_AREAS.find((a) => a.label === alias.area) : undefined;
}
