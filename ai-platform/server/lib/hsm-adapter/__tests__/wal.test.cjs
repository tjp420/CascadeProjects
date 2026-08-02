"use strict";

const fs = require('fs');
const os = require('os');
const path = require('path');
const { MigrationWAL } = require('../wal.cjs');

describe('MigrationWAL compaction', () => {
  const tmpDir = path.join(os.tmpdir(), `wal-test-${process.pid}-${Date.now()}`);
  const walPath = path.join(tmpDir, 'test.wal');

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  });

  test('append and getPending then compactLog retains only pending', () => {
    const wal = new MigrationWAL(walPath);
    wal.append({ id: 'a', status: 'pending', path: '/tmp/a' });
    wal.append({ id: 'b', status: 'pending', path: '/tmp/b' });
    wal.append({ id: 'a', status: 'applied' });

    let pending = wal.getPending();
    expect(Array.isArray(pending)).toBe(true);
    // only 'b' should remain pending
    expect(pending.find(p => p.id === 'b')).toBeTruthy();
    expect(pending.find(p => p.id === 'a')).toBeFalsy();

    const res = wal.compactLog();
    expect(res.retained).toBe(1);

    const raw = fs.readFileSync(walPath, 'utf8').trim().split('\n');
    expect(raw.length).toBe(1);
    const parsed = JSON.parse(raw[0]);
    expect(parsed.id).toBe('b');
  });
});
