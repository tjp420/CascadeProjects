const fs = require('fs');
const path = require('path');

const TARGET_DIR = process.argv[2] || path.join(__dirname, '..');

function walk(dir) {
  let files = 0, dirs = 0;
  let byFolder = {};

  function recurse(current, depth = 0) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        dirs++;
        recurse(full, depth + 1);
      } else {
        files++;
      }
    }
  }

  // Count per top-level subfolder
  const topEntries = fs.readdirSync(TARGET_DIR, { withFileTypes: true });
  for (const entry of topEntries) {
    if (entry.isDirectory()) {
      let subFiles = 0, subDirs = 0;
      function subRecurse(current) {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) { subDirs++; subRecurse(path.join(current, e.name)); }
          else { subFiles++; }
        }
      }
      subRecurse(path.join(TARGET_DIR, entry.name));
      byFolder[entry.name] = { files: subFiles, dirs: subDirs };
    }
  }

  recurse(TARGET_DIR);
  return { files, dirs, byFolder };
}

console.log(`Scanning: ${TARGET_DIR}`);
console.log('');

const result = walk(TARGET_DIR);

console.log(`TOTAL (no exclusions):`);
console.log(`  Files:   ${result.files.toLocaleString()}`);
console.log(`  Folders: ${result.dirs.toLocaleString()}`);
console.log('');
console.log('Per top-level folder:');
Object.entries(result.byFolder)
  .sort((a, b) => b[1].files - a[1].files)
  .forEach(([name, counts]) => {
    console.log(`  ${name.padEnd(30)} ${counts.files.toLocaleString().padStart(6)} files  ${counts.dirs.toLocaleString().padStart(4)} dirs`);
  });
