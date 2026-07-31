'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  appendExpertReview,
  loadExpertReviews,
  summarizeExpertConsensus,
  resolveStorePath,
} = require('../code-understanding/expert-review-store.cjs');

describe('code-understanding/expert-review-store', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'expert-review-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('exports expected functions', () => {
    expect(typeof appendExpertReview).toBe('function');
    expect(typeof loadExpertReviews).toBe('function');
    expect(typeof summarizeExpertConsensus).toBe('function');
    expect(typeof resolveStorePath).toBe('function');
  });

  test('resolveStorePath returns expected path', () => {
    const result = resolveStorePath('/project');
    expect(result).toContain('expert-reviews.jsonl');
    expect(result).toContain('.simplebeacon');
  });

  test('appendExpertReview writes entry and returns it', async () => {
    const entry = await appendExpertReview(tmpDir, { verdict: 'good', notes: 'test' });
    expect(entry.id).toBeDefined();
    expect(entry.createdAt).toBeDefined();
    expect(entry.verdict).toBe('good');
    expect(entry.notes).toBe('test');
  });

  test('loadExpertReviews returns empty for nonexistent store', async () => {
    const reviews = await loadExpertReviews(tmpDir);
    expect(reviews).toEqual([]);
  });

  test('loadExpertReviews returns appended reviews', async () => {
    await appendExpertReview(tmpDir, { verdict: 'approve' });
    await appendExpertReview(tmpDir, { verdict: 'reject' });
    const reviews = await loadExpertReviews(tmpDir);
    expect(reviews).toHaveLength(2);
  });

  test('summarizeExpertConsensus returns object', () => {
    const reviews = [
      { verdict: 'approve', confidence: 80 },
      { verdict: 'approve', confidence: 90 },
      { verdict: 'reject', confidence: 50 },
    ];
    const summary = summarizeExpertConsensus(reviews);
    expect(typeof summary).toBe('object');
  });
});
