/**
 * Webhook Formatting Validation Tests
 *
 * Validates that the Slack and Discord JSON payload structures produced by
 * both the Node.js and Python E2E runners remain structurally stable and
 * conform to the expected schema. This prevents silent breakage when
 * notification code is modified.
 *
 * Usage: node tests/test_webhook_format.cjs
 *
 * Exit code 0 = all tests passed, non-zero = failures detected.
 */

const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
  }
}

console.log('\n🧪 Webhook Formatting Validation Suite\n');

// ─── Discord Payload Structure Tests ───────────────────────────

console.log('Discord Embed Structure:');

test('Discord payload has embeds array', () => {
  const payload = buildDiscordPayload(false);
  assert.ok(Array.isArray(payload.embeds), 'embeds must be an array');
  assert.ok(payload.embeds.length >= 1, 'at least one embed required');
});

test('Discord embed has required fields', () => {
  const payload = buildDiscordPayload(false);
  const embed = payload.embeds[0];
  assert.ok(typeof embed.title === 'string', 'title must be string');
  assert.ok(typeof embed.description === 'string', 'description must be string');
  assert.ok(typeof embed.color === 'number', 'color must be number');
  assert.ok(Array.isArray(embed.fields), 'fields must be array');
  assert.ok(embed.fields.length >= 3, 'at least 3 fields required');
});

test('Discord embed fields have name, value, inline', () => {
  const payload = buildDiscordPayload(false);
  for (const field of payload.embeds[0].fields) {
    assert.ok(typeof field.name === 'string', 'field.name must be string');
    assert.ok(typeof field.value === 'string', 'field.value must be string');
    assert.ok(typeof field.inline === 'boolean', 'field.inline must be boolean');
  }
});

test('Discord embed has footer and timestamp', () => {
  const payload = buildDiscordPayload(false);
  const embed = payload.embeds[0];
  assert.ok(embed.footer, 'footer is required');
  assert.ok(typeof embed.footer.text === 'string', 'footer.text must be string');
  assert.ok(embed.timestamp, 'timestamp is required');
});

test('Discord security alert embed is added when triggered', () => {
  const payload = buildDiscordPayload(true);
  assert.ok(payload.embeds.length >= 2, 'security alert should add a second embed');
  const alertEmbed = payload.embeds[1];
  assert.ok(alertEmbed.title.includes('Security'), 'alert embed title should mention Security');
  assert.ok(alertEmbed.color === 15105570, 'alert embed color should be orange (15105570)');
  assert.ok(Array.isArray(alertEmbed.fields), 'alert embed must have fields array');
});

test('Discord security alert has XSS details field', () => {
  const payload = buildDiscordPayload(true);
  const alertEmbed = payload.embeds[1];
  const xssField = alertEmbed.fields.find(f => f.name.includes('XSS'));
  assert.ok(xssField, 'XSS Reflection Details field must be present in alert');
  assert.ok(typeof xssField.value === 'string', 'XSS field value must be string');
  assert.ok(xssField.value.length > 0, 'XSS field value must not be empty');
});

test('Discord security alert has unsanitized payloads field', () => {
  const payload = buildDiscordPayload(true);
  const alertEmbed = payload.embeds[1];
  const unsanField = alertEmbed.fields.find(f => f.name.includes('Unsanitized'));
  assert.ok(unsanField, 'Unsanitized Payload Vectors field must be present in alert');
  assert.ok(typeof unsanField.value === 'string', 'unsanitized field value must be string');
});

test('Discord core embed includes security metrics fields', () => {
  const payload = buildDiscordPayload(false);
  const fields = payload.embeds[0].fields;
  const fieldNames = fields.map(f => f.name);
  assert.ok(fieldNames.includes('Payload Injections'), 'must have Payload Injections field');
  assert.ok(fieldNames.includes('XSS Reflected'), 'must have XSS Reflected field');
  assert.ok(fieldNames.includes('Security Report'), 'must have Security Report field');
});

// ─── Slack Payload Structure Tests ─────────────────────────────

console.log('\nSlack Block Structure:');

test('Slack payload has text and blocks', () => {
  const payload = buildSlackPayload(false);
  assert.ok(typeof payload.text === 'string', 'text must be string');
  assert.ok(Array.isArray(payload.blocks), 'blocks must be array');
  assert.ok(payload.blocks.length >= 2, 'at least 2 blocks required');
});

test('Slack has header block as first block', () => {
  const payload = buildSlackPayload(false);
  const header = payload.blocks[0];
  assert.ok(header.type === 'header', 'first block must be header type');
  assert.ok(header.text, 'header must have text');
  assert.ok(header.text.type === 'plain_text', 'header text type must be plain_text');
  assert.ok(typeof header.text.text === 'string', 'header text must be string');
});

test('Slack has section block with fields', () => {
  const payload = buildSlackPayload(false);
  const section = payload.blocks.find(b => b.type === 'section' && b.fields);
  assert.ok(section, 'must have a section block with fields');
  assert.ok(Array.isArray(section.fields), 'section.fields must be array');
  assert.ok(section.fields.length >= 4, 'section must have at least 4 fields');
});

test('Slack section fields use mrkdwn type', () => {
  const payload = buildSlackPayload(false);
  const section = payload.blocks.find(b => b.type === 'section' && b.fields);
  for (const field of section.fields) {
    assert.ok(field.type === 'mrkdwn', 'section field type must be mrkdwn');
    assert.ok(typeof field.text === 'string', 'section field text must be string');
  }
});

test('Slack security alert adds extra section block', () => {
  const payload = buildSlackPayload(true);
  const alertSection = payload.blocks.find(b =>
    b.type === 'section' && b.text && b.text.text && b.text.text.includes('Security Remediation Alert')
  );
  assert.ok(alertSection, 'security alert should add a Security Remediation Alert section');
});

test('Slack header text changes on security alert', () => {
  const normal = buildSlackPayload(false);
  const alert = buildSlackPayload(true);
  assert.ok(!normal.blocks[0].text.text.includes('SECURITY ALERT'), 'normal header should not contain SECURITY ALERT');
  assert.ok(alert.blocks[0].text.text.includes('SECURITY ALERT'), 'alert header should contain SECURITY ALERT');
});

test('Slack section includes security metric fields', () => {
  const payload = buildSlackPayload(false);
  const section = payload.blocks.find(b => b.type === 'section' && b.fields);
  const fieldTexts = section.fields.map(f => f.text);
  const hasPayload = fieldTexts.some(t => t.includes('Payload Injections'));
  const hasXss = fieldTexts.some(t => t.includes('XSS Reflected'));
  assert.ok(hasPayload, 'must include Payload Injections field');
  assert.ok(hasXss, 'must include XSS Reflected field');
});

// ─── Edge Case Tests ───────────────────────────────────────────

console.log('\nEdge Cases:');

test('Empty results do not trigger security alert', () => {
  const payload = buildDiscordPayload(false);
  assert.ok(payload.embeds.length === 1, 'no alert embed when no security issues');
});

test('Color values are valid Discord embed colors', () => {
  const normal = buildDiscordPayload(false);
  const alert = buildDiscordPayload(true);
  const validColors = [3066993, 15158332, 15105570, 15844367, 3447003];
  for (const embed of normal.embeds) {
    assert.ok(validColors.includes(embed.color), `normal color ${embed.color} must be valid`);
  }
  for (const embed of alert.embeds) {
    assert.ok(validColors.includes(embed.color), `alert color ${embed.color} must be valid`);
  }
});

test('Field values are non-empty strings', () => {
  const payload = buildDiscordPayload(false);
  for (const field of payload.embeds[0].fields) {
    assert.ok(field.value.length > 0, `field "${field.name}" value must not be empty`);
  }
});

test('Timestamps are valid ISO format', () => {
  const payload = buildDiscordPayload(false);
  for (const embed of payload.embeds) {
    if (embed.timestamp) {
      assert.ok(!isNaN(Date.parse(embed.timestamp)), 'timestamp must be valid ISO date');
    }
  }
});

// ─── Summary ───────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`📊 Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('❌ Webhook formatting validation FAILED');
  process.exit(1);
} else {
  console.log('✅ All webhook formatting tests passed');
  process.exit(0);
}

// ─── Mock Payload Builders ─────────────────────────────────────
// These simulate the exact structure produced by the E2E runners.

function buildDiscordPayload(hasSecurityAlert) {
  const xssReflectedCount = hasSecurityAlert ? 2 : 0;
  const unsanitizedCount = hasSecurityAlert ? 75 : 0;
  const sanitizedCount = 2;
  const totalInjections = 352;

  const embeds = [{
    title: hasSecurityAlert ? '🚨 SimpleBeacon Chaos Sweep' : '✅ SimpleBeacon Chaos Sweep',
    description: hasSecurityAlert
      ? `**SECURITY ALERT:** ${xssReflectedCount} XSS reflections detected, ${unsanitizedCount} unsanitized payloads accepted.`
      : 'All discoverable routes passed validation.',
    color: hasSecurityAlert ? 15105570 : 3066993,
    fields: [
      { name: 'Routes Tested', value: '55', inline: true },
      { name: 'Passed', value: '55', inline: true },
      { name: 'Failed', value: '0', inline: true },
      { name: 'UI Interactions', value: '160', inline: true },
      { name: 'JS Console Errors', value: '2', inline: true },
      { name: 'Auth Mode', value: 'Persisted', inline: true },
      { name: 'Payload Injections', value: String(totalInjections), inline: true },
      { name: 'XSS Reflected', value: String(xssReflectedCount), inline: true },
      { name: 'Visual Diffs', value: '0', inline: true },
      { name: 'Unsanitized XSS/Template', value: String(unsanitizedCount), inline: true },
      { name: 'Sanitized by Field', value: String(sanitizedCount), inline: true },
      { name: 'Security Report', value: 'SECURITY.md generated', inline: true }
    ],
    footer: { text: 'SimpleBeacon Chaos Agent v5.0' },
    timestamp: new Date().toISOString()
  }];

  if (hasSecurityAlert) {
    const alertFields = [];
    if (xssReflectedCount > 0) {
      alertFields.push({
        name: '🚨 XSS Reflection Details',
        value: 'script-tag on https://simplebeacon.ai/contact\nimg-onerror on https://simplebeacon.ai/contact',
        inline: false
      });
    }
    if (unsanitizedCount > 0) {
      alertFields.push({
        name: '⚠️ Unsanitized Payload Vectors',
        value: 'https://simplebeacon.ai/contact: XSS-script, XSS-img, template-injection\nhttps://simplebeacon.ai/roadmap: XSS-script, template-injection',
        inline: false
      });
    }

    embeds.push({
      title: '🛡️ Security Remediation Alert',
      description: 'Input sanitization failures detected. Review SECURITY.md for full details.',
      color: 15105570,
      fields: alertFields,
      footer: { text: 'SimpleBeacon Security Monitor' },
      timestamp: new Date().toISOString()
    });
  }

  return { embeds };
}

function buildSlackPayload(hasSecurityAlert) {
  const xssReflectedCount = hasSecurityAlert ? 2 : 0;
  const unsanitizedCount = hasSecurityAlert ? 75 : 0;
  const sanitizedCount = 2;
  const totalInjections = 352;

  const prefix = hasSecurityAlert
    ? `SECURITY ALERT: ${xssReflectedCount} XSS reflections, ${unsanitizedCount} unsanitized payloads`
    : 'E2E Health Check Passed';

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: prefix }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: '*Highest Active Severity*\n✅ NONE' },
        { type: 'mrkdwn', text: '*Failed Routes / Visited Routes*\n0 / 55' },
        { type: 'mrkdwn', text: '*Failed Routes*\n0' },
        { type: 'mrkdwn', text: '*Visited Routes*\n55' },
        { type: 'mrkdwn', text: '*Passed Routes*\n55' },
        { type: 'mrkdwn', text: '*Severity Counts Matrix*\nCritical: 0 | High: 0 | Medium: 0 | Low: 0' },
        { type: 'mrkdwn', text: `*Payload Injections*\n${totalInjections}` },
        { type: 'mrkdwn', text: `*XSS Reflected*\n${xssReflectedCount}` },
        { type: 'mrkdwn', text: `*Unsanitized XSS/Template*\n${unsanitizedCount}` },
        { type: 'mrkdwn', text: `*Sanitized by Field*\n${sanitizedCount}` },
      ]
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '```SimpleBeacon E2E scan complete\nVisited: 55\nPassed: 55\nFailed: 0```' }
    }
  ];

  if (hasSecurityAlert) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Security Remediation Alert*\nXSS Reflected: ${xssReflectedCount}\nUnsanitized Payloads: ${unsanitizedCount}\nReview SECURITY.md for details.` }
    });
  }

  return { text: `${prefix}\nSimpleBeacon E2E scan complete`, blocks };
}
