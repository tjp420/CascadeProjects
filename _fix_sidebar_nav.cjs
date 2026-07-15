const fs = require('fs');
const f = 'simplebeacon-vscode-merged/src/modernSidebarProvider.ts';
let c = fs.readFileSync(f, 'utf8');

// Fix 1: First handler - dashboard/openDashboard case (line ~1083)
const old1 = "          case 'dashboard':\n          case 'openDashboard':\n            ModernSidebarProvider.openDashboardRouteInBrowser('/dashboard');\n            ModernSidebarProvider.relayCommand('dashboard');\n            break;";
const new1 = "          case 'dashboard':\n          case 'openDashboard':\n            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showDashboardPane();\n            ModernSidebarProvider.relayCommand('dashboard');\n            break;";
if (!c.includes(old1)) { console.error('OLD1 NOT FOUND'); process.exit(1); }
c = c.replace(old1, new1);
console.log('Fix 1 applied: dashboard/openDashboard -> WelcomeDashboard');

// Fix 2: showDashboard case (line ~996)
const old2 = "          case 'showDashboard':\n            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/dashboard');\n            break;";
const new2 = "          case 'showDashboard':\n            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showDashboardPane();\n            break;";
if (!c.includes(old2)) { console.error('OLD2 NOT FOUND'); process.exit(1); }
c = c.replace(old2, new2);
console.log('Fix 2 applied: showDashboard -> WelcomeDashboard');

// Fix 3: openCloudInBrowser/openCloudInPreview (line ~1007-1009)
const old3 = "          case 'openCloudInBrowser':\n          case 'openCloudInPreview':\n            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/dashboard');\n            break;";
const new3 = "          case 'openCloudInBrowser':\n          case 'openCloudInPreview':\n            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showDashboardPane();\n            break;";
if (!c.includes(old3)) { console.error('OLD3 NOT FOUND'); process.exit(1); }
c = c.replace(old3, new3);
console.log('Fix 3 applied: openCloudInBrowser -> WelcomeDashboard');

// Fix 4: navDashboard (line ~1544)
const old4 = "          case 'navDashboard':\n            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/dashboard');\n            ModernSidebarProvider.relayCommand('navDashboard');\n            break;";
const new4 = "          case 'navDashboard':\n            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showDashboardPane();\n            ModernSidebarProvider.relayCommand('navDashboard');\n            break;";
if (!c.includes(old4)) { console.error('OLD4 NOT FOUND'); process.exit(1); }
c = c.replace(old4, new4);
console.log('Fix 4 applied: navDashboard -> WelcomeDashboard');

// Fix 5: Second handler openDashboard (line ~5032)
const old5 = "        case 'openDashboard':\n          ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/dashboard');\n          break;";
const new5 = "        case 'openDashboard':\n          WelcomeDashboard.createOrShow(this._extensionUri, true)?.showDashboardPane();\n          break;";
if (!c.includes(old5)) { console.error('OLD5 NOT FOUND'); process.exit(1); }
c = c.replace(old5, new5);
console.log('Fix 5 applied: second handler openDashboard -> WelcomeDashboard');

// Fix 6: Second handler openCloudInBrowser (line ~5051)
const old6 = "        case 'openCloudInBrowser':\n        case 'openCloudInPreview':\n          ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/dashboard');\n          break;";
const new6 = "        case 'openCloudInBrowser':\n        case 'openCloudInPreview':\n          WelcomeDashboard.createOrShow(this._extensionUri, true)?.showDashboardPane();\n          break;";
if (!c.includes(old6)) { console.error('OLD6 NOT FOUND'); process.exit(1); }
c = c.replace(old6, new6);
console.log('Fix 6 applied: second handler openCloudInBrowser -> WelcomeDashboard');

// Fix 7: Second handler openAdvancedInBrowser (line ~5059)
const old7 = "        case 'openAdvancedInBrowser':\n        case 'openAdvancedInPreview':\n          ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/dashboard');\n          break;";
const new7 = "        case 'openAdvancedInBrowser':\n        case 'openAdvancedInPreview':\n          WelcomeDashboard.createOrShow(this._extensionUri, true)?.showDashboardPane();\n          break;";
if (!c.includes(old7)) { console.error('OLD7 NOT FOUND'); process.exit(1); }
c = c.replace(old7, new7);
console.log('Fix 7 applied: second handler openAdvancedInBrowser -> WelcomeDashboard');

fs.writeFileSync(f, c, 'utf8');
console.log('All fixes applied successfully');
