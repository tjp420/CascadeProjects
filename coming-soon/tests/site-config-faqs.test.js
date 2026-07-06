const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Load site-config.js FAQs
// ============================================================================
const siteConfigPath = path.join(__dirname, '..', 'public', 'site-config.js');
const siteConfigText = fs.readFileSync(siteConfigPath, 'utf-8');

function extractFaqs(text) {
  // Pull the raw faqs array out of the JS file.
  const start = text.indexOf('faqs:');
  if (start === -1) return [];

  let bracket = text.indexOf('[', start);
  if (bracket === -1) return [];
  let depth = 0;
  let end = -1;
  for (let i = bracket; i < text.length; i++) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return [];

  const arrayText = text.slice(bracket, end + 1);
  // site-config.js uses single-quoted JS objects; parse each block directly.
  const blockPattern = /\{\s*q:\s*'([\s\S]*?)',\s*a:\s*'([\s\S]*?)'\s*\}/g;
  const faqs = [];
  let match;
  while ((match = blockPattern.exec(arrayText)) !== null) {
    faqs.push({
      q: match[1].replace(/\n\s*/g, ' ').trim(),
      a: match[2].replace(/\n\s*/g, ' ').trim()
    });
  }
  return faqs;
}

const REQUIRED_QUESTIONS = [
  'What is AI Slop Cop and how does it work?',
  'What do I get with the Free tier?',
  'What do I get with the Pro tier?',
  'What do I get with the Team tier?',
  'What do I get with the Enterprise tier?',
  'Do I need a SaaS subscription?',
  'How does the 14-day free trial work?',
  'Is this EU AI Act compliant?',
  'How long are license tokens valid?',
  'What is your refund policy?',
  'What data does AI Slop Cop transmit?',
  'Can I pay by invoice or ACH?',
];

const faqs = extractFaqs(siteConfigText);
const faqQuestions = faqs.map((f) => f.q);

describe('site-config.js FAQ coverage', () => {
  test('all required questions are present', () => {
    const missing = REQUIRED_QUESTIONS.filter((q) => !faqQuestions.includes(q));
    assert.strictEqual(missing.length, 0, `Missing FAQ questions: ${missing.join(', ')}`);
  });

  test('no duplicate questions exist', () => {
    const seen = new Set();
    const duplicates = [];
    for (const q of faqQuestions) {
      if (seen.has(q)) duplicates.push(q);
      seen.add(q);
    }
    assert.strictEqual(duplicates.length, 0, `Duplicate FAQ questions: ${duplicates.join(', ')}`);
  });

  test('every FAQ has a non-empty answer', () => {
    const empty = faqs.filter((f) => !f.a || f.a.trim().length === 0);
    assert.strictEqual(empty.length, 0, `${empty.length} FAQ(s) have empty answers`);
  });

  test('total FAQ count matches expected', () => {
    assert.strictEqual(faqs.length, REQUIRED_QUESTIONS.length, `Expected ${REQUIRED_QUESTIONS.length} FAQs, found ${faqs.length}`);
  });
});

// ============================================================================
// Smoke test: site-config.js is valid JavaScript
// ============================================================================
describe('site-config.js syntax', () => {
  test('file exists and is non-empty', () => {
    assert.ok(fs.existsSync(siteConfigPath), 'site-config.js should exist');
    const stats = fs.statSync(siteConfigPath);
    assert.ok(stats.size > 0, 'site-config.js should not be empty');
  });
});
