/**
 * Root dashboard launcher — delegates to the canonical ai-platform server.
 *
 * Backward compatible entry for:
 *   node gguf-dashboard-server.js          (from repo root)
 *   node ai-platform/gguf-dashboard-server.js
 *
 * Keeps a single bootstrap path so auth, stub APIs, and GGUF routes do not drift.
 */

const path = require('path');

const platformDir = path.join(__dirname, 'ai-platform');

process.chdir(platformDir);

require(path.join(platformDir, 'gguf-dashboard-server.js'));
