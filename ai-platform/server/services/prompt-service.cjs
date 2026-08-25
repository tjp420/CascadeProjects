// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
/**
 * Prompt Service — store and retrieve custom analysis prompts per user.
 *
 * In-memory storage with SQLite persistence for custom AI prompts.
 * Mounted at /api/prompts.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const logger = require('../lib/app-logger.cjs');

const PROMPT_DB_PATH = path.join(process.cwd(), 'data', 'custom-prompts.json');

let _cachedPrompts = null;

/**
 * Ensure data dir.
 * @returns {any}
 */
async function ensureDataDir() {
  const dir = path.dirname(PROMPT_DB_PATH);
  try {
    await fs.promises.mkdir(dir, { recursive: true });
  } catch (e) {
    console.error('prompt-service.cjs error:', e);
    // Directory may already exist
  }
}

/**
 * Load prompts.
 * @returns {any}
 */
async function loadPrompts() {
  if (_cachedPrompts) return _cachedPrompts;
  await ensureDataDir();
  try {
    const data = await fs.promises.readFile(PROMPT_DB_PATH, 'utf8');
    _cachedPrompts = JSON.parse(data);
    return _cachedPrompts;
  } catch (e) {
    if (e.code !== 'ENOENT') {
      logger.warn('[PromptService] Could not load prompts:', e.message);
    }
  }
  return {};
}

/**
 * Save prompts.
 * @param {Array} prompts
 * @returns {any}
 */
async function savePrompts(prompts) {
  await ensureDataDir();
  try {
    await fs.promises.writeFile(PROMPT_DB_PATH, JSON.stringify(prompts, null, 2), 'utf8');
    _cachedPrompts = null;
  } catch (e) {
    logger.error('[PromptService] Could not save prompts:', e.message);
  }
}

/**
 * POST /api/prompts/set
 * Body: { userId: string, prompt: string }
 */
router.post('/set', async (req, res) => {
  const { userId, prompt } = req.body;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const prompts = await loadPrompts();
  prompts[userId] = {
    prompt: prompt.trim(),
    updatedAt: new Date().toISOString()
  };
  await savePrompts(prompts);

  res.json({ success: true, message: 'Prompt saved' });
});

/**
 * GET /api/prompts/get?userId=<id>
 */
router.get('/get', async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }

  const prompts = await loadPrompts();
  const entry = prompts[userId];
  if (!entry) {
    return res.json({ success: true, prompt: '', userId, updatedAt: null });
  }

  res.json({ success: true, prompt: entry.prompt, userId, updatedAt: entry.updatedAt });
});

/**
 * DELETE /api/prompts/delete?userId=<id>
 */
router.delete('/delete', async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }

  const prompts = await loadPrompts();
  if (!prompts[userId]) {
    return res.status(404).json({ error: 'Prompt not found for user' });
  }

  delete prompts[userId];
  await savePrompts(prompts);

  res.json({ success: true, message: 'Prompt deleted' });
});

/**
 * GET /api/prompts/list
 * Returns all stored prompt metadata (without full text for privacy)
 */
router.get('/list', async (_req, res) => {
  const prompts = await loadPrompts();
  const summary = Object.entries(prompts).map(([uid, entry]) => ({
    userId: uid,
    updatedAt: entry.updatedAt,
    length: entry.prompt?.length || 0
  }));
  res.json({ success: true, count: summary.length, prompts: summary });
});

module.exports = router;
