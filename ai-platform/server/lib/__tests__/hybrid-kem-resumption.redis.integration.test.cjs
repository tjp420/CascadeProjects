const { execSync } = require('child_process');
const net = require('net');
const redis = require('redis');
const {
  generateStek,
  createTicket,
  validateTicketWithRedis,
} = require('../hybrid-kem-resumption.cjs');

const DOCKER_COMPOSE_FILE = `${__dirname.replace(/\\/g, '/')}/../../../../docker-compose.redis.yml`;

function dockerAvailable() {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

async function waitForRedis(host = '127.0.0.1', port = 6379, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((res, rej) => {
        const s = net.createConnection(port, host, () => {
          s.end();
          res();
        });
        s.on('error', rej);
      });
      return;
    } catch (e) {
      await new Promise(r => setTimeout(r, 250));
    }
  }
  throw new Error('Redis did not start in time');
}

describe('hybrid-kem-resumption Redis integration', () => {
  let redisClient;
  const skip = process.env.SKIP_REDIS_INTEGRATION === '1' || !dockerAvailable();

  beforeAll(async function () {
    if (skip) {
      console.warn('Skipping Redis integration tests (docker missing or SKIP_REDIS_INTEGRATION=1)');
      return;
    }

    // Start docker compose
    execSync(`docker compose -f "${DOCKER_COMPOSE_FILE}" up -d`, { stdio: 'inherit' });
    await waitForRedis();

    // Connect Redis client
    redisClient = redis.createClient({ url: 'redis://127.0.0.1:6379' });
    await redisClient.connect();
  }, 60000);

  afterAll(async function () {
    if (skip) return;
    if (redisClient) await redisClient.quit();
    try {
      execSync(`docker compose -f "${DOCKER_COMPOSE_FILE}" down`, { stdio: 'inherit' });
    } catch (e) {
      console.warn('Failed to stop docker compose:', e.message);
    }
  }, 60000);

  test('validateTicketWithRedis accepts valid ticket and detects replay', async function () {
    if (skip) return;
    const prevRoot = Buffer.alloc(32, 0x42);
    const stekObj = generateStek();
    const { ticket } = createTicket({ sessionId: 'sess-redis', nodeId: 'nodeR', prevRoot }, stekObj.stek, stekObj.stekId, 60000);

    // Create a simple stekById accessor
    const stekById = new Map();
    stekById.set(stekObj.stekId.toString('hex'), stekObj.stek);

    const res1 = await validateTicketWithRedis(ticket, stekById, redisClient);
    expect(res1.valid).toBe(true);

    const res2 = await validateTicketWithRedis(ticket, stekById, redisClient);
    expect(res2.valid).toBe(false);
    expect(res2.reason).toBe('REPLAY');
  }, 60000);
});
