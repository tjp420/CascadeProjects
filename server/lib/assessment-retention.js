/**
 * Assessment retention utilities: purge old assessment directories.
 */

const fs = require('fs');
const path = require('path');

async function purgeExpiredAssessments(root, options = {}) {
  const maxAgeMs = options.maxAgeMs || 24 * 60 * 60 * 1000;
  const now = Date.now();
  const removed = [];

  let entries;
  try {
    entries = await fs.promises.readdir(root, { withFileTypes: true });
  } catch {
    return { removed };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith('assessment_')) continue;

    const dirPath = path.join(root, entry.name);
    const metaPath = path.join(dirPath, 'assessment.json');
    let createdAt;
    try {
      const raw = await fs.promises.readFile(metaPath, 'utf8');
      const parsed = JSON.parse(raw);
      createdAt = parsed.metadata?.createdAt || parsed.createdAt;
    } catch {
      continue;
    }

    const age = now - Date.parse(createdAt);
    if (age >= maxAgeMs) {
      try {
        await fs.promises.rm(dirPath, { recursive: true, force: true });
        removed.push(entry.name);
      } catch {
        // ignore
      }
    }
  }

  return { removed };
}

module.exports = { purgeExpiredAssessments };
