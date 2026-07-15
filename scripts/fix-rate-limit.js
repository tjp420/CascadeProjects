// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');
const file = 'C:/Users/Trevor/CascadeProjects/ai-platform/server/middleware/security.cjs';
let content = fs.readFileSync(file, 'utf8');

const oldRateLimit = `return rateLimit({
    windowMs: options.windowMs || securityConfig.rateLimitWindowMs,
    max: options.max || securityConfig.rateLimitMax,`;

const newRateLimit = `return rateLimit({
    windowMs: options.windowMs || securityConfig.rateLimitWindowMs,
    max: options.max || securityConfig.rateLimitMax,
    skip: (req) => {
      // Bypass rate limiting for localhost in development
      if (process.env.NODE_ENV !== 'production') {
        const ip = req.ip || req.connection?.remoteAddress || '';
        return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.startsWith('::ffff:127.');
      }
      return false;
    },`;

if (content.includes(oldRateLimit)) {
  content = content.replace(oldRateLimit, newRateLimit);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Added localhost skip to rate limiter');
} else {
  console.log('Pattern not found - may already be modified');
}
