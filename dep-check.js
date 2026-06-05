const fs = require('fs');
const path = require('path');

const deps = ['archiver','bcryptjs','chokidar','cors','dotenv','express','express-rate-limit','helmet','http-errors','joi','jsonwebtoken','multer','pg','redis','simple-git','speakeasy','stripe','winston','ws'];
const used = new Set();

function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (['node_modules','.git','coverage','dist','build','.simplebeacon','tests','test','__tests__','fixtures','examples','coming-soon','reports','security-reports','templates','data-central','deployments','public','functions','cloudflare-deploy','temp','tests-legacy','.github-sync','.cursor','.vscode','downloads','findings','simplebeacon-frameworkless','simplebeacon-rule-tests'].includes(entry)) continue;
      walk(full);
    } else if (['.js','.mjs','.cjs','.ts','.tsx','.jsx'].includes(path.extname(entry).toLowerCase())) {
      try {
        const content = fs.readFileSync(full, 'utf8');
        for (const dep of deps) {
          const patterns = [
            new RegExp("require\\s*\\(\\s*['\"]" + dep + "['\"]\\s*\\)"),
            new RegExp("from\\s+['\"]" + dep + "['\"]"),
            new RegExp("import\\s*\\(\\s*['\"]" + dep + "['\"]\\s*\\)")
          ];
          for (const p of patterns) {
            if (p.test(content)) used.add(dep);
          }
        }
      } catch {}
    }
  }
}
walk('ai-platform');

console.log('USED:', [...used].sort().join(', '));
console.log('UNUSED:', deps.filter(d => !used.has(d)).join(', '));
