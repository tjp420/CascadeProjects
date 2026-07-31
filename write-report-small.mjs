import { runSimpleBeaconAudit } from './SimpleBeaconPoC.mjs';
import fs from 'fs';
import path from 'path';

(async () => {
  try {
    const target = path.resolve('./local-analyzer');
    console.log('Running audit on', target);
    const report = await runSimpleBeaconAudit(target);
    fs.mkdirSync('.simplebeacon', { recursive: true });
    const out = '.simplebeacon/poc-report-local-analyzer.json';
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log('Wrote', out);
  } catch (e) {
    console.error('Error running audit', (e && e.stack) || e);
    process.exit(1);
  }
})();
