#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const envPath = process.env.DOTENV_CONFIG_PATH
    || path.join(__dirname, '..', '.env.v1-internal');

if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath, override: true });
} else {
    console.warn(`[v1-internal] Missing ${envPath} — copy .env.v1-internal.example first`);
    process.env.REQUIRE_AUTH = process.env.REQUIRE_AUTH || 'true';
}

process.env.SIMPLEBEACON_INTERNAL_DASHBOARD = process.env.SIMPLEBEACON_INTERNAL_DASHBOARD || 'true';
process.env.PORT = '54449';

const { applyLocalV1InternalDevProfile } = require('../server/lib/secret-config.cjs');
applyLocalV1InternalDevProfile();

require('../simplebeacon-server.cjs');
