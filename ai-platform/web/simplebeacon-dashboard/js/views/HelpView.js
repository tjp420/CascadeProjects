import { escapeHtml, formatNumber, formatPercent } from '../utils.js';
import { FEATURE_CATALOG } from '../services/platformService.js';
import {
  getScanFileMetrics,
  resolveDisplayScore,
  resolveJestTestsLabel,
  resolvePageSpecsLabel,
  formatScanScopeSummary,
  formatScanInventoryNote
} from '../services/analyzeService.js';

const DASHBOARD_PAGES = [
  {
    route: 'dashboard',
    icon: '📊',
    title: 'Dashboard',
    description: 'Last scan status, scan summary, metric chips, and issue categories. Rescan from here or open Analyze for deeper runs.'
  },
  {
    route: 'analyze',
    icon: '📂',
    title: 'Analyze',
    description: 'Complete, Simplebeacon, mock data, consolidation, roadmap, or auto mode. Drop JSON reports or enter a server-readable path.'
  },
  {
    route: 'assessments',
    icon: '📑',
    title: 'Assessment Portal',
    description: 'Client-facing M&A / diligence flow — clone a repo or scan a local path (signed-in), deliver assessment JSON.'
  },
  {
    route: 'audit',
    icon: '🛡️',
    title: 'Compliance Audit',
    description: 'All auditing layers in one view — credentials, fiction KPIs, schema, production leaks, roadmap, Jest baseline, npm audit.'
  },
  {
    route: 'results',
    icon: '📋',
    title: 'Results',
    description: 'Filter issues by severity and category. Empty state with gate PASS means a clean scan on configured paths — not a broken page.'
  },
  {
    route: 'platform',
    icon: '📈',
    title: 'Platform',
    description: 'Engineering baseline — mock file counts, Jest health, schema pass rate, and comparative metrics from live scan + baseline.'
  },
  {
    route: 'quality',
    icon: '🛡️',
    title: 'Quality & Security',
    description: 'Live npm audit (dependency count + vulnerabilities), security checklist, and coverage posture.'
  },
  {
    route: 'settings',
    icon: '⚙️',
    title: 'Settings',
    description: 'Scan paths, gate severities, rule toggles, and optional AI provider keys (OpenAI, Anthropic, Ollama) for Analyze summaries.'
  },
  {
    route: 'about',
    icon: '📖',
    title: 'About the project',
    description: 'Radical honesty — what Simplebeacon does well, what it is bad at, install commands, and links to source.'
  },
  {
    route: 'pricing',
    icon: '⚡',
    title: 'Install',
    description: 'Community CLI ($0) — npx commands, GitHub Action, documentation links. No enterprise checkout on this page.'
  }
];

const STATIC_FAQ = [
  {
    question: 'Why does the dashboard show 42 mock/sample files but 40k+ repo files?',
    answer: 'Simplebeacon gate scans configured scanPaths (web/data, data/mock, etc.) — typically ~42 mock/sample JSON files. The repo inventory is an explorer-style index of the whole project root for context; it is not a full-fiction scan of every file.'
  },
  {
    question: 'What is the difference between quality score and consistency score?',
    answer: 'Quality score is a capped mock-scan heuristic (often 99%). Consistency score reflects fiction/KPI drift checks on page samples — use consistency and schema compliance on Dashboard and Compliance Audit for pass/fail truth.'
  },
  {
    question: 'Why does Results show 0 issues when I expected findings?',
    answer: 'A PASS gate with zero issues on configured paths is correct for ai-platform. Simplebeacon uses pattern matching on mock/sample paths and production directories — not semantic review of the entire monorepo.'
  },
  {
    question: 'How do I run the v1-internal dashboard locally?',
    answer: 'Community CLI: npm install simplebeacon or /community. Cloud Teams requires Stripe subscription. Operators: npm run dashboard:v1-internal (port 54355).'
  }
];

function renderLiveScanStrip(report, baseline, dashboardHome) {
  if (!report) {
    return `
      <div class="card mb-6" style="padding: var(--space-4);">
        <p class="text-muted" style="margin: 0;">No scan report loaded yet. Run a scan from Dashboard or Analyze to see live metrics here.</p>
      </div>
    `;
  }

  const metrics = getScanFileMetrics(report);
  const inventoryNote = formatScanInventoryNote(report);
  const gateLabel = report.gate?.pass ? 'PASS' : 'FAIL';
  const jestLabel = resolveJestTestsLabel(baseline, dashboardHome) ?? '—';
  const pageSpecs = resolvePageSpecsLabel(report, baseline) ?? '—';

  return `
    <div class="card mb-6" style="padding: var(--space-4);">
      <p class="text-muted mb-2" style="margin-top: 0; font-size: var(--font-size-xs);">Live scan snapshot</p>
      <div class="metrics-row mb-2">
        <div class="metric-chip gate-badge ${report.gate?.pass ? 'pass' : 'warn'}">${gateLabel}</div>
        <div class="metric-chip"><strong>${formatPercent(resolveDisplayScore(report))}</strong> consistency</div>
        <div class="metric-chip"><strong>${formatNumber(metrics.mockSampleFiles ?? report.totalFiles)}</strong> mock/sample</div>
        ${metrics.repositoryFiles != null ? `<div class="metric-chip"><strong>${formatNumber(metrics.repositoryFiles)}</strong> repo files</div>` : ''}
        <div class="metric-chip"><strong>${formatNumber(metrics.ruleScopedFilesAnalyzed ?? metrics.credentialScanned)}</strong> gate rules checked</div>
        <div class="metric-chip"><strong>${pageSpecs}</strong> page specs</div>
        <div class="metric-chip"><strong>${jestLabel}</strong> Jest</div>
      </div>
      <p class="text-muted" style="margin: 0; font-size: var(--font-size-sm);">${escapeHtml(formatScanScopeSummary(report))}${inventoryNote ? ` · ${escapeHtml(inventoryNote)}` : ''}</p>
    </div>
  `;
}

export class HelpView {
  constructor(app) {
    this.app = app;
  }

  render() {
    const help = this.app.state.help || {};
    const overview = help.overview || {};
    const quickLinks = help.quickLinks || [];
    const faq = [...STATIC_FAQ, ...(help.faq || help.faqItems || [])];
    const report = this.app.state.report;
    const baseline = this.app.state.baseline;
    const dashboardHome = this.app.state.dashboardHome;

    const el = document.createElement('div');
    el.className = 'fade-in';
    el.innerHTML = `
      <h1 class="page-title">Help & Docs</h1>
      <p class="text-muted mb-6">${escapeHtml(help.title || 'Simplebeacon dashboard — scan modes, metrics, and troubleshooting')}</p>

      ${renderLiveScanStrip(report, baseline, dashboardHome)}

      <div class="section-block">
        <div class="section-heading"><h2>How it works (simple)</h2></div>
        <div class="card">
          <p style="margin-bottom: var(--space-3);">
            Simplebeacon is an <strong>automated security checkpoint for code</strong> — like airport security for your repository.
          </p>
          <ol style="margin: 0; padding-left: 1.25rem; line-height: 1.7; font-size: var(--font-size-sm);">
            <li><strong>Developer writes code</strong> — passenger arrives at the airport</li>
            <li><strong>Simplebeacon scans</strong> — security scans bags (git commit, push, CI, or manual Run Scan)</li>
            <li><strong>Finds problems</strong> — passwords, API keys, fake KPIs, mock paths in production code</li>
            <li><strong>Blocks bad code</strong> — high-severity findings stop the gate (won't merge or deploy)</li>
            <li><strong>Shows what's wrong</strong> — Dashboard, Results, Compliance Audit, PR comments</li>
            <li><strong>Developer fixes</strong> — remove prohibited items, re-scan until clean</li>
            <li><strong>Code passes</strong> — gate green, dashboard updates</li>
            <li><strong>Enterprise path</strong> — Assessment Portal for client deliverables; human triage sells the audit</li>
            <li><strong>Ships to production</strong> — deploy workflow + live monitoring</li>
          </ol>
          <p class="text-muted mt-4" style="font-size: var(--font-size-sm); margin-bottom: 0;">
            The guard never sleeps: pre-commit hooks, CI on every PR, optional production collector, and this SPA dashboard for overall security health.
          </p>
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading"><h2>Understanding scan numbers</h2></div>
        <div class="card">
          <table class="results-table">
            <thead><tr><th>Metric</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><strong>mock/sample</strong></td><td>Files in configured <code>scanPaths</code> (e.g. <code>web/data/*-sample.json</code>) — the gate target (~42 on ai-platform).</td></tr>
              <tr><td><strong>rule-scoped</strong></td><td>Files read by credential + production-leak rules (often ~117) — broader than mock paths alone.</td></tr>
              <tr><td><strong>page specs</strong></td><td>Page-sample JSON validated against Jest specs (e.g. 42/42) — includes aliased roadmap samples outside <code>scanPaths</code>.</td></tr>
              <tr><td><strong>repo files</strong></td><td>Explorer-style inventory of project root (~42k on ai-platform) — context only, not a full-fiction scan.</td></tr>
              <tr><td><strong>consistency</strong></td><td>Fiction/KPI drift score on samples — prefer this over capped quality score for pass/fail.</td></tr>
              <tr><td><strong>gate PASS + 0 issues</strong></td><td>Expected for a clean repo on current config — not a broken scan.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid-3 mb-6">
        <div class="card insight-stat">
          <div class="insight-stat-value">${overview.totalDocs ?? DASHBOARD_PAGES.length}</div>
          <div class="insight-stat-label">Dashboard pages</div>
        </div>
        <div class="card insight-stat">
          <div class="insight-stat-value">${overview.totalTutorials ?? '5'}</div>
          <div class="insight-stat-label">Workflows</div>
        </div>
        <div class="card insight-stat">
          <div class="insight-stat-value">${faq.length}</div>
          <div class="insight-stat-label">FAQ items</div>
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading"><h2>Dashboard pages</h2></div>
        <div class="tool-grid">
          ${DASHBOARD_PAGES.map((page) => `
            <button type="button" class="tool-card help-page-card" data-route="${page.route}">
              <div class="tool-card-header"><span>${page.icon}</span></div>
              <h3>${escapeHtml(page.title)}</h3>
              <p>${escapeHtml(page.description)}</p>
              <div class="tool-card-meta">Open →</div>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading"><h2>Quick Links</h2></div>
        <div class="tool-grid">
          ${quickLinks.map((link, _index) => `
            <div class="tool-card">
              <div class="tool-card-header"><span>${link.icon || '📄'}</span></div>
              <h3>${escapeHtml(link.title)}</h3>
              <p>${escapeHtml(link.description)}</p>
              <div class="tool-card-meta">${escapeHtml(link.category || '')}</div>
            </div>
          `).join('') || '<p class="text-muted">No quick links loaded.</p>'}
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading"><h2>FAQ</h2></div>
        <div class="faq-list">
          ${faq.slice(0, 12).map((item) => `
            <details class="faq-item card">
              <summary>${escapeHtml(item.question || item.title)}</summary>
              <p>${escapeHtml(item.answer || item.description || '')}</p>
            </details>
          `).join('')}
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading"><h2>Scan modes (Analyze)</h2></div>
        <div class="card mb-4">
          <h3 style="font-size: var(--font-size-base); margin-bottom: var(--space-2);">Complete</h3>
          <p class="text-muted" style="font-size: var(--font-size-sm); margin-bottom: var(--space-3);">
            Gate + consolidation + fiction digest + roadmap in one run. Optional AI narrative after deterministic steps when a provider is selected.
          </p>
          <h3 style="font-size: var(--font-size-base); margin-bottom: var(--space-2);">Simplebeacon</h3>
          <p class="text-muted" style="font-size: var(--font-size-sm); margin-bottom: var(--space-3);">
            Uses <code>.simplebeacon/config.json</code> scan paths, all rules, and gate policy. Primary mode for CI and day-to-day checks.
          </p>
          <h3 style="font-size: var(--font-size-base); margin-bottom: var(--space-2);">Mock data</h3>
          <p class="text-muted" style="font-size: var(--font-size-sm); margin-bottom: var(--space-3);">
            Fiction/KPI digest scoped to sample paths when you enter the platform root. Same path scope as the gate — not a whole-monorepo fiction walk unless you pass a subdirectory.
          </p>
          <h3 style="font-size: var(--font-size-base); margin-bottom: var(--space-2);">Roadmap</h3>
          <p class="text-muted" style="font-size: var(--font-size-sm); margin-bottom: var(--space-3);">
            Filesystem sprint scan for planning. Exports belong in <code>reports/</code>, not <code>web/data/</code>.
          </p>
          <h3 style="font-size: var(--font-size-base); margin-bottom: var(--space-2);">Consolidation</h3>
          <p class="text-muted" style="font-size: var(--font-size-sm); margin-bottom: var(--space-3);">
            Duplicate JSON groups and similar schemas in sample paths. Pick one canonical file per group, then re-run Simplebeacon scan.
          </p>
          <h3 style="font-size: var(--font-size-base); margin-bottom: var(--space-2);">Auto</h3>
          <p class="text-muted" style="font-size: var(--font-size-sm);">
            Picks Simplebeacon when the path looks like ai-platform / mock data; otherwise roadmap.
          </p>
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading"><h2>CLI & server commands</h2></div>
        <div class="card">
          <pre class="audit-log"># Simplebeacon CLI (npm: simplebeacon@1.0.0)
npm install -D simplebeacon
npx simplebeacon init
npx simplebeacon scan --gate --path .
npx simplebeacon hook install

# Monorepo dev (this repo)
npm run simplebeacon:report
npm run trust:refresh

# Local dashboard (v1-internal, port 54355)
npm run dashboard:v1-internal

# Tests
npm test
npm test -- --testPathPattern=page-samples</pre>
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading">
          <h2>All features</h2>
          <button type="button" class="btn btn-ghost btn-sm" id="help-open-features">Browse catalog →</button>
        </div>
        <p class="text-muted">See every in-app destination on the All Features page — no duplicate legacy HTML routes.</p>
      </div>
    `;

    el.querySelectorAll('[data-route]').forEach((btn) => {
      btn.addEventListener('click', () => this.app.navigate(btn.dataset.route));
    });
    el.querySelector('#help-open-features')?.addEventListener('click', () => {
      this.app.navigate('features');
    });

    return el;
  }

  mount(container) {
    container.innerHTML = '';
    container.appendChild(this.render());
  }
}

/** Feature catalog — all navigation stays in the Simplebeacon SPA */
export class FeaturesView {
  constructor(app) {
    this.app = app;
    this.filter = '';
  }

  getAllItems() {
    return FEATURE_CATALOG.flatMap((group) =>
      group.items.map((item) => ({ ...item, group: group.group }))
    );
  }

  getFilteredCatalog() {
    const q = this.filter.trim().toLowerCase();
    if (!q) return FEATURE_CATALOG;

    return FEATURE_CATALOG.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${item.label} ${item.description} ${item.route} ${item.analyzeMode || ''} ${group.group}`
          .toLowerCase()
          .includes(q)
      )
    })).filter((group) => group.items.length > 0);
  }

  render() {
    const el = document.createElement('div');
    el.className = 'fade-in';
    const allItems = this.getAllItems();
    const catalog = this.getFilteredCatalog();
    const analyzeModes = allItems.filter((i) => i.analyzeMode).length;
    const routes = new Set(allItems.map((i) => i.route)).size;

    el.innerHTML = `
      <h1 class="page-title">All Features</h1>
      <p class="text-muted mb-4">
        ${allItems.length} destinations across ${FEATURE_CATALOG.length} groups —
        ${routes} SPA routes, ${analyzeModes} Analyze modes. No duplicate legacy HTML pages.
      </p>

      <div class="grid-3 mb-6">
        <div class="card insight-stat">
          <div class="insight-stat-value">${allItems.length}</div>
          <div class="insight-stat-label">Feature cards</div>
        </div>
        <div class="card insight-stat">
          <div class="insight-stat-value">${routes}</div>
          <div class="insight-stat-label">Routes</div>
        </div>
        <div class="card insight-stat">
          <div class="insight-stat-value">${analyzeModes}</div>
          <div class="insight-stat-label">Analyze modes</div>
        </div>
      </div>

      <label class="input-group mb-6" style="display:block;max-width:28rem">
        <span class="input-label">Filter features</span>
        <input type="search" class="input" id="features-filter" placeholder="Search by name, route, or description…" value="${escapeHtml(this.filter)}">
      </label>

      <div id="features-catalog">
        ${catalog.length
    ? catalog.map((group) => `
            <div class="section-block" data-feature-group>
              <div class="section-heading">
                <h2>${escapeHtml(group.group)}</h2>
                <span class="text-muted" style="font-size:var(--font-size-sm)">${group.items.length} item${group.items.length === 1 ? '' : 's'}</span>
              </div>
              <div class="feature-grid">
                ${group.items.map((item) => this.renderFeatureCard(item)).join('')}
              </div>
            </div>
          `).join('')
    : `<div class="empty-state card"><p>No features match “${escapeHtml(this.filter)}”.</p></div>`}
      </div>
    `;

    el.querySelector('#features-filter')?.addEventListener('input', (e) => {
      this.filter = e.target.value;
      const container = el.parentElement;
      if (container) this.mount(container);
      container?.querySelector('#features-filter')?.focus();
      const input = container?.querySelector('#features-filter');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });

    el.querySelectorAll('[data-route]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const route = btn.dataset.route;
        const mode = btn.dataset.analyzeMode;
        if (mode) {
          this.app.views.analyze.analysisType = mode;
          this.app.navigate('analyze', { mode });
          return;
        }
        this.app.navigate(route);
      });
    });

    return el;
  }

  renderFeatureCard(item) {
    const badge = item.analyzeMode
      ? `<span class="feature-badge mode">Analyze · ${escapeHtml(item.analyzeMode)}</span>`
      : `<span class="feature-badge inapp">Open</span>`;

    if (item.external) {
      return `
        <a href="${escapeHtml(item.external)}" class="legacy-link card feature-card-inapp feature-card-external" target="_blank" rel="noopener">
          <span class="legacy-link-icon">${item.icon}</span>
          <span class="feature-card-body">
            <span class="legacy-link-label">${escapeHtml(item.label)}</span>
            ${item.description ? `<span class="feature-card-desc">${escapeHtml(item.description)}</span>` : ''}
          </span>
          <span class="feature-badge classic">Open ↗</span>
        </a>
      `;
    }

    return `
      <button type="button" class="legacy-link card feature-card-inapp" data-route="${item.route}" ${item.analyzeMode ? `data-analyze-mode="${item.analyzeMode}"` : ''}>
        <span class="legacy-link-icon">${item.icon}</span>
        <span class="feature-card-body">
          <span class="legacy-link-label">${escapeHtml(item.label)}</span>
          ${item.description ? `<span class="feature-card-desc">${escapeHtml(item.description)}</span>` : ''}
        </span>
        ${badge}
      </button>
    `;
  }

  mount(container) {
    container.innerHTML = '';
    container.appendChild(this.render());
  }
}

// Backward compat alias
export const LegacyHubView = FeaturesView;

