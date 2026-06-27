const ROUTES = ['dashboard', 'audit', 'assessments', 'analyze', 'results', 'remediation', 'security', 'tools', 'platform', 'quality', 'help', 'features', 'trust', 'repository-health', 'settings', 'pricing', 'about', 'signin', 'chatbot', 'upload', 'eu-ai-act', 'profile'];

/**
 * P u b l i c  v i e w s.
 */
export const PUBLIC_VIEWS = new Set(['signin', 'pricing', 'about', 'help', 'features', 'settings']);
const DASHBOARD_BASE = '/dashboard';

/**
 * Router.
 */
export class Router {
  constructor(onNavigate) {
    this.onNavigate = onNavigate;
    window.addEventListener('popstate', () => this.handlePath());
    window.addEventListener('hashchange', () => this.handleHash());
  }

  init() {
    const forced = typeof window !== 'undefined' && window.__SB_INITIAL_ROUTE__;
    if (forced && ROUTES.includes(forced)) {
      delete window.__SB_INITIAL_ROUTE__;
      this.onNavigate(forced, {});
      this.updateNav(forced);
      this.pushPath(forced);
      return;
    }
    // Convert any legacy hash route to a path-based URL on first load
    if (window.location.hash && window.location.hash.startsWith('#/')) {
      this.handleHash();
      return;
    }
    this.handlePath();
  }

  /** Route for unauthenticated Cloud Teams entry (not the demo). */
  static signInPath() {
    return '/dashboard/signin';
  }

  getDashboardBase() {
    if (window.location.pathname.startsWith('/dashboard')) { return '/dashboard'; }
    return '';
  }
  parsePath() {
    const pathname = window.location.pathname || DASHBOARD_BASE;
    const base = this.getDashboardBase();
    let relative = pathname;
    if (base && relative.startsWith(base + '/')) {
      relative = relative.slice(base.length + 1);
    } else if (relative === base) {
      relative = '';
    }
    const segments = relative.split('/').filter(Boolean);
    const view = segments[0] || 'dashboard';
    const params = {};
    const search = window.location.search;
    if (search && search.startsWith('?')) {
      const searchParams = new URLSearchParams(search);
      searchParams.forEach((v, k) => { params[k] = v; });
    }
    return { view: ROUTES.includes(view) ? view : 'dashboard', params };
  }

  handlePath() {
    try {
      const { view, params } = this.parsePath();
      this.onNavigate(view, params);
      this.updateNav(view);
    } catch (err) {
      const msg = err?.message || String(err);
      console.error('Router handlePath error:', msg);
    }
  }

  parseHash() {
    const hash = window.location.hash.slice(1) || '/dashboard';
    const [path, query] = hash.split('?');
    const view = path.replace(/^\//, '') || 'dashboard';
    const params = {};
    if (query) {
      const searchParams = new URLSearchParams('?' + query);
      searchParams.forEach((v, k) => { params[k] = v; });
    }
    return { view: ROUTES.includes(view) ? view : 'dashboard', params };
  }

  handleHash() {
    try {
      const { view, params } = this.parseHash();
      this.onNavigate(view, params);
      this.updateNav(view);
      this.pushPath(view, params);
    } catch (err) {
      const msg = err?.message || String(err);
      console.error('Router handleHash error:', msg);
    }
  }

  pushPath(view, params = {}) {
    try {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') searchParams.set(k, v); });
      const search = searchParams.toString();
      const base = this.getDashboardBase();
      const newUrl = `${base}/${view}${search ? '?' + search : ''}`;
      if (window.location.pathname + window.location.search !== newUrl) {
        window.history.pushState({}, '', newUrl);
      }
    } catch (e) { /* webview may restrict this */ }
  }

  navigate(view, params = {}) {
    this.pushPath(view, params);
    this.onNavigate(view, params);
    this.updateNav(view);
  }

  updateNav(view) {
    document.querySelectorAll('.nav-link[data-view]').forEach((link) => {
      link.classList.toggle('active', link.dataset.view === view);
    });
  }
}
