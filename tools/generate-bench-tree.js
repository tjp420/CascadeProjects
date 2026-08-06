#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const argv = require('minimist')(process.argv.slice(2));

const COUNT = Number(argv.count || process.env.BENCH_GENERATE_COUNT || 100000);
const TARGET = path.resolve(argv.target || process.env.BENCH_TARGET || path.join(process.cwd(), 'bench-tree'));
const FILE_SIZE_KB = Number(argv.sizeKb || process.env.BENCH_FILE_SIZE_KB || 1);
const CLEAN = argv.clean || false;
// If user passed --clean, and COUNT===0 we'll perform immediate cleanup and exit.

function rimrafSync(p) {
  if (!fs.existsSync(p)) return;
  for (const entry of fs.readdirSync(p)) {
    const full = path.join(p, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) rimrafSync(full);
    else fs.unlinkSync(full);
  }
  fs.rmdirSync(p);
}

// If clean requested and count is zero, perform immediate cleanup
if (CLEAN && COUNT === 0) {
  if (fs.existsSync(TARGET)) {
    console.log(`Removing existing target: ${TARGET}`);
    // prefer fs.rmSync when available
    try {
      fs.rmSync(TARGET, { recursive: true, force: true });
    } catch (e) {
      rimrafSync(TARGET);
    }
  }
  process.exit(0);
}

console.log(`Generating ${COUNT} files into ${TARGET} (approx ${FILE_SIZE_KB} KB each)`);

if (!fs.existsSync(TARGET)) fs.mkdirSync(TARGET, { recursive: true });

// Strategy: create a moderate number of directories to avoid huge single-dir listings
const DIR_COUNT = Math.max(1, Math.floor(COUNT / 100));
const filesPerDir = Math.ceil(COUNT / DIR_COUNT);

const sampleContent = 'a'.repeat(Math.max(1, FILE_SIZE_KB * 1024 - 20)) + '\n';

let created = 0;
for (let d = 0; d < DIR_COUNT && created < COUNT; d++) {
  const dirName = path.join(TARGET, `dir-${String(d).padStart(4, '0')}`);
  if (!fs.existsSync(dirName)) fs.mkdirSync(dirName, { recursive: true });

  const makeCount = Math.min(filesPerDir, COUNT - created);
  for (let i = 0; i < makeCount; i++) {
    const fileName = path.join(dirName, `file-${String(created + 1).padStart(6, '0')}.txt`);
    try {
      fs.writeFileSync(fileName, sampleContent, { flag: 'w' });
    } catch (e) {
      console.error('Write failed for', fileName, e && e.code ? e.code : e);
    }
    created++;
    if (created % 1000 === 0) process.stdout.write(`.${created}`);
  }
}

console.log(`\nDone. Created ${created} files under ${TARGET}`);

// If clean flag set, remove generated tree after creation
if (CLEAN) {
  console.log(`\n🧹 [Cleanup] Removing synthetic tree at ${TARGET} as requested...`);
  try {
    fs.rmSync(TARGET, { recursive: true, force: true });
    console.log('✅ [Cleanup] Temporary benchmark artifacts erased cleanly.');
  } catch (e) {
    console.warn('Cleanup via fs.rmSync failed, falling back to rimrafSync.');
    rimrafSync(TARGET);
    console.log('✅ [Cleanup] Temporary benchmark artifacts erased cleanly.');
  }
}
