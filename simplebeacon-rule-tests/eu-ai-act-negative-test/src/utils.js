/**
 * Negative Test Case: EU AI Act — benign utility code
 * Expected Behavior: PASS — should NOT trigger EU AI Act finding
 * Reason: Generic utility functions with no high-risk AI system indicators
 * simplebeacon:eu-ai-act-patterns: test-negative-case
 */

function formatDate(date) {
  return new Date(date).toISOString();
}

function sanitizeInput(input) {
  return String(input).replace(/[<>]/g, '');
}

function calculateSum(items) {
  return items.reduce((a, b) => a + b, 0);
}

// --- Boundary-negative helpers ---
// The following functions use words that appear *near* high-risk
// patterns but are arranged in benign, non-triggering ways.

function filterData(items, predicate) {
  return items.filter(predicate);
}

function matchPattern(text, regex) {
  return text.match(regex);
}

function rankItems(items, key) {
  return items.sort((a, b) => a[key] - b[key]);
}

function screenOutput(output) {
  return output.replace(/\x1b\[[0-9;]*m/g, '');
}

function calculateScore(answers) {
  return answers.reduce((s, a) => s + (a.correct ? 1 : 0), 0);
}

function predictWeather(trend) {
  return trend.slice(-1)[0] > trend[0] ? 'warming' : 'stable';
}

function detectChanges(oldObj, newObj) {
  const diff = {};
  for (const k of Object.keys(newObj)) {
    if (oldObj[k] !== newObj[k]) diff[k] = newObj[k];
  }
  return diff;
}

function classifyType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function assessValue(value, threshold) {
  return value >= threshold ? 'pass' : 'fail';
}

function generateReport(data) {
  return JSON.stringify(data, null, 2);
}

function modelData(schema, rows) {
  return rows.map((row) => Object.fromEntries(schema.map((k) => [k, row[k]])));
}

function learningCurve(epochs, loss) {
  return epochs.map((e, i) => ({ epoch: e, loss: loss[i] }));
}

function decisionTree(data, depth) {
  if (depth <= 0 || data.length < 2) return data;
  const mid = Math.floor(data.length / 2);
  return {
    left: decisionTree(data.slice(0, mid), depth - 1),
    right: decisionTree(data.slice(mid), depth - 1),
  };
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function truncateString(str, maxLen) {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}

function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function groupBy(array, key) {
  return array.reduce((acc, item) => {
    const k = item[key];
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}

function uniqueBy(array, key) {
  const seen = new Set();
  return array.filter((item) => {
    const v = item[key];
    if (seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

module.exports = {
  formatDate,
  sanitizeInput,
  calculateSum,
  filterData,
  matchPattern,
  rankItems,
  screenOutput,
  calculateScore,
  predictWeather,
  detectChanges,
  classifyType,
  assessValue,
  generateReport,
  modelData,
  learningCurve,
  decisionTree,
  validateEmail,
  truncateString,
  debounce,
  deepClone,
  isEmpty,
  parseJSON,
  formatBytes,
  slugify,
  groupBy,
  uniqueBy,
};
