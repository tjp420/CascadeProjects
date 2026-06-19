const fs = require('fs');
const path = require('path');

// Map of constant names back to their literal values
const CONSTANT_VALUES = {
  'constants.DEFAULT_PORT': '3000',
  'constants.DASHBOARD_PORT': '54355',
  'constants.OLLAMA_PORT': '11434',
  'constants.AI_PROXY_PORT': '8080',
  'constants.POSTGRES_PORT': '5432',
  'constants.REDIS_PORT': '6379',
  'constants.TIMEOUT_2S': '2000',
  'constants.TIMEOUT_5S': '5000',
  'constants.TIMEOUT_8S': '8000',
  'constants.TIMEOUT_12S': '12000',
  'constants.TIMEOUT_15S': '15000',
  'constants.TIMEOUT_30S': '30000',
  'constants.TIMEOUT_1M': '60000',
  'constants.TIMEOUT_2M': '120000',
  'constants.TIMEOUT_10M': '600000',
  'constants.TIMEOUT_15M': '900000',
  'constants.BYTES_PER_KB': '1024',
  'constants.BYTES_PER_MB': '1048576',
  'constants.MAX_EXPORT_CHUNK': '65536',
  'constants.MAX_STRING_LENGTH': '100000',
  'constants.MAX_REQUEST_BODY': '4096',
  'constants.DEFAULT_RECORD_COUNT_BASE': '100',
  'constants.DEFAULT_RANDOM_MAX': '1000',
  'constants.MAX_RATE_LIMIT': '2000',
  'constants.MAX_ANALYZE_RATE_LIMIT': '1000',
  'constants.AUTH_RATE_LIMIT': '15',
  'constants.MAX_RETRIES': '10',
  'constants.RATE_LIMIT_WINDOW_MS': '15 * 60 * 1000',
  'constants.ONE_YEAR_SECONDS': '31536000',
  'constants.ONE_DAY_SECONDS': '86400',
  'constants.COOKIE_MAX_AGE': '3600000',
  'constants.MOCK_REALISM_SCORE': "'87.3%'",
  'constants.MOCK_COMPRESSION_RATIO': "'67.8%'",
  'constants.MOCK_OPTIMIZATION_RATE': "'10%'",
  'constants.MOCK_CONVERSION_SIZE_FACTOR': '0.8',
  'constants.MOCK_CLEANING_SIZE_FACTOR': '0.9',
  'constants.FILES_PROCESSED_STAT': '59763',
  'constants.REDUCTION_RATE_STAT': "'67.6%'",
  'constants.MS_PER_SECOND': '1000',
  'constants.SECONDS_PER_MINUTE': '60',
  'constants.MINUTES_PER_HOUR': '60',
  'constants.HOURS_PER_DAY': '24',
  'constants.ONE_SECOND_MS': '1000',
  'constants.ONE_MINUTE_MS': '60000',
  'constants.FIVE_MINUTES_MS': '300000',
  'constants.ONE_HOUR_MS': '3600000',
  'constants.ONE_DAY_MS': '86400000',
  'constants.THIRTY_DAYS_MS': '2592000000',
  'constants.PERCENTAGE_MULTIPLIER': '100',
};

const WEB_DIR = 'C:/Users/Trevor/CascadeProjects/ai-platform/web';
const EXCLUDED = ['node_modules', '.git', 'dist', 'build'];

function walk(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED.includes(entry.name)) continue;
      walk(full, callback);
    } else if (/\.(js|mjs)$/.test(entry.name)) {
      callback(full);
    }
  }
}

let totalFiles = 0;
let totalChanges = 0;

walk(WEB_DIR, (file) => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Remove the constants require() import line
  content = content.replace(/const constants = require\(['"][^'"]*constants\.cjs['"]\);\n?/g, '');

  // Replace constants.XXX back to literals
  for (const [constName, literal] of Object.entries(CONSTANT_VALUES)) {
    const regex = new RegExp(constName.replace('.', '\\.'), 'g');
    content = content.replace(regex, literal);
  }

  if (content !== original) {
    totalFiles++;
    totalChanges++;
    fs.writeFileSync(file, content, 'utf8');
    console.log(`✓ ${path.relative('C:/Users/Trevor/CascadeProjects/ai-platform', file)}`);
  }
});

console.log(`\nFixed ${totalFiles} browser files.`);
