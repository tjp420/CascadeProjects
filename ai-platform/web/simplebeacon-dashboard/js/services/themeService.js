const THEME_KEY = 'simplebeacon-theme';

/**
 * Theme service.
 */
export class ThemeService {
  constructor() {
    this.theme = localStorage.getItem(THEME_KEY) || 'dark';
  }

  init() {
    this.apply(this.theme);
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

  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      const icon = btn.querySelector('i[data-lucide]');
      if (icon) {
        icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
      }
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      if (typeof window !== 'undefined' && window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
      }
    }
  }
}

/**
 * Theme service.
 */
export const themeService = new ThemeService();
