'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  generateSandboxId,
  copyDirectorySync,
  wipeDirectorySync,
  MAX_UPLOAD_BYTES,
} = require('./data-processor.cjs');

test('generateSandboxId returns a cryptographically sized hex identifier', () => {
  const id = generateSandboxId();
  assert.match(id, /^[a-f0-9]{32}$/);
});

test('copyDirectorySync preserves nested files and wipeDirectorySync removes the tree', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'simplebeacon-data-processor-'));
  const source = path.join(root, 'source');
  const destination = path.join(root, 'destination');
  fs.mkdirSync(path.join(source, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(source, 'nested', 'report.txt'), 'ephemeral');

  try {
    copyDirectorySync(source, destination);
    assert.equal(
      fs.readFileSync(path.join(destination, 'nested', 'report.txt'), 'utf8'),
      'ephemeral'
    );
    wipeDirectorySync(destination);
    assert.equal(fs.existsSync(destination), false);
  } finally {
    wipeDirectorySync(root);
  }
});

test('MAX_UPLOAD_BYTES is capped at 500 MiB', () => {
  assert.equal(MAX_UPLOAD_BYTES, 500 * 1024 * 1024);
});
