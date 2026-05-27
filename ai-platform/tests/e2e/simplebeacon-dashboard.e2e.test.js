const fs = require('fs');
const path = require('path');

const DASHBOARD_ROOT = path.join(__dirname, '../../web/simplebeacon-dashboard');
const INDEX_HTML = path.join(DASHBOARD_ROOT, 'index.html');

describe('simplebeacon-dashboard structure', () => {
  let html;

  beforeAll(() => {
    html = fs.readFileSync(INDEX_HTML, 'utf8');
  });

  test('index.html exists and loads module entry', () => {
    expect(html).toContain('/simplebeacon-dashboard/js/main.js');
    expect(html).toContain('type="module"');
  });

  test('uses design system CSS without Bootstrap', () => {
    expect(html).not.toContain('bootstrap');
    expect(html).toContain('/simplebeacon-dashboard/css/variables.css');
    expect(html).toContain('/simplebeacon-dashboard/css/components.css');
  });

  test('has main navigation sections', () => {
    expect(html).toContain('data-view="dashboard"');
    expect(html).toContain('data-view="results"');
    expect(html).toContain('data-view="tools"');
    expect(html).toContain('data-view="platform"');
    expect(html).toContain('data-view="quality"');
    expect(html).toContain('data-view="analyze"');
    expect(html).toContain('data-view="features"');
  });

  test('references Simplebeacon branding', () => {
    expect(html).toContain('Simplebeacon');
    expect(html).not.toContain('Truthcheck');
  });

  test('core JS modules exist', () => {
    const modules = [
      'js/main.js',
      'js/router.js',
      'js/services/scanService.js',
      'js/views/DashboardView.js',
      'js/views/ResultsView.js',
      'js/views/ToolsView.js',
      'js/views/PlatformView.js',
      'js/views/QualityView.js',
      'js/services/platformService.js'
    ];
    modules.forEach((mod) => {
      expect(fs.existsSync(path.join(DASHBOARD_ROOT, mod))).toBe(true);
    });
  });

  test('simplebeacon API module exists', () => {
    const apiPath = path.join(__dirname, '../../src/api/simplebeacon-api.js');
    expect(fs.existsSync(apiPath)).toBe(true);
  });

  test('coverage details button has resilient scroll target and fallback toast', () => {
    const qualityViewPath = path.join(DASHBOARD_ROOT, 'js/views/QualityView.js');
    const source = fs.readFileSync(qualityViewPath, 'utf8');
    expect(source).toContain('data-scroll="coverage"');
    expect(source).toContain('id="coverage-details"');
    expect(source).toContain('data-scroll-target="coverage"');
    expect(source).toContain('handleCoverageScroll(event)');
    expect(source).toContain('target.scrollIntoView({ behavior: \'smooth\', block: \'start\' })');
    expect(source).toContain('showToast(\'Coverage details are not available yet.\', \'info\')');
  });
});
