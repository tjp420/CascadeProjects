/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ── Layer boundary rules ─────────────────────────────────────
    {
      name: 'no-cross-ui-imports',
      comment:
        'Dashboard/welcome modules should not import each other directly. Go through extension or utils. Same-family imports (e.g., welcomeDashboard→welcomeDashboardHtml) are allowed.',
      severity: 'error',
      from: {
        path: '^src/(dashboard[^/]*|welcomeDashboard[^/]*|web2Panel|settingsProvider|summaryProvider|roadmapProvider)\\.ts$',
      },
      to: {
        path: '^src/(dashboard[^/]*|welcomeDashboard[^/]*|web2Panel|settingsProvider|summaryProvider|roadmapProvider)\\.ts$',
        pathNot: '^src/(welcomeDashboardHtml|dashboardDataExtractor)\\.ts$',
      },
    },
    {
      name: 'utils-is-leaf',
      comment:
        'src/utils/ must only import from external packages, Node built-ins, or VS Code API. It should not depend on other src/ modules.',
      severity: 'error',
      from: { path: '^src/utils/' },
      to: {
        path: '^src/',
        pathNot: '^src/utils/',
      },
    },
    {
      name: 'auth-no-ui-imports',
      comment: 'Auth layer should not import UI/presentation modules directly.',
      severity: 'warn',
      from: { path: '^src/auth/' },
      to: {
        path: '^src/(dashboard[^/]*|welcomeDashboard[^/]*|modernSidebarProvider|visualSidebarProvider|web2Panel)',
      },
    },
    {
      name: 'aiplatform-no-ui-imports',
      comment: 'AI platform modules should not import UI/presentation modules directly.',
      severity: 'warn',
      from: { path: '^src/aiPlatform/' },
      to: {
        path: '^src/(dashboard[^/]*|welcomeDashboard[^/]*|modernSidebarProvider|visualSidebarProvider|web2Panel)',
      },
    },
    {
      name: 'scan-provider-isolation',
      comment: 'Scan providers should not import dashboard or welcome UI directly.',
      severity: 'warn',
      from: { path: '^src/(scanProvider|enhancedScanProvider|enhancedAIProvider)/' },
      to: {
        path: '^src/(dashboard[^/]*|welcomeDashboard[^/]*|modernSidebarProvider|visualSidebarProvider)/',
      },
    },

    // ── Circular dependency ban ──────────────────────────────────
    // NOTE: Known cycles exist between extension.ts ↔ providers/index.ts
    // via dashboardPanel.ts. These are tolerated as warnings while being refactored.
    // New cycles will fail the gate at error severity.
    {
      name: 'no-circular-known',
      comment:
        'Pre-existing cycles between extension.ts, providers/index.ts, and dashboardPanel.ts. Tolerated as warnings while being refactored.',
      severity: 'warn',
      from: {
        path: '^src/(extension|providers/index|aiPlatform/dashboardPanel|dashboardUpdater)\\.ts$',
      },
      to: {
        circular: true,
      },
    },
    {
      name: 'no-circular',
      comment:
        'Circular dependencies are not allowed in src/. Break the cycle by extracting shared code into src/utils/ or using a bridge/mediator pattern.',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: '^src/(extension|providers/index|aiPlatform/dashboardPanel|dashboardUpdater)\\.ts$',
      },
      to: {
        circular: true,
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
      dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-bundled', 'npm-no-pkg'],
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: './tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+',
      },
    },
  },
};
