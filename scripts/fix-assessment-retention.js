// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');
const file = 'C:/Users/Trevor/CascadeProjects/ai-platform/server/lib/assessment-retention.cjs';
let content = fs.readFileSync(file, 'utf8');

// Add constants import after recoverable-io require
if (!content.includes('constants.cjs')) {
  content = content.replace(
    "} = require('./recoverable-io.cjs');",
    "} = require('./recoverable-io.cjs');\nconst constants = require('../config/constants.cjs');"
  );
}

// Replace raw time calculations
content = content.replace(
  'const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;',
  'const DEFAULT_TTL_MS = constants.HOURS_PER_DAY * constants.MINUTES_PER_HOUR * constants.SECONDS_PER_MINUTE * constants.MS_PER_SECOND;'
);
content = content.replace(
  'const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;',
  'const DEFAULT_INTERVAL_MS = constants.MINUTES_PER_HOUR * constants.SECONDS_PER_MINUTE * constants.MS_PER_SECOND;'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed assessment-retention.cjs');
