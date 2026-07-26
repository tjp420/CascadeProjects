"use strict";

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
// Allow simple comma-separated origins via env; default to localhost for dev only
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://127.0.0.1,http://localhost').split(',').map(s => s.trim()).filter(Boolean);
// Semicolon-separated whitelist of allowed directories (resolved). Default is cwd.
const ALLOWED_PATHS = (process.env.ALLOWED_PATHS || process.cwd()).split(';').map(p => path.resolve(p));

app.use(helmet());
app.use(cors({ origin: (origin, cb) => {
  // Allow non-browser callers (e.g., curl) by permitting undefined origin
  if (!origin) return cb(null, true);
  if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
  return cb(new Error('CORS origin not allowed'), false);
} }));
app.use(express.json());

// Rate limit API endpoints (dev-friendly default: 100 req / minute)
app.use('/api/', rateLimit({ windowMs: 60 * 1000, max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10) }));

function isPathAllowed(resolved) {
  return ALLOWED_PATHS.some(allowed => resolved === allowed || resolved.startsWith(allowed + path.sep));
}

function humanMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

app.get('/api/analyze', async (req, res) => {
  // Do NOT accept arbitrary unvalidated paths in production. Use query param only for dev/testing.
  const requested = req.query.path; // optional
  let targetDir = ALLOWED_PATHS[0];
  if (requested) {
    const resolved = path.resolve(requested);
    if (!isPathAllowed(resolved)) {
      return res.status(400).json({ error: 'Path not allowed' });
    }
    targetDir = resolved;
  }
  try {
    const stat = await fs.promises.stat(targetDir).catch(() => null);
    if (!stat || !stat.isDirectory()) return res.status(404).json({ error: 'Directory not found' });
    const names = await fs.promises.readdir(targetDir).catch(() => []);
    const items = await Promise.all(names.map(async name => {
      try {
        const filePath = path.join(targetDir, name);
        const stats = await fs.promises.stat(filePath);
        return {
          name,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          sizeBytes: stats.size,
          sizeMB: humanMB(stats.size),
          lastModified: stats.mtime
        };
      } catch (e) {
        return { name, error: String(e) };
      }
    }));

    // Basic filters: ext, minMB
    let filtered = items;
    if (req.query.ext) {
      const ext = req.query.ext.toLowerCase();
      filtered = filtered.filter(i => i.name && i.name.toLowerCase().endsWith(ext));
    }
    if (req.query.minMB) {
      const min = parseFloat(req.query.minMB) || 0;
      filtered = filtered.filter(i => (i.sizeBytes || 0) / (1024*1024) >= min);
    }

    // Sorting
    const sortBy = (req.query.sort || 'name').toLowerCase();
    const order = (req.query.order || 'asc').toLowerCase();
    filtered.sort((a,b) => {
      let v = 0;
      if (sortBy === 'size') v = (a.sizeBytes||0) - (b.sizeBytes||0);
      else if (sortBy === 'modified') v = new Date(a.lastModified) - new Date(b.lastModified);
      else v = String(a.name || '').localeCompare(String(b.name || ''));
      return order === 'desc' ? -v : v;
    });

    // Pagination
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const perPage = Math.min(1000, Math.max(1, parseInt(req.query.perPage || '200', 10)));
    const start = (page - 1) * perPage;
    const paged = filtered.slice(start, start + perPage);

    res.json({ success: true, path: targetDir, totalItems: filtered.length, page, perPage, data: paged });
  } catch (err) {
    console.debug && console.debug('Analyze error', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.json({ ok: true, message: 'Local Analyzer bridge' }));

if (require.main === module) {
  app.listen(PORT, () => {
    console.debug && console.debug(`⚡ HDD Analyzer bridge running at http://localhost:${PORT}`);
    console.debug && console.debug('Allowed origins:', ALLOWED_ORIGINS);
    console.debug && console.debug('Allowed paths:', ALLOWED_PATHS);
  });
}
