const ROUTES = ['dashboard', 'audit', 'assessments', 'analyze', 'results', 'security', 'tools', 'platform', 'quality', 'help', 'features', 'trust', 'repository-health', 'settings', 'pricing', 'about', 'signin'];

export const PUBLIC_VIEWS = new Set(['signin', 'pricing', 'about', 'help', 'features', 'trust', 'repository-health']);

export class Router {
  constructor(onNavigate) {
    this.onNavigate = onNavigate;
    window.addEventListener('hashchange', () => this.handleHash());
  }

  init() {
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
    const { view, params } = this.parseHash();
    this.onNavigate(view, params);
    this.updateNav(view);
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
