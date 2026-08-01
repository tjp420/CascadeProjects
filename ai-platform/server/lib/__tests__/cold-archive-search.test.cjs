'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const os = require('os');

let archiveDir;
let _tempDir;

beforeAll(() => {
  _tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-cold-archive-'));
  archiveDir = path.join(_tempDir, 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  process.env.COLD_ARCHIVE_DIR = archiveDir;
});

afterAll(() => {
  delete process.env.COLD_ARCHIVE_DIR;
  if (_tempDir && fs.existsSync(_tempDir)) {
    fs.rmSync(_tempDir, { recursive: true, force: true });
  }
});

beforeEach(() => {
  // Clear and recreate archive dir
  if (fs.existsSync(archiveDir)) {
    fs.rmSync(archiveDir, { recursive: true, force: true });
  }
  fs.mkdirSync(archiveDir, { recursive: true });
  jest.resetModules();
});

function writeGzipNdjson(filename, lines) {
  const data = lines.map((l) => JSON.stringify(l)).join('\n');
  const gz = zlib.gzipSync(data);
  fs.writeFileSync(path.join(archiveDir, filename), gz);
}

async function loadSearch() {
  const search = require('../cold-archive-search.cjs');
  return search;
}

describe('cold-archive-search', () => {
  test('returns empty result for empty archive', async () => {
    const { search } = await loadSearch();
    const result = await search();
    expect(result.entries).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  test('filters by timestamp range', async () => {
    writeGzipNdjson('2026-01-01.json.gz', [
      { timestamp: '2026-01-01T00:00:00.000Z', action: 'login', orgId: 'org-a' },
      { timestamp: '2026-01-02T00:00:00.000Z', action: 'logout', orgId: 'org-a' },
    ]);
    const { search } = await loadSearch();
    const result = await search({
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-01-01T23:59:59.999Z',
    });
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].action).toBe('login');
  });

  test('filters by action and orgId', async () => {
    writeGzipNdjson('2026-01-02.json.gz', [
      { timestamp: '2026-01-02T00:00:00.000Z', action: 'login', orgId: 'org-a' },
      { timestamp: '2026-01-02T00:00:00.000Z', action: 'login', orgId: 'org-b' },
    ]);
    const { search } = await loadSearch();
    const result = await search({ action: 'login', orgId: 'org-a' });
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].orgId).toBe('org-a');
  });

  test('paginates with limit and offset', async () => {
    const lines = [];
    for (let i = 0; i < 25; i++) {
      lines.push({ timestamp: `2026-01-03T${String(i).padStart(2, '0')}:00:00.000Z`, action: 'event', orgId: 'org-x' });
    }
    writeGzipNdjson('2026-01-03.json.gz', lines);
    const { search } = await loadSearch();
    const p1 = await search({ limit: 10, offset: 0 });
    expect(p1.entries.length).toBe(10);
    expect(p1.hasMore).toBe(true);
    const p2 = await search({ limit: 10, offset: 10 });
    expect(p2.entries.length).toBe(10);
    const p3 = await search({ limit: 10, offset: 20 });
    expect(p3.entries.length).toBe(5);
    expect(p3.hasMore).toBe(false);
  });

  test('rejects start after end', async () => {
    const { search } = await loadSearch();
    await expect(search({ startDate: '2026-01-02T00:00:00.000Z', endDate: '2026-01-01T00:00:00.000Z' }))
      .rejects.toThrow(/start_after_end/);
  });

  test('rejects invalid dates', async () => {
    const { search } = await loadSearch();
    await expect(search({ startDate: 'not-a-date' }))
      .rejects.toThrow(/invalid_start_date/);
  });
});
