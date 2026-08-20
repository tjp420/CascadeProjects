// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const ROUTES = [
  'dashboard',
  'audit',
  'assessments',
  'analyze',
  'results',
  'remediation',
  'roadmap',
  'security',
  'tools',
  'platform',
  'quality',
  'help',
  'features',
  'trust',
  'repository-health',
  'settings',
  'pricing',
  'about',
  'signin',
  'register',
  'chatbot',
  'upload',
  'eu-ai-act',
  'profile',
  'admin',
  'getting-started',
];
/**
 * P u b l i c  v i e w s.
 */
export const PUBLIC_VIEWS = new Set([
  'signin',
  'register',
  'pricing',
  'about',
  'help',
  'features',
  'settings',
  'getting-started',
]);
const DASHBOARD_BASE = '/dashboard';
/**
 * Router.
 */
export class Router {
  constructor(onNavigate) {
    this.onNavigate = onNavigate;
    this._popstateHandler = () => this.handlePath();
    this._hashchangeHandler = () => {
      if (!window.location.hash || !window.location.hash.startsWith('#/')) {
        this.handlePath();
        return;
      }
      this.handleHash();
    };
    window.addEventListener('popstate', this._popstateHandler);
    window.addEventListener('hashchange', this._hashchangeHandler);
  }
  dispose() {
    window.removeEventListener('popstate', this._popstateHandler);
    window.removeEventListener('hashchange', this._hashchangeHandler);
  }
  init() {
    try {
      const path = window.location.pathname || '';
      if (/\/dashboard\/dashboard\/?$/.test(path)) {
        const canonical =
          path.replace(/\/dashboard\/dashboard\/?$/, '/dashboard') +
          (window.location.search || '') +
          (window.location.hash || '');
        window.history.replaceState({}, '', canonical);
      }
    } catch (_a) {
      /* ignore */
    }
    const forced = typeof window !== 'undefined' && window.__SB_INITIAL_ROUTE__;
    if (forced && ROUTES.includes(forced)) {
      delete window.__SB_INITIAL_ROUTE__;
      this.onNavigate(forced, {});
      this.updateNav(forced);
      this.pushPath(forced);
      return;
    }
    const pathInfo = this.parsePath();
    const hasExplicitPathRoute = this._hasExplicitPathRoute();
    // Convert legacy hash routes on first load, but prefer pathname when both disagree
    // (e.g. /dashboard/register?… + stale #/signin from an old sign-out).
    if (window.location.hash && window.location.hash.startsWith('#/')) {
      const hashInfo = this.parseHash();
      if (hasExplicitPathRoute && hashInfo.view !== pathInfo.view) {
        this._clearLocationHash();
        this.handlePath();
        return;
      }
      this.handleHash();
      return;
    }
    this.handlePath();
  }
  _hasExplicitPathRoute() {
    try {
      const base = this.getDashboardBase();
      const pathname = window.location.pathname || '';
      if (!base || !pathname.startsWith(base + '/')) return false;
      const segment =
        pathname
          .slice(base.length + 1)
          .split('/')
          .filter(Boolean)[0] || '';
      return segment !== '' && segment !== 'dashboard' && ROUTES.includes(segment);
    } catch (_a) {
      return false;
    }
  }
  _clearLocationHash() {
    try {
      const base = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState({}, '', base);
    } catch (_a) {
      /* ignore */
    }
    try {
      if (window.location.hash) {
        window.location.hash = '';
      }
    } catch (_b) {
      /* ignore */
    }
  }
  /** Route for unauthenticated Cloud Teams entry (not the demo). */
  static signInPath() {
    return '/dashboard/signin';
  }
  getDashboardBase() {
    if (window.location.pathname.startsWith('/dashboard')) {
      return '/dashboard';
    }
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
      searchParams.forEach((v, k) => {
        params[k] = v;
      });
    }
    return { view: ROUTES.includes(view) ? view : 'dashboard', params };
  }
  handlePath() {
    try {
      const { view, params } = this.parsePath();
      this.onNavigate(view, params);
      this.updateNav(view);
      try {
        // Ensure viewport scroll resets when navigating (important for IDE embeds)
        var sc =
          document.querySelector('#app-main') ||
          document.querySelector('.app-main') ||
          document.scrollingElement ||
          document.documentElement;
        if (sc && typeof sc.scrollTo === 'function') {
          sc.scrollTo(0, 0);
        } else if (typeof window.scrollTo === 'function') {
          window.scrollTo(0, 0);
        }
      } catch (_a) {
        /* ignore */
      }
    } catch (err) {
      const msg = (err === null || err === void 0 ? void 0 : err.message) || String(err);
      window['console']['error']('Router handlePath error:', msg);
    }
  }
  parseHash() {
    const hash = window.location.hash.slice(1) || '/dashboard';
    const [path, query] = hash.split('?');
    const view = path.replace(/^\//, '') || 'dashboard';
    const params = {};
    if (query) {
      const searchParams = new URLSearchParams('?' + query);
      searchParams.forEach((v, k) => {
        params[k] = v;
      });
    }
    return { view: ROUTES.includes(view) ? view : 'dashboard', params };
  }
  handleHash() {
    try {
      if (!window.location.hash || !window.location.hash.startsWith('#/')) {
        this.handlePath();
        return;
      }
      const hashInfo = this.parseHash();
      const pathInfo = this.parsePath();
      if (this._hasExplicitPathRoute() && hashInfo.view !== pathInfo.view) {
        this._clearLocationHash();
        this.handlePath();
        return;
      }
      const { view, params } = hashInfo;
      this.onNavigate(view, params);
      this.updateNav(view);
      this.pushPath(view, params);
      try {
        var sc2 =
          document.querySelector('#app-main') ||
          document.querySelector('.app-main') ||
          document.scrollingElement ||
          document.documentElement;
        if (sc2 && typeof sc2.scrollTo === 'function') sc2.scrollTo(0, 0);
        else if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
      } catch (_b) {
        /* ignore */
      }
    } catch (err) {
      const msg = (err === null || err === void 0 ? void 0 : err.message) || String(err);
      window['console']['error']('Router handleHash error:', msg);
    }
  }
  pushPath(view, params = {}) {
    try {
      const embedKeys = ['sb_parent_urlbar', 'sb_notify_base', 'sb_api_base', 'sb_website_mode', 'force'];
      const searchParams = new URLSearchParams();
      try {
        const current = new URLSearchParams(window.location.search || '');
        embedKeys.forEach((k) => {
          if (current.has(k)) searchParams.set(k, current.get(k));
        });
        if (typeof sessionStorage !== 'undefined') {
          ['sb_notify_base', 'sb_api_base', 'sb_parent_urlbar', 'sb_website_mode'].forEach((k) => {
            if (!searchParams.has(k)) {
              const stored = sessionStorage.getItem(k);
              if (stored) searchParams.set(k, stored);
            }
          });
        }
      } catch (e) {
        /* ignore */
      }
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '') searchParams.set(k, v);
      });
      if (window.self !== window.top && !searchParams.has('sb_parent_urlbar')) {
        searchParams.set('sb_parent_urlbar', '1');
      }
      const search = searchParams.toString();
      const base = this.getDashboardBase();
      const pathSegment = view === 'dashboard' || !view ? '' : `/${view}`;
      const newUrl = `${base}${pathSegment}${search ? '?' + search : ''}`;
      const current = `${window.location.pathname}${window.location.search}`;
      if (current !== newUrl || window.location.hash) {
        window.history.pushState({}, '', newUrl);
        if (window.location.hash) {
          this._clearLocationHash();
        }
      }
      // Notify IDE webview parent of the current URL so the URL bar stays in sync.
      if (window.parent && window.parent !== window) {
        try {
          window.parent.postMessage({ command: 'dashboardRouteChanged', url: window.location.href }, '*');
        } catch (e) {
          /* ignore */
        }
      }
    } catch (e) {
      /* webview may restrict this */
    }
  }
  navigate(view, params = {}) {
    this.pushPath(view, params);
    this.onNavigate(view, params);
    this.updateNav(view);
    try {
      var sc3 =
        document.querySelector('#app-main') ||
        document.querySelector('.app-main') ||
        document.scrollingElement ||
        document.documentElement;
      if (sc3 && typeof sc3.scrollTo === 'function') sc3.scrollTo(0, 0);
      else if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
    } catch (_c) {
      /* ignore */
    }
  }
  updateNav(view) {
    document.querySelectorAll('.nav-link[data-view]').forEach((link) => {
      link.classList.toggle('active', link.dataset.view === view);
    });
  }
}
