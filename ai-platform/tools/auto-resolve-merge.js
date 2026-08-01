const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function gitShow(refPath) {
  try {
    return execSync(`git show ${refPath}`, { encoding: 'utf8' });
  } catch (e) {
    return null;
  }
}

// Load both versions of package.json
const mainPkgRaw = gitShow('origin/main:ai-platform/package.json');
const featPkgRaw = gitShow('feature/track18-groundwork:ai-platform/package.json');

if (!mainPkgRaw && !featPkgRaw) {
  console.error('Could not locate package.json on either branch');
  process.exit(2);
}

let mainPkg = {};
let featPkg = {};
try { mainPkg = mainPkgRaw ? JSON.parse(mainPkgRaw) : {}; } catch (e) { console.error('Failed parse main package.json', e.message); process.exit(2); }
try { featPkg = featPkgRaw ? JSON.parse(featPkgRaw) : {}; } catch (e) { console.error('Failed parse feature package.json', e.message); process.exit(2); }

// Merge helper: shallow merge, union for scripts/deps/devDeps, feature wins on conflict
function mergeObjects(a = {}, b = {}) {
  return Object.assign({}, a, b);
}

const merged = Object.assign({}, mainPkg, featPkg);
merged.scripts = mergeObjects(mainPkg.scripts, featPkg.scripts);
merged.dependencies = mergeObjects(mainPkg.dependencies, featPkg.dependencies);
merged.devDependencies = mergeObjects(mainPkg.devDependencies, featPkg.devDependencies);
merged.engines = mergeObjects(mainPkg.engines, featPkg.engines);
merged.workspaces = featPkg.workspaces || mainPkg.workspaces;
merged.keywords = Array.from(new Set([...(mainPkg.keywords||[]), ...(featPkg.keywords||[])]));
merged.author = featPkg.author || mainPkg.author;
merged.license = featPkg.license || mainPkg.license;

const outPath = path.join(__dirname, '..', 'package.json');
fs.writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
console.log('Wrote merged package.json ->', outPath);

// Resolve softHsmAdapter.cjs by preferring feature branch version if available, else main
const mainSoft = gitShow('origin/main:ai-platform/server/lib/hsm-adapter/softHsmAdapter.cjs');
const featSoft = gitShow('feature/track18-groundwork:ai-platform/server/lib/hsm-adapter/softHsmAdapter.cjs');
const softOutPath = path.join(__dirname, '..', 'server', 'lib', 'hsm-adapter', 'softHsmAdapter.cjs');
if (featSoft) {
  fs.writeFileSync(softOutPath, featSoft, 'utf8');
  console.log('Wrote feature version of softHsmAdapter.cjs ->', softOutPath);
} else if (mainSoft) {
  fs.writeFileSync(softOutPath, mainSoft, 'utf8');
  console.log('Wrote main version of softHsmAdapter.cjs ->', softOutPath);
} else {
  console.warn('No softHsmAdapter.cjs found in either branch');
}

process.exit(0);
