const GITHUB_REPO = 'https://github.com/tjp420/simplebeacon';
const CLI_DOCS = 'https://github.com/tjp420/simplebeacon/blob/main/README.md';
/** Community-first install page — no enterprise tiers or Stripe checkout. */
export class PricingView {
    constructor(app) {
        this.app = app;
    }
    mount(container) {
        var _a;
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
          <h2>Solo</h2>
          <p class="pricing-tier-label">Free forever</p>
          <p class="pricing-price">$0</p>
          <ul class="pricing-features">
            <li>24 real-time IDE rules</li>
            <li>Unlimited local scans</li>
            <li>JSON + text reports</li>
            <li><code>--gate</code> for CI</li>
            <li>GitHub Action + pre-commit hooks</li>
          </ul>
          <a class="btn btn-primary" href="https://marketplace.visualstudio.com/items?itemName=simplebeacon.ai-slop-cop" target="_blank" rel="noopener noreferrer">Install Free</a>
        </div>
        <div class="pricing-card card" style="border-color:var(--success);box-shadow:0 0 20px rgba(5,150,105,0.08);">
          <h2>Pro</h2>
          <p class="pricing-tier-label">Most Popular</p>
          <p class="pricing-price">$9<span class="pricing-unit">/mo</span></p>
          <ul class="pricing-features">
            <li>All 63 analyzer engines</li>
            <li>2,500 scans/mo</li>
            <li>PDF reports</li>
            <li>Remote repo scans</li>
            <li>Exportable compliance certificates</li>
          </ul>
          <a class="btn btn-primary" href="/pricing.html" target="_blank" rel="noopener noreferrer">Subscribe</a>
        </div>
        <div class="pricing-card card" style="border-color:var(--primary);box-shadow:0 0 20px rgba(99,102,241,0.08);">
          <h2>Compliance Suite</h2>
          <p class="pricing-tier-label">Enterprise</p>
          <p class="pricing-price">Custom</p>
          <ul class="pricing-features">
            <li>Everything in Pro</li>
            <li>Unlimited scans</li>
            <li>Shared dashboards</li>
            <li>Dedicated support</li>
            <li>EU AI Act board-ready reports</li>
          </ul>
          <a class="btn btn-secondary" href="/pricing.html" target="_blank" rel="noopener noreferrer">Contact Sales</a>
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
        (_a = container.querySelector('#goto-about')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            this.app.navigate('about');
        });
    }
    destroy() { }
}
