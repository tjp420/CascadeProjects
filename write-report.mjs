import { runSimpleBeaconAudit } from './SimpleBeaconPoC.mjs';
import fs from 'fs';

(async () => {
  try {
    const report = await runSimpleBeaconAudit(process.cwd());
    fs.mkdirSync('.simplebeacon', { recursive: true });
    fs.writeFileSync('.simplebeacon/poc-report.json', JSON.stringify(report, null, 2));
    console.log('Wrote .simplebeacon/poc-report.json');
  } catch (e) {
    console.error('Error running audit', e);
    process.exit(1);
  }
})();
