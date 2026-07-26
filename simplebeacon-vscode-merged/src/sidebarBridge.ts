/**
 * Sidebar Bridge — breaks the circular dependencies between welcomeDashboard.ts,
 * modernSidebarProvider.ts, and sidebarMessenger.ts.
 *
 * ModernSidebarProvider registers its static methods here during extension activation.
 * WelcomeDashboard and sidebarMessenger read them without importing ModernSidebarProvider directly.
 */

let _showDashboardInSidebar: (() => void) | null = null;
let _openSidebarInBrowserStatic: ((route: string) => void) | null = null;
let _isSidebarReady: (() => boolean) | null = null;
let _openSidebarPreview: (() => void) | null = null;
let _setSidebarAuthState: ((signedIn: boolean, tier?: string, token?: string, source?: string, isAdmin?: boolean) => void) | null = null;
let _getDashboardMode: (() => string) | null = null;
let _refreshAuthState: ((source?: string) => void) | null = null;
let _addDownloadedFile: ((filename: string, filePath: string) => void) | null = null;
let _updateSidebarReport: ((report: any) => void) | null = null;

export function setSidebarBridge(fns: {
  showDashboardInSidebar: () => void;
  openSidebarInBrowserStatic: (route: string) => void;
  isSidebarReady?: () => boolean;
  openSidebarPreview?: () => void;
  setSidebarAuthState?: (signedIn: boolean, tier?: string, token?: string, source?: string, isAdmin?: boolean) => void;
  getDashboardMode?: () => string;
  refreshAuthState?: (source?: string) => void;
  addDownloadedFile?: (filename: string, filePath: string) => void;
  updateSidebarReport?: (report: any) => void;
}) {
  _showDashboardInSidebar = fns.showDashboardInSidebar;
  _openSidebarInBrowserStatic = fns.openSidebarInBrowserStatic;
  _isSidebarReady = fns.isSidebarReady || null;
  _openSidebarPreview = fns.openSidebarPreview || null;
  _setSidebarAuthState = fns.setSidebarAuthState || null;
  _getDashboardMode = fns.getDashboardMode || null;
  _refreshAuthState = fns.refreshAuthState || null;
  _addDownloadedFile = fns.addDownloadedFile || null;
  _updateSidebarReport = fns.updateSidebarReport || null;
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

export function openSidebarPreview() {
  _openSidebarPreview?.();
}

export function setSidebarAuthState(signedIn: boolean, tier?: string, token?: string, source?: string, isAdmin?: boolean) {
  _setSidebarAuthState?.(signedIn, tier, token, source, isAdmin);
}

export function getDashboardMode(): string {
  return _getDashboardMode ? _getDashboardMode() : 'localhost';
}

export function refreshAuthState(source?: string) {
  _refreshAuthState?.(source);
}

export function addDownloadedFile(filename: string, filePath: string) {
  _addDownloadedFile?.(filename, filePath);
}

export function updateSidebarReport(report: any) {
  _updateSidebarReport?.(report);
}
