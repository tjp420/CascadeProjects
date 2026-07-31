'use strict';

const fs = require('fs');
const path = require('path');

const telemetry = require('../fine-tuning-telemetry-store.cjs');
const { formatRow } = require('../fine-tuning-formatter.cjs');

const TELEMETRY_PATH = path.join(process.cwd(), '.simplebeacon', 'fine-tuning-telemetry.json');
const DATASET_DIR = path.join(process.cwd(), '.simplebeacon', 'telemetry-datasets');

beforeAll(() => {
  try { fs.unlinkSync(TELEMETRY_PATH); } catch {}
  try { fs.rmSync(DATASET_DIR, { recursive: true, force: true }); } catch {}
});

afterAll(() => {
  try { fs.unlinkSync(TELEMETRY_PATH); } catch {}
  try { fs.rmSync(DATASET_DIR, { recursive: true, force: true }); } catch {}
});

afterEach(() => {
  try { fs.unlinkSync(TELEMETRY_PATH); } catch {}
  try { fs.rmSync(DATASET_DIR, { recursive: true, force: true }); } catch {}
});

describe('fine-tuning-telemetry-store', () => {
  test('records a telemetry entry', () => {
    const r = telemetry.recordTelemetry({
      orgId: 'org-a',
      userId: 'u1',
      operation: 'chat',
      model: 'gpt-4',
      input: 'What is the best way to secure an API?',
      output: 'Use TLS, rate limiting, and authentication.',
      metadata: { rating: 4 },
    });
    expect(r.recorded).toBe(true);
    expect(r.merged).toBe(false);
    expect(r.eventId).toMatch(/^ft-/);

    const entries = telemetry.listEntries('org-a');
    expect(entries.length).toBe(1);
    expect(entries[0].score).toBeGreaterThan(0);
    expect(entries[0].input).toContain('secure an API');
  });

  test('scrbs email and token patterns', () => {
    telemetry.recordTelemetry({
      orgId: 'org-a',
      userId: 'u1',
      operation: 'chat',
      input: 'Contact me at dev@example.com and use sk-abc12345678901234567890',
      output: 'That is an email and API token.',
    });
    const entries = telemetry.listEntries('org-a');
    expect(entries[0].input).toContain('[EMAIL]');
    expect(entries[0].input).toContain('[TOKEN]');
    expect(entries[0].input).not.toContain('dev@example.com');
    expect(entries[0].input).not.toContain('sk-abc123');
  });

  test('merges nearby turns into a multi-turn conversation', () => {
    telemetry.recordTelemetry({
      orgId: 'org-a',
      userId: 'u1',
      operation: 'chat',
      input: 'Question one?',
      output: 'Answer one.',
    });
    const r2 = telemetry.recordTelemetry({
      orgId: 'org-a',
      userId: 'u1',
      operation: 'chat',
      input: 'Question two?',
      output: 'Answer two.',
    });
    expect(r2.merged).toBe(true);

    const entries = telemetry.listEntries('org-a');
    expect(entries.length).toBe(1);
    expect(entries[0].turns).toBe(2);
    expect(entries[0].score).toBeGreaterThanOrEqual(entries[0].turns);
  });

  test('filters entries by minTurns and minRating', () => {
    telemetry.recordTelemetry({
      orgId: 'org-a',
      userId: 'u1',
      operation: 'chat',
      input: 'A',
      output: 'B',
      metadata: { rating: 5 },
    });
    telemetry.recordTelemetry({
      orgId: 'org-a',
      userId: 'u2',
      operation: 'chat',
      input: 'C',
      output: 'D',
      metadata: { rating: 1 },
    });

    const all = telemetry.listEntries('org-a');
    const high = telemetry.listEntries('org-a', { minRating: 4 });
    expect(all.length).toBe(2);
    expect(high.length).toBe(1);
    expect(high[0].metadata.rating).toBe(5);
  });

  test('labels an entry and excludes it from collection', () => {
    const r = telemetry.recordTelemetry({
      orgId: 'org-a',
      userId: 'u1',
      operation: 'chat',
      input: 'Ignore this.',
      output: 'Ok.',
    });

    const label = telemetry.labelEntry(r.eventId, 'exclude');
    expect(label.success).toBe(true);

    const entries = telemetry.listEntries('org-a');
    expect(entries.length).toBe(0);
  });

  test('exports a JSONL dataset', () => {
    telemetry.recordTelemetry({
      orgId: 'org-a',
      userId: 'u1',
      operation: 'chat',
      model: 'gpt-4',
      input: 'Hello',
      output: 'Hi! How can I help you?',
      metadata: { rating: 4 },
    });

    const result = telemetry.exportDataset('org-a', 'jsonl', { minRating: 1 });
    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(1);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);

    const written = fs.readFileSync(result.path, 'utf8');
    const row = JSON.parse(written.trim());
    expect(row.messages).toHaveLength(2);
    expect(row.messages[0].role).toBe('user');
    expect(row.messages[1].role).toBe('assistant');
  });

  test('formatter produces alpaca and chatml rows', () => {
    const entry = {
      input: 'What is a closure?',
      output: 'A function that captures its surrounding scope.',
      score: 7,
      turns: 1,
      model: 'gpt-4',
      timestamp: new Date().toISOString(),
    };
    const alpaca = JSON.parse(formatRow(entry, 'alpaca'));
    expect(alpaca).toHaveProperty('instruction');
    expect(alpaca).toHaveProperty('input');
    expect(alpaca).toHaveProperty('output');

    const chatml = JSON.parse(formatRow(entry, 'chatml'));
    expect(chatml.messages).toHaveLength(2);
    expect(chatml.messages[0].role).toBe('user');
  });

  test('lists generated datasets', () => {
    telemetry.recordTelemetry({
      orgId: 'org-b',
      userId: 'u1',
      operation: 'chat',
      input: 'X',
      output: 'Y',
      metadata: { rating: 4 },
    });
    telemetry.exportDataset('org-b', 'alpaca', {});
    const datasets = telemetry.listDatasets('org-b');
    expect(datasets.length).toBe(1);
    expect(datasets[0].filename).toMatch(/\.jsonl$/);
    expect(datasets[0].sizeBytes).toBeGreaterThan(0);
  });
});
