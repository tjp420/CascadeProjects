#!/usr/bin/env node
/**
 * Local PostgreSQL backup — runs only when ENABLE_DATABASE=true.
 * Requires pg_dump on PATH (ships with PostgreSQL client tools).
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getDatabaseConfig } = require('../server/config/database');

const BACKUP_DIR = path.join(__dirname, '..', 'backups', 'postgresql');
const RETENTION_DAYS = 7;

function buildDatabaseUrl() {
    if (process.env.DATABASE_URL) {
        return process.env.DATABASE_URL;
    }
    const cfg = getDatabaseConfig();
    const user = encodeURIComponent(cfg.user);
    const password = encodeURIComponent(cfg.password);
    return `postgresql://${user}:${password}@${cfg.host}:${cfg.port}/${cfg.database}`;
}

function pruneOldBackups() {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const name of fs.readdirSync(BACKUP_DIR)) {
        if (!name.startsWith('cascade_ai_platform_') || !name.endsWith('.sql')) continue;
        const filePath = path.join(BACKUP_DIR, name);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
            fs.unlinkSync(filePath);
            console.log(`Removed old backup: ${name}`);
        }
    }
}

function main() {
    if (process.env.ENABLE_DATABASE !== 'true') {
        console.log('Database not enabled, skipping backup');
        process.exit(0);
    }

    const databaseUrl = buildDatabaseUrl();
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
    const backupFile = path.join(BACKUP_DIR, `cascade_ai_platform_${timestamp}.sql`);

    console.log('Starting database backup...');
    const result = spawnSync('pg_dump', [databaseUrl], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    });

    if (result.error) {
        console.error('Backup failed:', result.error.message);
        console.error('Ensure pg_dump is installed and on PATH.');
        process.exit(1);
    }
    if (result.status !== 0) {
        console.error('pg_dump failed:', result.stderr || result.stdout);
        process.exit(result.status || 1);
    }

    fs.writeFileSync(backupFile, result.stdout, 'utf8');
    pruneOldBackups();
    console.log(`Backup completed: ${backupFile}`);
}

main();
