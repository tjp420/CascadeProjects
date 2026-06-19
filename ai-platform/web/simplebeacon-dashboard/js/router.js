const ROUTES = ['dashboard', 'audit', 'assessments', 'analyze', 'results', 'remediation', 'security', 'tools', 'platform', 'quality', 'help', 'features', 'trust', 'repository-health', 'settings', 'pricing', 'about', 'signin', 'chatbot', 'upload', 'profile'];

/**
 * P u b l i c  v i e w s.
 */
export const PUBLIC_VIEWS = new Set(['signin', 'pricing', 'about', 'help', 'features', 'settings']);

/**
 * Router.
 */
export class Router {
  constructor(onNavigate) {
    this.onNavigate = onNavigate;
    window.addEventListener('hashchange', () => this.handleHash());
  }

  init() {
    const forced = typeof window !== 'undefined' && window.__SB_INITIAL_ROUTE__;
    if (forced && ROUTES.includes(forced)) {
      delete window.__SB_INITIAL_ROUTE__;
      // In VS Code webviews location.hash may not fire hashchange reliably,
      // so drive the view directly and set the hash only for consistency.
      this.onNavigate(forced, {});
      this.updateNav(forced);
      try { window.location.hash = '#/' + forced; } catch (e) { /* webview may restrict this */ }
      return;
    }
    if (!window.location.hash) {
      window.location.hash = '#/dashboard';
    }
    this.handleHash();
  }

  /** Route for unauthenticated Cloud Teams entry (not the demo). */
  static signInPath() {
    return '#/signin';
  }

  parseHash() {
    const hash = window.location.hash.slice(1) || '/dashboard';
    const [path, query] = hash.split('?');
    const view = path.replace(/^\//, '') || 'dashboard';
    const params = {};
    if (query) {
      query.split('&').forEach((pair) => {
        const [k, v] = pair.split('=');
        params[k] = decodeURIComponent(v || '');
      });
    }
    return { view: ROUTES.includes(view) ? view : 'dashboard', params };
  }

  handleHash() {
    try {
      const { view, params } = this.parseHash();
      this.onNavigate(view, params);
      this.updateNav(view);
    } catch (err) {
      const msg = err?.message || String(err);
      console.error('Router handleHash error:', msg);
    }
  }

  navigate(view, params = {}) {
    const query = Object.entries(params)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    window.location.hash = `#/${view}${query ? `?${query}` : ''}`;
  }

  updateNav(view) {
    document.querySelectorAll('.nav-link[data-view]').forEach((link) => {
      link.classList.toggle('active', link.dataset.view === view);
    });
  }
}
