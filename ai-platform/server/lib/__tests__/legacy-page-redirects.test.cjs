'use strict';

const { registerLegacyPageRedirects, LEGACY_REDIRECTS, resolveLegacyTarget } = require('../legacy-page-redirects.cjs');

describe('legacy-page-redirects', () => {
  test('exports expected functions and constants', () => {
    expect(typeof registerLegacyPageRedirects).toBe('function');
    expect(typeof LEGACY_REDIRECTS).toBe('object');
    expect(typeof resolveLegacyTarget).toBe('function');
  });

  test('LEGACY_REDIRECTS has expected entries', () => {
    expect(LEGACY_REDIRECTS['/dashboard.html']).toBe('/');
    expect(LEGACY_REDIRECTS['/settings']).toBe('/#/settings');
    expect(LEGACY_REDIRECTS['/help']).toBe('/#/help');
  });

  test('resolveLegacyTarget returns target when landing not enabled', () => {
    expect(resolveLegacyTarget('/old', '/#/platform', false, false)).toBe('/#/platform');
  });

  test('resolveLegacyTarget adjusts hash routes for landing', () => {
    const result = resolveLegacyTarget('/old', '/#/platform', true, false);
    expect(result).toBe('/app#/platform');
  });

  test('resolveLegacyTarget keeps hash routes at root for internal dashboard', () => {
    const result = resolveLegacyTarget('/old', '/#/platform', true, true);
    expect(result).toBe('/#/platform');
  });

  test('resolveLegacyTarget redirects dashboard HTML to root for internal', () => {
    const result = resolveLegacyTarget('/dashboard.html', '/', true, true);
    expect(result).toBe('/');
  });

  test('resolveLegacyTarget redirects dashboard HTML to /app for non-internal', () => {
    const result = resolveLegacyTarget('/dashboard.html', '/', true, false);
    expect(result).toBe('/app');
  });

  test('registerLegacyPageRedirects registers GET routes', () => {
    const app = { get: jest.fn() };
    registerLegacyPageRedirects(app);
    expect(app.get).toHaveBeenCalled();
    expect(app.get.mock.calls.length).toBeGreaterThanOrEqual(Object.keys(LEGACY_REDIRECTS).length);
  });
});
