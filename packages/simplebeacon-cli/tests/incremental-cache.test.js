const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { IncrementalCacheManager } = require('../src/engine/incremental-cache.js');

test('IncrementalCacheManager basic lifecycle', async (t) => {
  const tmp = path.join(os.tmpdir(), `sb-cache-test-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
  fs.mkdirSync(tmp, { recursive: true });
  const cacheFile = path.join(tmp, 'cache.json');
  const filePath = path.join(tmp, 'file1.txt');
  fs.writeFileSync(filePath, 'hello');

  const mgr = new IncrementalCacheManager(cacheFile);
  const content = fs.readFileSync(filePath, 'utf8');

  // file not in cache yet
  assert.strictEqual(mgr.isFileUnchanged(filePath, content), false);

  // update record and assert unchanged
  mgr.updateFileRecord(filePath, content, [{ id: 'f1' }]);
  assert.strictEqual(mgr.isFileUnchanged(filePath, content), true);
  assert.deepStrictEqual(mgr.getSavedFindings(filePath), [{ id: 'f1' }]);

  // save and reload
  assert.strictEqual(mgr.saveCache(), true);
  const mgr2 = new IncrementalCacheManager(cacheFile);
  assert.strictEqual(mgr2.isFileUnchanged(filePath, content), true);

  // modify file and ensure change detected
  fs.writeFileSync(filePath, 'changed');
  const newContent = fs.readFileSync(filePath, 'utf8');
  assert.strictEqual(mgr2.isFileUnchanged(filePath, newContent), false);
});
