"use client";

/**
 * @deprecated Navigation moved to the glass bottom dock.
 * Kept as a data-compat layer: imports resolve, rendering is removed.
 * New code should import from "./nav-data" instead.
 */
export { NAV_GROUPS, isActive, type NavItem, type NavGroup } from "./nav-data";
export { DOCK_ITEMS, MORE_GROUPS, MORE_HREFS } from "./nav-data";

export function SidebarNav() {
  return null;
}
