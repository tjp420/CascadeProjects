// Network-related constants (ports, hosts, CORS)

const DEFAULT_PORT = 3000;
const DASHBOARD_PORT = 3002;
const OLLAMA_PORT = 11434;
const AI_PROXY_PORT = 8080;
const POSTGRES_PORT = 5432;
const REDIS_PORT = 6379;
const MONGODB_PORT = 27017;
const SMTP_PORT = 587;
const HTTPS_PORT = 443;
const HTTP_PORT = 80;

const LOCALHOST = '127.0.0.1';
const LOCALHOST_V6 = '::1';

// CORS origins: configurable via env; localhost defaults only in non-production
const envCors = (typeof process !== 'undefined' && process.env && process.env.CORS_ALLOWED_ORIGINS)
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : [];
const DEFAULT_DEV_ORIGINS = (() => {
  const hosts = ['localhost', LOCALHOST];
  const ports = [DEFAULT_PORT, DASHBOARD_PORT];
  return hosts.flatMap((host) => ports.map((port) => `http://${host}:${port}`));
})();

const CORS_ALLOWED_ORIGINS = Object.freeze(
  envCors.length > 0
    ? envCors
    : (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production')
      ? []
      : DEFAULT_DEV_ORIGINS
);

module.exports = Object.freeze({
  DEFAULT_PORT,
  DASHBOARD_PORT,
  OLLAMA_PORT,
  AI_PROXY_PORT,
  POSTGRES_PORT,
  REDIS_PORT,
  MONGODB_PORT,
  SMTP_PORT,
  HTTPS_PORT,
  HTTP_PORT,
  LOCALHOST,
  LOCALHOST_V6,
  CORS_ALLOWED_ORIGINS
});
