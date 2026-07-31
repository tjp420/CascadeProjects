// simplebeacon-ignore memory-leak — VS Code theme utility functions
import * as vscode from 'vscode';

/**
 * Get a VS Code theme color token string.
 * @param {string} id Theme color identifier (e.g. 'editor.background').
 * @returns {string | undefined}
 */
export function getThemeColor(id: string): string | undefined {
  try {
    const color = new vscode.ThemeColor(id);
    return color ? String(color) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Detect whether the active VS Code color theme is dark.
 * @returns {boolean}
 */
export function prefersDarkMode(): boolean {
  const kind = vscode.window.activeColorTheme?.kind;
  return kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast;
}

/**
 * Detect whether the active VS Code color theme is light.
 * @returns {boolean}
 */
export function prefersLightMode(): boolean {
  const kind = vscode.window.activeColorTheme?.kind;
  return kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight;
}

/**
 * Detect reduced motion preference.
 * VS Code does not expose this directly; returns false as a safe default.
 * @returns {boolean}
 */
export function prefersReducedMotion(): boolean {
  return false;
}

/**
 * Convert a hex color to an rgba string.
 * @param {string} hex
 * @param {number} [alpha=1]
 * @returns {string}
 */
export function hexToRgba(hex: string, alpha = 1): string {
  const sanitized = hex.replace('#', '');
  let r = 0,
    g = 0,
    b = 0;
  if (sanitized.length === 3) {
    r = parseInt(sanitized[0] + sanitized[0], 16);
    g = parseInt(sanitized[1] + sanitized[1], 16);
    b = parseInt(sanitized[2] + sanitized[2], 16);
  } else if (sanitized.length === 6) {
    r = parseInt(sanitized.substring(0, 2), 16);
    g = parseInt(sanitized.substring(2, 4), 16);
    b = parseInt(sanitized.substring(4, 6), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Shade a hex color by a percentage.
 * @param {string} color Hex color string.
 * @param {number} percent Positive to lighten, negative to darken.
 * @returns {string}
 */
export function shadeColor(color: string, percent: number): string {
  const f = parseInt(color.slice(1), 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const R = f >> 16;
  const G = (f >> 8) & 0x00ff;
  const B = f & 0x00ff;
  const r = Math.round((t - R) * p) + R;
  const g = Math.round((t - G) * p) + G;
  const b = Math.round((t - B) * p) + B;
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

/**
 * Return black or white depending on which has better contrast against a hex color.
 * @param {string} hex
 * @returns {'#000' | '#fff'}
 */
export function contrastColor(hex: string): '#000' | '#fff' {
  const sanitized = hex.replace('#', '');
  const r = parseInt(sanitized.substring(0, 2), 16);
  const g = parseInt(sanitized.substring(2, 4), 16);
  const b = parseInt(sanitized.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000' : '#fff';
}
