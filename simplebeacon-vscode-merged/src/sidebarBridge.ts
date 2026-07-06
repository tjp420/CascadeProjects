/**
 * Sidebar Bridge — breaks the welcomeDashboard.ts ↔ modernSidebarProvider.ts cycle.
 *
 * ModernSidebarProvider registers its static methods here during extension activation.
 * WelcomeDashboard reads them without importing ModernSidebarProvider directly.
 */

let _showDashboardInSidebar: (() => void) | null = null;
let _openSidebarInBrowserStatic: ((route: string) => void) | null = null;
let _isSidebarReady: (() => boolean) | null = null;

export function setSidebarBridge(fns: {
  showDashboardInSidebar: () => void;
  openSidebarInBrowserStatic: (route: string) => void;
  isSidebarReady?: () => boolean;
}) {
  _showDashboardInSidebar = fns.showDashboardInSidebar;
  _openSidebarInBrowserStatic = fns.openSidebarInBrowserStatic;
  _isSidebarReady = fns.isSidebarReady || null;
}

export function showDashboardInSidebar() {
  _showDashboardInSidebar?.();
}

export function openSidebarInBrowserStatic(route: string) {
  _openSidebarInBrowserStatic?.(route);
}

export function isSidebarReady(): boolean {
  return _isSidebarReady ? _isSidebarReady() : false;
}
