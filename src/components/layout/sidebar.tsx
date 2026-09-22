"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  MapPin,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Users;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/projects", label: "Projects", icon: Building2 },
      { href: "/dashboard/sites", label: "Sites", icon: MapPin },
    ],
  },
  {
    label: "Labour",
    items: [
      { href: "/dashboard/labour", label: "All Labour", icon: Users },
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

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5 px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-2 text-xs font-medium uppercase tracking-wide text-text-muted">
            {group.label}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary-light font-medium text-primary"
                        : "text-text hover:bg-background",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
