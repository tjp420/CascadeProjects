'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

describe('token-registry schema', () => {
  it('validates token-registry.json against schema', () => {
    const schemaPath = path.join(__dirname, '..', '../db/token-registry.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    const dbPath = process.env.SIMPLEBEACON_TOKEN_DB_PATH || path.join(__dirname, '..', '../db/token-registry.json');
    if (!fs.existsSync(dbPath)) {
      // If no DB present, skip (smoke tests create a temporary DB)
      return;
    }

    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const ok = validate(data);
    if (!ok) {
      console.error('Schema validation errors:', validate.errors);
    }
    assert.ok(ok, 'token-registry.json must conform to token-registry.schema.json');
  });
});
