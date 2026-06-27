const THEME_KEY = 'simplebeacon-theme';

function detectIdeTheme() {
  try {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--vscode-editor-background').trim();
    if (!bg) return null;
    const hex = bg.replace('#', '');
    const rgb = parseInt(hex, 16);
    if (isNaN(rgb)) return null;
    const r = (rgb >> 16) & 255;
    const g = (rgb >> 8) & 255;
    const b = rgb & 255;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5 ? 'dark' : 'light';
  } catch (e) {
    return null;
  }
}

/**
 * Theme service.
 */
export class ThemeService {
  constructor() {
    this.theme = localStorage.getItem(THEME_KEY) || 'dark';
  }

  init() {
    const ideTheme = detectIdeTheme();
    if (ideTheme) {
      this.set(ideTheme);
      return;
    }
    if (window.__SIMPLEBEACON_ENV__ || /^127\.0\.0\.1:\d+$/.test(window.location.host)) {
      this.pollServerTheme();
      return;
    }
    this.apply(this.theme);
    this.followIde();
  }

  pollServerTheme() {
    const poll = () => {
      if (typeof fetch !== 'function') return;
      fetch('/api/theme').then(r => r.json()).then(d => {
        if (d && d.theme) this.apply(d.theme);
      }).catch(() => {});
    };
    poll();
    setInterval(poll, 1000);
  }

  followIde() {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const applyMq = () => this.set(mq.matches ? 'dark' : 'light');
    try { mq.addEventListener('change', applyMq); } catch (_) { /* older browsers */ }
    applyMq();
  }

  get() {
    return this.theme;
  }

  toggle() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, this.theme);
    this.apply(this.theme);
    return this.theme;
  }

  set(theme) {
    if (theme !== 'dark' && theme !== 'light') { return this.theme; }
    this.theme = theme;
    localStorage.setItem(THEME_KEY, this.theme);
    this.apply(this.theme);
    return this.theme;
  }

  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }
}

/**
 * Theme service.
 */
export const themeService = new ThemeService();
