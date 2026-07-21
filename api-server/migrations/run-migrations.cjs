#!/usr/bin/env node
/**
 * SimpleBeacon FixOrchestrator Migration Runner
 *
 * Runs SQL migrations in order against PostgreSQL.
 * Usage:
 *   node api-server/migrations/run-migrations.cjs
 *   DATABASE_URL=postgres://... node api-server/migrations/run-migrations.cjs
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATIONS_DIR = __dirname;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/simplebeacon';

async function run() {
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();

    // Ensure migrations tracking table exists
    await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    `);

    // Read already-applied migrations
    const appliedRes = await client.query('SELECT filename FROM schema_migrations ORDER BY id');
    const applied = new Set(appliedRes.rows.map(r => r.filename));

    // Discover migration files
    const files = (await fs.promises.readdir(MIGRATIONS_DIR))
        .filter(f => f.endsWith('.sql'))
        .sort();

    let ran = 0;
    for (const file of files) {
        if (applied.has(file)) {
            console.log(`  SKIP ${file}`); // simplebeacon-ignore debug-artifact — migration CLI output
            continue;
        }
        const sql = await fs.promises.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
        await client.query(sql);
        await client.query(
            'INSERT INTO schema_migrations (filename) VALUES ($1)',
            [file]
        );
        console.log(`  OK   ${file}`);
        ran++;
    }

    await client.end();
    console.log(`\nMigrations complete. ${ran} applied, ${files.length - ran} already up-to-date.`);
    process.exit(0);
}

run().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
