"use client";

/**
 * @deprecated Navigation moved to the glass bottom dock + contextual topbar.
 * Kept as a data-compat layer: imports resolve, rendering is removed.
 * New code should import from "./nav-data" instead.
 */
export { NAV_GROUPS, NAV_AREAS, isActive, activeArea } from "./nav-data";
export type { NavItem, NavGroup, NavArea } from "./nav-data";

export function SidebarNav() {
  return null;
}
