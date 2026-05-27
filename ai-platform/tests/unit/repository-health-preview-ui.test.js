const fs = require('fs');
const path = require('path');

const REPO_HEALTH_VIEW = path.join(
  __dirname,
  '../../web/simplebeacon-dashboard/js/views/RepositoryHealthView.js'
);

describe('RepositoryHealthView merge preview wiring', () => {
  let source;

  beforeAll(() => {
    source = fs.readFileSync(REPO_HEALTH_VIEW, 'utf8');
  });

  test('renders preview merge buttons with candidate id', () => {
    expect(source).toContain('preview-merge-btn');
    expect(source).toContain('data-candidate-id');
  });

  test('binds preview merge clicks via delegation on stable container', () => {
    expect(source).toContain('preview-merge-btn');
    expect(source).toMatch(/closest\(['"]\.preview-merge-btn['"]\)/);
    expect(source).toContain('/api/optimization/merge-preview');
  });

  test('shows user-visible feedback for preview loading and errors', () => {
    expect(source).toContain('previewLoading');
    expect(source).toContain('showToast');
    expect(source).toContain('previewError');
    expect(source).toContain('merge-preview-panel');
  });

  test('re-binds events after preview render without losing delegation', () => {
    expect(source).toContain('bindEvents(container)');
    expect(source).toContain('_eventsBound');
  });
});
