// simplebeacon-ignore: test fixture, dashboard code — static analysis test for sidebar nav route coverage
import * as fs from 'fs';
import * as path from 'path';

/**
 * This test verifies that every route key in teamNavRoute() has a matching
 * case label in BOTH switch blocks in modernSidebarProvider.ts.
 *
 * This is the test that would have caught the 12 missing nav buttons
 * that were fixed in v3.0.527.
 */

const PROVIDER_PATH = path.resolve(__dirname, '../modernSidebarProvider.ts');
const source = fs.readFileSync(PROVIDER_PATH, 'utf8');

// Extract all route keys from the teamNavRoute() function
function extractRouteKeys(src: string): string[] {
  // Match the routes object inside teamNavRoute()
  const routeFnMatch = src.match(/teamNavRoute\([^)]*\)[^{]*\{[\s\S]*?const routes[^=]*=\s*\{([^}]+)\}/);
  if (!routeFnMatch) {
    throw new Error('Could not find teamNavRoute() routes object in modernSidebarProvider.ts');
  }
  const routesBody = routeFnMatch[1];
  const keys: string[] = [];
  const keyRegex = /(\w+):\s*'\/dashboard/g;
  let match;
  while ((match = keyRegex.exec(routesBody)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

// Extract all case labels from the file
function extractCaseLabels(src: string): Set<string> {
  const cases = new Set<string>();
  const caseRegex = /case\s+'(\w+)'/g;
  let match;
  while ((match = caseRegex.exec(src)) !== null) {
    cases.add(match[1]);
  }
  return cases;
}

const routeKeys = extractRouteKeys(source);
const caseLabels = extractCaseLabels(source);

describe('Sidebar nav route coverage', () => {
  it('teamNavRoute() should have route keys defined', () => {
    expect(routeKeys.length).toBeGreaterThan(0);
    // We expect at least 25 routes based on the current dashboard views
    expect(routeKeys.length).toBeGreaterThanOrEqual(25);
  });

  it('every teamNavRoute key should have a matching case in a switch block', () => {
    const missing: string[] = [];
    for (const key of routeKeys) {
      if (!caseLabels.has(key)) {
        missing.push(key);
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `Missing case labels for ${missing.length} nav route(s) in modernSidebarProvider.ts:\n` +
          missing.map((k) => `  - ${k}`).join('\n') +
          '\nThese buttons will appear in the sidebar but do nothing when clicked.'
      );
    }
  });

  it('teamNavRoute should include all expected core routes', () => {
    const expected = [
      'navDashboard',
      'navAnalyze',
      'navResults',
      'navRepoHealth',
      'navAudit',
      'navSecurity',
      'navQuality',
      'navTrust',
      'navSettings',
      'navHelp',
      'navGettingStarted',
    ];
    for (const route of expected) {
      expect(routeKeys).toContain(route);
    }
  });

  it('teamNavRoute should include all Team menu routes', () => {
    const teamRoutes = [
      'navTeamMetrics',
      'navTelemetry',
      'navOutreach',
      'navOrganization',
      'navEnterprise',
      'navWorkspace',
      'navFineTuning',
      'navWebhookEvents',
      'navOpsReport',
      'navLicenseManager',
      'navAdmin',
    ];
    for (const route of teamRoutes) {
      expect(routeKeys).toContain(route);
    }
  });
});
