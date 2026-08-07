'use strict';
/**
 * Inlines referral-capture.js into all coming-soon HTML pages that reference it.
 * The script is tiny (19 lines) and eliminates NS_BINDING_ABORTED on Firefox.
 */
const fs = require('fs');
const path = require('path');

const REFERRAL_INLINE = `<script>(function(){try{var params=new URLSearchParams(window.location.search);var ref=params.get('ref');if(!ref)return;try{localStorage.setItem('sb_ref_slug',ref);}catch(_){}fetch('/api/referral/capture',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:ref,channel:'web'})}).catch(function(){});}catch(_){}})();</script>`;

const PATTERN = /<script\s+src=["']\/js-es2018\/referral-capture\.js["'][^>]*>\s*<\/script>/gi;

function walk(dir) {
  return fs.readdirSync(dir).flatMap(f => {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) return walk(fp);
    if (f.endsWith('.html')) return [fp];
    return [];
  });
}

const publicDir = path.resolve(__dirname, '..', 'coming-soon', 'public');
const files = walk(publicDir);
let changed = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (!PATTERN.test(content)) continue;
  const updated = content.replace(PATTERN, REFERRAL_INLINE);
  fs.writeFileSync(file, updated, 'utf8');
  console.log(`  Inlined referral-capture.js -> ${path.relative(publicDir, file)}`);
  changed++;
}

console.log(`\nDone: ${changed} file(s) updated`);
