/**
 * Sidebar Bridge — breaks the welcomeDashboard.ts ↔ modernSidebarProvider.ts cycle.
 *
 * ModernSidebarProvider registers its static methods here during extension activation.
 * WelcomeDashboard reads them without importing ModernSidebarProvider directly.
 */

let _showDashboardInSidebar: (() => void) | null = null;
let _openSidebarInBrowserStatic: ((route: string) => void) | null = null;

export function setSidebarBridge(fns: {
  showDashboardInSidebar: () => void;
  openSidebarInBrowserStatic: (route: string) => void;
}) {
  _showDashboardInSidebar = fns.showDashboardInSidebar;
  _openSidebarInBrowserStatic = fns.openSidebarInBrowserStatic;
}

export function showDashboardInSidebar() {
  _showDashboardInSidebar?.();
}

export function openSidebarInBrowserStatic(route: string) {
  _openSidebarInBrowserStatic?.(route);
}
