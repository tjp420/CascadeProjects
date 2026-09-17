// simplebeacon-ignore: packaging guard — refuses to overwrite extension dashboard-web
'use strict';

const force = process.env.FORCE_DASHBOARD_WEB_XCOPY === '1';

if (!force) {
  console.error(
    '[sync-dashboard-web] Refusing to xcopy ai-platform/web/simplebeacon-dashboard over simplebeacon-vscode-merged/dashboard-web.\n' +
      'That overwrite deletes extension-only dashboard files and can stale the VSIX bundle.\n' +
      'package:vsix uses compile + vsce --no-dependencies only.\n' +
      'Emergency override: FORCE_DASHBOARD_WEB_XCOPY=1 (do not use in CI).'
  );
  process.exit(1);
}

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const source = path.join(root, 'ai-platform', 'web', 'simplebeacon-dashboard');
const dest = path.join(path.dirname(source), '..', '..', 'simplebeacon-vscode-merged', 'dashboard-web');

if (!fs.existsSync(source)) {
  console.error(`[sync-dashboard-web] Source not found: ${source}`);
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });

const isWindows = process.platform === 'win32';
const cmd = isWindows ? `xcopy "${source}" "${dest}" /E /Y /I` : `cp -r "${source}/." "${dest}/"`;
console.warn(`[sync-dashboard-web] FORCE_DASHBOARD_WEB_XCOPY=1 — ${cmd}`);
execSync(cmd, { stdio: 'inherit', shell: true });
console.log('[sync-dashboard-web] Done (forced)');
