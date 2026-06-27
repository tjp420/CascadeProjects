const GITHUB_REPO = 'https://github.com/tjp420/simplebeacon';
const CLI_DOCS = 'https://github.com/tjp420/simplebeacon/blob/main/README.md';

/** Community-first install page — no enterprise tiers or Stripe checkout. */
export class PricingView {
  constructor(app) {
    this.app = app;
  }

  mount(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Install</h1>
        <p class="page-subtitle">
          Free CLI · local scans · GitHub Action · zero runtime dependencies. No credit card, no account required.
        </p>
      </div>

      <div class="card about-hero mb-6">
        <div class="about-install-block">
          <code>npx simplebeacon init</code>
          <code>npx simplebeacon scan --gate</code>
        </div>
        <p class="text-muted" style="margin:var(--space-4) 0 0">
          Add <code>examples/github-action/simplebeacon.yml</code> from the repo to fail CI on high-severity findings.
        </p>
      </div>

      <div class="pricing-grid pricing-grid-compact mb-6">
        <div class="pricing-card card">
          <h2>Community CLI</h2>
          <p class="pricing-tier-label">Self-hosted utility</p>
          <p class="pricing-price">$0</p>
          <ul class="pricing-features">
            <li>Unlimited local scans</li>
            <li>JSON + text reports</li>
            <li><code>--gate</code> for CI fail on high severity</li>
            <li>GitHub Action + pre-commit hooks</li>
            <li>Offline mode (<code>--offline</code>)</li>
          </ul>
          <a class="btn btn-primary" href="${GITHUB_REPO}" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
        <div class="pricing-card card">
          <h2>Documentation</h2>
          <p class="pricing-tier-label">Technical docs</p>
          <ul class="pricing-features">
            <li>Anti-bloat manifesto + benchmarks</li>
            <li>GitHub Action quickstart</li>
            <li>Trust & privacy guarantees</li>
            <li>Launch templates for Show HN</li>
          </ul>
          <a class="btn btn-secondary" href="${CLI_DOCS}" target="_blank" rel="noopener noreferrer">Read docs</a>
          <button type="button" class="btn btn-ghost btn-sm mt-2" id="goto-about">About the project</button>
        </div>
      </div>

      <div class="card notice-card">
        <p style="margin:0">
          <strong>Radical honesty:</strong> this dashboard is optional tooling around the same scan engine.
          I am not selling you a required SaaS subscription to use the CLI.
          For the full story — including what Simplebeacon is <em>bad</em> at — see
          <a href="/dashboard/about">About the project</a>.
        </p>
      </div>
    `;

    container.querySelector('#goto-about')?.addEventListener('click', () => {
      this.app.navigate('about');
    });
  }

  destroy() {}
}

