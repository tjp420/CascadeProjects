// simplebeacon-ignore documentation, i18n
import { apiUrl } from '../utils-lib/url.js';
import { fetchApi } from '../lib/recoverable-fetch.js';
const THEME_KEY = 'simplebeacon-theme';
const MANUAL_KEY = 'simplebeacon-theme-manual';
let _globalPollInterval = null;
let _themePollingDisabledUntil = 0;
let _initCalled = false;
let _themeMessageReceived = false;

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
    this.manualOverride = localStorage.getItem(MANUAL_KEY) === '1';
  }

  init() {
    if (_initCalled) return;
    _initCalled = true;
    this._listenForParentTheme();
    if (this.manualOverride) {
      this.apply(this.theme);
      if (window.__SIMPLEBEACON_ENV__) { this.pollServerTheme(); }
      return;
    }
    const ideTheme = detectIdeTheme();
    if (ideTheme) {
      this.apply(ideTheme);
      return;
    }
    if (window.__SIMPLEBEACON_ENV__) {
      this.apply(this.theme);
      this.pollServerTheme();
      return;
    }
    this.apply(this.theme);
    this.followIde();
  }

  _listenForParentTheme() {
    if (typeof window === 'undefined') return;
    window.addEventListener('message', (ev) => {
      if (ev.data && ev.data.command === 'setTheme' && ev.data.theme) {
        _themeMessageReceived = true;
        // Accept theme changes from the VS Code: webview wrapper even when a manual override exists,
        // so the sidebar theme toggle keeps the website in sync.
        this.set(ev.data.theme);
      }
    });
  }

  pollServerTheme() {
    if (_globalPollInterval !== null) {
      clearInterval(_globalPollInterval);
    }
    const poll = async () => {
      if (typeof fetch !== 'function') return;
      if (Date.now() < _themePollingDisabledUntil) return;
      if (this.manualOverride) return;
      if (_themeMessageReceived) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const resp = await fetchApi(apiUrl('/api/theme'));
        if (resp === null) {
          _themePollingDisabledUntil = Date.now() + 60 * 1000;
          return;
        }
        if (!resp.ok) {
          if (resp.status === 404) {
            _themePollingDisabledUntil = Date.now() + 5 * 60 * 1000;
            return;
          }
          return;
        }
        const d = await resp.json().catch(() => null);
        if (d && d.theme && !this.manualOverride) this.apply(d.theme);
      } catch (_) {}
    };
    poll();
    _globalPollInterval = setInterval(poll, 30000);
  }

  followIde() {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const applyMq = () => { if (!this.manualOverride) this.set(mq.matches ? 'dark' : 'light'); };
    try { mq.addEventListener('change', applyMq); } catch (_) { /* older browsers */ }
    if (!this.manualOverride) applyMq();
  }

  get() {
    return this.theme;
  }

  toggle() {
    this.manualOverride = true;
    localStorage.setItem(MANUAL_KEY, '1');
    const cycle = ['dark', 'light', 'fox'];
    const idx = cycle.indexOf(this.theme);
    this.theme = cycle[(idx + 1) % cycle.length];
    localStorage.setItem(THEME_KEY, this.theme);
    this.apply(this.theme);
    return this.theme;
  }

  set(theme) {
    const valid = ['dark', 'light', 'fox'];
    if (!valid.includes(theme)) { return this.theme; }
    this.theme = theme;
    localStorage.setItem(THEME_KEY, this.theme);
    this.apply(this.theme);
    return this.theme;
  }

  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      const icons = { dark: 'sun', light: 'moon', fox: 'flame' };
      const labels = { dark: 'Switch to light mode', light: 'Switch to fox mode', fox: 'Switch to dark mode' };
      const iconName = icons[theme] || 'moon';
      const icon = btn.querySelector('i[data-lucide]');
      if (icon) {
        icon.textContent = '';
        icon.setAttribute('data-lucide', iconName);
        if (typeof window !== 'undefined' && window.lucide && typeof window.lucide.createIcons === 'function') {
          try { window.lucide.createIcons({ attrs: { 'stroke-width': 2 } }); } catch (_) {}
        }
      } else if (btn.children.length === 0) {
        const emoji = { dark: '☀️', light: '🌙', fox: '🦊' };
        btn.textContent = emoji[theme] || '🌙';
      }
      btn.setAttribute('aria-label', labels[theme] || 'Switch theme');
    }
  }
}

/**
 * Theme service.
 */
export const themeService = new ThemeService();
