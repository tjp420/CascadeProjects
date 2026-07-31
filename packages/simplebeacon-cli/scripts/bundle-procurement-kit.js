#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function markdownToHtml(md) {
  // Very small markdown -> HTML converter for headings, code blocks, lists, links, paragraphs
  const lines = md.split(/\r?\n/);
  let out = [];
  let inCode = false;
  let codeLang = '';
  let inList = false;
  for (let line of lines) {
    if (/^```/.test(line)) {
      if (!inCode) {
        inCode = true;
        codeLang = line.replace(/^```/, '').trim();
        out.push('<pre><code>');
      } else {
        inCode = false;
        out.push('</code></pre>');
      }
      continue;
    }
    if (inCode) {
      out.push(escapeHtml(line));
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) {
      const level = line.match(/^#{1,6}/)[0].length;
      const text = line.replace(/^#{1,6}\s+/, '');
      out.push(`<h${level}>${inlineFormat(text)}</h${level}>`);
      continue;
    }
    if (/^[*-]\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      const item = line.replace(/^[*-]\s+/, '');
      out.push(`<li>${inlineFormat(item)}</li>`);
      continue;
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
    }
    if (line.trim() === '') {
      out.push('<p></p>');
      continue;
    }
    out.push(`<p>${inlineFormat(line)}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

function inlineFormat(text) {
  // code spans
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // links [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return escapeHtmlExceptHtml(text);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtmlExceptHtml(str) {
  // very naive: do not escape existing tags produced above
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/&lt;(\/)?(h[1-6]|p|a|code|pre|ul|li|strong|em)([^&]*)&gt;/g, '<$1$2$3>');
}

function makeHtmlPage(title, bodyHtml) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  body{font-family:Inter,system-ui,Arial,Helvetica,sans-serif;background:#f6f7f9;color:#111;padding:28px}
  .container{max-width:900px;margin:0 auto;background:#fff;padding:28px;border-radius:8px;box-shadow:0 6px 18px rgba(12,15,20,0.06)}
  pre{background:#0b1220;color:#e6edf3;padding:12px;border-radius:6px;overflow:auto}
  code{background:#eef2f6;padding:2px 4px;border-radius:4px}
  h1,h2,h3{color:#0b1220}
  a{color:#0b66ff}
  </style></head><body><div class="container"><h1>${escapeHtml(title)}</h1>${bodyHtml}</div></body></html>`;
}

function writeHtmlFromMd(srcPath, destPath, titleFallback) {
  if (!fs.existsSync(srcPath)) {
    console.warn('Missing source:', srcPath);
    return false;
  }
  const md = fs.readFileSync(srcPath, 'utf8');
  const body = markdownToHtml(md);
  const title = titleFallback || path.basename(srcPath);
  const html = makeHtmlPage(title, body);
  fs.writeFileSync(destPath, html, 'utf8');
  return true;
}

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

async function main() {
  const repoRoot = process.cwd();
  const outDir = path.resolve(repoRoot, 'generated');
  const tmpDir = path.resolve(outDir, 'procurement-kit-tmp');
  ensureDir(tmpDir);

  const sources = [
    { src: path.resolve(repoRoot, '.simplebeacon/docs/security-whitepaper.md'), name: 'security-whitepaper.html', title: 'Security Whitepaper' },
    { src: path.resolve(repoRoot, '.simplebeacon/docs/advanced-guardrails.md'), name: 'advanced-guardrails.html', title: 'Advanced Guardrails' }
  ];

  // populate HTML
  for (const s of sources) {
    const dest = path.join(tmpDir, s.name);
    writeHtmlFromMd(s.src, dest, s.title);
  }

  // attach verify-isolation.json if present
  const verifySrc = path.resolve(repoRoot, '.simplebeacon/artifacts/verify-isolation.json');
  if (fs.existsSync(verifySrc)) {
    fs.copyFileSync(verifySrc, path.join(tmpDir, 'verify-isolation.json'));
  } else {
    // try repo root .simplebeacon/verify-isolation.json fallback
    const alt = path.resolve(repoRoot, '.simplebeacon/verify-isolation.json');
    if (fs.existsSync(alt)) fs.copyFileSync(alt, path.join(tmpDir, 'verify-isolation.json'));
  }

  // also include rules README if present
  const rulesReadme = path.resolve(repoRoot, '.simplebeacon/rules/README.md');
  if (fs.existsSync(rulesReadme)) {
    writeHtmlFromMd(rulesReadme, path.join(tmpDir, 'rules-readme.html'), 'Rules Authoring Guide');
  }

  // Compute SHA-256 checksums for all files in tmpDir and write checksums.sha256
  try {
    const crypto = require('crypto');
    const files = fs.readdirSync(tmpDir).filter(f => fs.statSync(path.join(tmpDir, f)).isFile());
    const lines = [];
    for (const f of files) {
      const buf = fs.readFileSync(path.join(tmpDir, f));
      const h = crypto.createHash('sha256').update(buf).digest('hex');
      lines.push(`${h}  ${f}`);
    }
    fs.writeFileSync(path.join(tmpDir, 'checksums.sha256'), lines.join('\n') + '\n', 'utf8');
  } catch (err) {
    console.warn('Failed to compute checksums:', err && err.message);
  }

  const zipName = path.resolve(repoRoot, 'generated', 'simplebeacon-procurement-kit.zip');
  ensureDir(path.dirname(zipName));

  try {
    if (process.platform === 'win32') {
      // Use PowerShell Compress-Archive
      const ps = `powershell -NoProfile -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${zipName}' -Force"`;
      execSync(ps, { stdio: 'inherit' });
    } else {
      // Try native zip utility
      try {
        execSync(`zip -r '${zipName}' .`, { cwd: tmpDir, stdio: 'inherit' });
      } catch (e) {
        // fallback to node-streaming zip unavailable; write a simple tar.gz instead
        const tar = require('child_process').spawnSync('tar', ['-czf', zipName.replace(/\.zip$/, '.tar.gz'), '.'], { cwd: tmpDir, stdio: 'inherit' });
        if (tar.status !== 0) throw new Error('Failed to create archive');
      }
    }
    console.log('Bundle created at', zipName);
  } catch (err) {
    console.error('Failed to create zip archive:', err.message || err);
    process.exitCode = 2;
    return;
  }
}

main().catch(err => { console.error(err); process.exit(2); });
