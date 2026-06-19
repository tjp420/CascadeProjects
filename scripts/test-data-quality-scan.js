const path = require('path');

// Mimic what the server does
process.chdir('C:/Users/Trevor/CascadeProjects/ai-platform');

try {
  const { runDataCleanupScan } = require('../ai-platform/server/lib/data-cleanup-scan.cjs');
  runDataCleanupScan('C:/Users/Trevor/CascadeProjects', { profile: 'data-quality', bypassCache: true })
    .then((result) => {
      console.log('SUCCESS:', JSON.stringify(result).slice(0, 500));
    })
    .catch((err) => {
      console.log('ERROR:', err.message);
      console.log(err.stack);
    });
} catch (e) {
  console.log('REQUIRE ERROR:', e.message);
  console.log(e.stack);
}
