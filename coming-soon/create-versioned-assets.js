'use strict';
const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(__dirname, 'public');
const appDir = path.join(publicDir, 'app');
const assetsDir = path.join(appDir, 'assets');
const version = Date.now();

console.log('Creating versioned assets with version:', version);

// 1. Copy main.js -> main.v{version}.js
const mainJs = fs.readFileSync(path.join(assetsDir, 'main.js'), 'utf8');
const versionedMainJs = mainJs.replace(
  /import\("\.\/TeamMetricsView\.js"\)/g,
  `import("./TeamMetricsView.v${version}.js")`
);
fs.writeFileSync(path.join(assetsDir, `main.v${version}.js`), versionedMainJs, 'utf8');
console.log(`  Created: main.v${version}.js (${versionedMainJs.length} bytes)`);

// 2. Copy main.css -> main.v{version}.css
const mainCss = fs.readFileSync(path.join(assetsDir, 'main.css'), 'utf8');
fs.writeFileSync(path.join(assetsDir, `main.v${version}.css`), mainCss, 'utf8');
console.log(`  Created: main.v${version}.css`);

// 3. Copy TeamMetricsView.js -> TeamMetricsView.v{version}.js
const tmPath = path.join(assetsDir, 'TeamMetricsView.js');
if (fs.existsSync(tmPath)) {
  const tmJs = fs.readFileSync(tmPath, 'utf8');
  fs.writeFileSync(path.join(assetsDir, `TeamMetricsView.v${version}.js`), tmJs, 'utf8');
  console.log(`  Created: TeamMetricsView.v${version}.js`);
}

// 4. Create entry-v2.html with versioned references
let entryHtml = fs.readFileSync(path.join(appDir, '__entry'), 'utf8');
// Replace main.js references (both query-string and plain)
entryHtml = entryHtml.replace(/\/app\/assets\/main\.js(\?[^"'\s]*)?/g, `/app/assets/main.v${version}.js`);
entryHtml = entryHtml.replace(/\/app\/assets\/main\.css(\?[^"'\s]*)?/g, `/app/assets/main.v${version}.css`);
fs.writeFileSync(path.join(appDir, 'entry-v2.html'), entryHtml, 'utf8');
console.log(`  Created: entry-v2.html (references main.v${version}.js)`);

// 5. Verify
const v2Html = fs.readFileSync(path.join(appDir, 'entry-v2.html'), 'utf8');
const mainRef = v2Html.match(/main\.v[0-9]+\.js/g);
const cssRef = v2Html.match(/main\.v[0-9]+\.css/g);
console.log('\nVerification:');
console.log('  entry-v2.html has versioned JS ref:', mainRef);
console.log('  entry-v2.html has versioned CSS ref:', cssRef);
console.log('  main.v' + version + '.js has versioned TM import:', versionedMainJs.includes(`TeamMetricsView.v${version}.js`));
console.log('\nDone. Deploy with: npx wrangler pages deploy public --project-name=simplebeacon');
