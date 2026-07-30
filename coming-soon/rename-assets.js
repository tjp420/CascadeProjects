'use strict';
const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(__dirname, 'public');
const appDir = path.join(publicDir, 'app');
const assetsDir = path.join(appDir, 'assets');

// Version suffix for cache-busting
const version = Date.now().toString();

// Files to rename
const filesToRename = ['main.js', 'main.css', 'main.js.map'];

console.log('Renaming assets with version suffix:', version);

for (const file of filesToRename) {
  const oldPath = path.join(assetsDir, file);
  const ext = path.extname(file);
  const base = path.basename(file, ext);
  const mapSuffix = file.endsWith('.map') ? '.map' : '';
  const newFile = `${base}.v${version}${ext.replace('.map', '')}${mapSuffix}`;
  const newPath = path.join(assetsDir, newFile);

  if (fs.existsSync(oldPath)) {
    fs.copyFileSync(oldPath, newPath);
    console.log(`  Created: ${newFile}`);
  }
}

// Also handle TeamMetricsView.js
const tmPath = path.join(assetsDir, 'TeamMetricsView.js');
if (fs.existsSync(tmPath)) {
  const tmNew = `TeamMetricsView.v${version}.js`;
  fs.copyFileSync(tmPath, path.join(assetsDir, tmNew));
  console.log(`  Created: ${tmNew}`);
}

// Update __entry and index.html to reference the new filenames
const entryPath = path.join(appDir, '__entry');
const indexPath = path.join(appDir, 'index.html');

for (const filePath of [entryPath, indexPath]) {
  if (!fs.existsSync(filePath)) continue;
  let html = fs.readFileSync(filePath, 'utf8');

  // Replace main.js references
  html = html.replace(/\/app\/assets\/main\.js\?v=[^"']*/g, `/app/assets/main.v${version}.js`);
  html = html.replace(/\/app\/assets\/main\.js(?!map)/g, `/app/assets/main.v${version}.js`);

  // Replace main.css references
  html = html.replace(/\/app\/assets\/main\.css\?v=[^"']*/g, `/app/assets/main.v${version}.css`);
  html = html.replace(/\/app\/assets\/main\.css/g, `/app/assets/main.v${version}.css`);

  // Replace main.js.map references
  html = html.replace(/\/\/# sourceMappingURL=main\.js\.map/g, `//# sourceMappingURL=main.v${version}.js.map`);

  // Replace TeamMetricsView.js references (in the lazy import)
  html = html.replace(/\/app\/assets\/TeamMetricsView\.js/g, `/app/assets/TeamMetricsView.v${version}.js`);

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`  Updated: ${path.basename(filePath)}`);
}

console.log('Done. Deploy with: npx wrangler pages deploy public --project-name=simplebeacon');
