// Simple connectivity check to Postgres and Redis for integration smoke tests
const { Client } = require('pg');
const IORedis = require('ioredis');

async function checkPostgres() {
  const cfg = {
    host: process.env.PGHOST || 'postgres',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'integration',
    password: process.env.PGPASSWORD || 'integration_pass',
    database: process.env.PGDATABASE || 'nexus_dev'
  };
  const client = new Client(cfg);
  try {
    await client.connect();
    const res = await client.query('SELECT 1 AS ok');
    console.log('Postgres OK:', res.rows[0]);
    await client.end();
    return true;
  } catch (err) {
    console.error('Postgres check failed:', err.message);
    try { await client.end(); } catch {}
    return false;
  }
}

async function checkRedis() {
  const host = process.env.REDIS_HOST || 'redis';
  const port = Number(process.env.REDIS_PORT || 6379);
  const redis = new IORedis(port, host);
  try {
    const pong = await redis.ping();
    console.log('Redis OK:', pong);
    await redis.quit();
    return true;
  } catch (err) {
    console.error('Redis check failed:', err.message);
    try { await redis.quit(); } catch {}
    return false;
  }
}

(async () => {
  console.log('Starting service checks...');
  const pgOk = await checkPostgres();
  const redisOk = await checkRedis();
  if (pgOk && redisOk) {
    console.log('All services OK');
    process.exit(0);
  }
  console.error('One or more services failed');
  process.exit(2);
})();
