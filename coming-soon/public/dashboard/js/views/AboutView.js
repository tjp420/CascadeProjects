// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { escapeHtml } from '../utils.js';

// simplebeacon:production-leak-intent: mock-path - Legitimate documentation about mock data detection in About page
const GITHUB_REPO = 'https://github.com/tjp420/simplebeacon';
const MANIFESTO = 'https://github.com/tjp420/simplebeacon/blob/main/docs/ANTI-BLOAT-MANIFESTO.md';

// Transparency note: This dashboard view displays documentation about pattern-matching tools.
const CODE_SAMPLE = `// From credential-pattern-scanner.js — no API calls, no ML
const CREDENTIAL_PATTERNS = [
  { id: 'aws-access-key', regex: /\\bAKIA[0-9A-Z]{16}\\b/g, severity: 'high' },
  { id: 'openai-key', regex: /\\bsk-[A-Za-z0-9]{20,}\\b/g, severity: 'high' },
  { id: 'jwt-token', regex: /\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b/g, severity: 'high' }
];

/**
 * Scan text content.
 * @param {string} fileName
 * @param {any} content
 * @returns {any}
 */
function scanTextContent(fileName, content) {
  const findings = [];
  for (const pattern of CREDENTIAL_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      if (isAllowlisted(match, content, fileName)) continue;
      findings.push({ pattern: pattern.id, severity: pattern.severity });
    }
  }
  return findings;
}`;

/**
 * About view.
 */
export class AboutView {
  constructor(app) {
    this.app = app;
  }

  mount(container) {
// TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
    container.innerHTML = `
      <div class="analyze-hero">
        <h1 class="page-title">About</h1>
        <p class="text-muted analyze-hero-sub">Free · local · zero runtime dependencies</p>
      </div>
      <section class="about-hero card mb-6" id="install">
        <p class="about-kicker">Stop AI-generated fake data from slipping into production</p>
        <p class="page-subtitle" style="margin:0;">
          A solo-engineered CLI that pattern-matches credentials, fiction KPIs, and mock paths before merge.
          No account. No cloud upload by default.
        </p>
        <div class="about-install-block">
          <code>npx simplebeacon init</code>
          <code>npx simplebeacon scan --gate</code>
        </div>
        <div class="about-hero-actions">
          <a class="btn btn-primary" href="${GITHUB_REPO}" target="_blank" rel="noopener noreferrer">View source on GitHub</a>
          <a class="btn btn-secondary" href="${MANIFESTO}" target="_blank" rel="noopener noreferrer">Read the manifesto</a>
          <button type="button" class="btn btn-ghost" id="about-open-dashboard">Open dashboard (optional)</button>
        </div>
      </section>

      <section class="about-section card mb-6">
        <h2>Who I am</h2>
        <p>
          I'm a solo engineer who got tired of bloated AI security platforms that charge thousands of dollars
          for what is often plain pattern matching on outbound traffic or repo files.
        </p>
        <p>
          I built Simplebeacon as a pure Node.js engine because I couldn't find a tool that runs locally,
          ships with <strong>zero runtime npm dependencies</strong>, doesn't send your code to someone else's cloud by default,
          and actually catches the AI-generated placeholders that keep slipping through code review.
        </p>
      </section>

      <section class="about-section card mb-6">
        <h2>What this tool does well</h2>
        <ul class="about-list">
          <li><strong>Blocks API keys and credentials</strong> before they land in git</li>
          <li><strong>Catches AI-generated fake metrics</strong> (e.g. <code>completion_rate: 98.5</code>) that Copilot and Cursor love to invent</li>
          <li><strong>Detects mock data paths</strong> referenced from production code (<code>status-sample.json</code>, <code>data/mock/...</code>) <!-- simplebeacon:production-leak-intent - legitimate example in documentation --></li>
          <li><strong>Runs in CI</strong> via GitHub Actions — copy the workflow from the repo examples</li>
          <li><strong>Costs $0</strong> for the community CLI and stays on your machine unless you opt into upload</li>
        </ul>
        <p class="text-muted about-bench">
          Measured on this repo: ~0.02&nbsp;ms per credential scan pass on a typical file;
          full <code>ai-platform</code> gate scan ~4&nbsp;s. Cloud guardrails often add 100–500&nbsp;ms+ per API round trip before vendor processing.
        </p>
      </section>

      <section class="about-section card mb-6 about-honest">
        <h2>What Simplebeacon is bad at</h2>
        <p>I want to be direct about limits:</p>
        <ul class="about-list">
          <li><strong>No semantic understanding</strong> — deterministic regex and path rules, not an LLM reading your intent</li>
          <li><strong>No enterprise DLP</strong> — if you need deep semantic posture analysis, buy a platform built for that</li>
          <li><strong>No magic false-positive elimination</strong> — strict defaults; you tune allowlists in <code>.simplebeacon/config.json</code></li>
          <li><strong>No required SaaS</strong> — this is a command-line utility you run yourself; the hosted dashboard here is optional</li>
        </ul>
        <p class="text-muted">If you need those things, they exist elsewhere. They're often expensive and slower — but they exist.</p>
      </section>

      <section class="about-section card mb-6" id="how-it-works">
        <h2>How it works</h2>
        <p class="text-muted mb-4">No OpenAI calls. No cloud processing. No ML models in the community tier. <strong>Disconnect your network cable and it still runs.</strong></p>
        <p class="text-muted mb-4" style="font-size:var(--font-size-sm)">All scanning happens locally in a single Node.js process. Your source files, credentials, and scan reports never leave your machine. Use <code>--offline</code> to skip even optional npm registry lookups.</p>
        <pre class="about-code"><code>${escapeHtml(CODE_SAMPLE)}</code></pre>
        <p class="text-muted" style="font-size:var(--font-size-sm)">
          Plus fiction KPI rules, production-leak detection, and path-safety checks that block config traversal.
          See <code>packages/simplebeacon-cli/src/rules/</code> in the repo.
        </p>
      </section>

      <section class="about-section card mb-6">
        <h2>Why I built this</h2>
        <p>
          Every week someone ships AI-generated placeholder data to production because review missed it.
          The usual choices are an enterprise platform with a five-figure setup fee, or nothing at all.
        </p>
        <p>
          Simplebeacon is the middle option: a fast, free, local gate that catches obvious failures before they become incidents.
        </p>
      </section>

      <section class="about-section card mb-6">
        <h2>The code</h2>
        <p>Everything is MIT-licensed. Audit every line yourself:</p>
        <p><a href="${GITHUB_REPO}" target="_blank" rel="noopener noreferrer">${escapeHtml(GITHUB_REPO)}</a></p>
        <p class="text-muted">Found a bug or want a new pattern? Open a PR — I review contributions regularly.</p>
      </section>
    `;

    this._aboutClickHandler = () => this.app.navigate('dashboard');
    container.querySelector('#about-open-dashboard')?.addEventListener('click', this._aboutClickHandler);
  }

  destroy() {
    const el = document.getElementById('about-open-dashboard');
    if (el && this._aboutClickHandler) {
      el.removeEventListener('click', this._aboutClickHandler);
    }
  }
}
