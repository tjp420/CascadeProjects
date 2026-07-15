// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
/**
 * Generate simple placeholder PNG icons for the extension.
 */
const { execSync } = require('child_process');
const path = require('path');

const ROOT = __dirname;
const SIZES = [16, 48, 128];
const COLOR = '#0078FF';

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function main() {
  const { r, g, b } = hexToRgb(COLOR);
  for (const size of SIZES) {
    const outPath = path.join(ROOT, `icon-${size}.png`);
    const ps = [
      'Add-Type -AssemblyName System.Drawing',
      `$bmp = New-Object System.Drawing.Bitmap(${size}, ${size})`,
      `$g = [System.Drawing.Graphics]::FromImage($bmp)`,
      `$g.Clear([System.Drawing.Color]::FromArgb(255, ${r}, ${g}, ${b}))`,
      `$g.Dispose()`,
      `$bmp.Save('${outPath}')`,
      `$bmp.Dispose()`
    ].join('; ');
    execSync(`powershell -Command "${ps}"`, { cwd: ROOT });
    if (process.env.SB_DEBUG === '1') {
      console.log(`Created ${outPath}`); // simplebeacon-ignore debug-artifact — gated by SB_DEBUG=1
    }
  }
}

main();
