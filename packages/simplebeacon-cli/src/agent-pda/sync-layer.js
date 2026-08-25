"use strict";

/**
 * Agent PDA — Sync Layer (optional)
 *
 * Syncs local memory/tasks to a backend when SIMPLEBEACON_SYNC_URL is set.
 * Disabled by default. Offline queue stored in .simplebeacon/agent-pda/sync-queue.json.
 *
 * Features:
 * - Auth token via SIMPLEBEACON_SYNC_TOKEN env var
 * - Retry with exponential backoff (max 3 attempts per change)
 * - Batch dedup: changes with the same key+op are collapsed
 * - Batch sending: up to 50 changes per flush request
 * - Workspace ID support: SIMPLEBEACON_SYNC_WORKSPACE_ID
 */

const fs = require("fs");
const path = require("path");
const { atomicWriteFileSync } = require("../lib/atomic-writer");

const MAX_RETRIES = 3;
const BATCH_SIZE = 50;
const INITIAL_BACKOFF_MS = 1000;

function isSyncEnabled() {
  return !!process.env.SIMPLEBEACON_SYNC_URL;
}

function getQueuePath(projectRoot) {
  return path.join(
    projectRoot || process.cwd(),
    ".simplebeacon",
    "agent-pda",
    "sync-queue.json",
  );
}

function loadQueue(projectRoot) {
  try {
    const raw = fs.readFileSync(getQueuePath(projectRoot), "utf8");
    const data = JSON.parse(raw);
    if (!data.pending || !Array.isArray(data.pending))
      return { pending: [], version: 1 };
    return data;
  } catch {
    return { pending: [], version: 1 };
  }
}

function saveQueue(projectRoot, queue) {
  const queuePath = getQueuePath(projectRoot);
  atomicWriteFileSync(queuePath, JSON.stringify(queue, null, 2));
}

/**
 * Generate a dedup key for a change. Changes with the same key+op+type
 * are collapsed into the latest one during flush.
 */
function dedupKey(change) {
  if (change.type === "memory" && change.data) {
    return `memory:${change.data.agentId}:${change.data.key}:${change.data.category}:${change.op}`;
  }
  if (change.type === "task" && change.data) {
    return `task:${change.data.id}:${change.op}`;
  }
  if (change.type === "agent" && change.data) {
    return `agent:${change.data.id}:${change.op}`;
  }
  return null; // No dedup for unknown types
}

/**
 * Queue a change for later sync. Called by memory/task stores when sync is enabled.
 * Deduplicates inline: if a change with the same dedup key is already queued,
 * replace it with the new one (latest wins).
 * @param {string} projectRoot
 * @param {object} change — { type: 'memory'|'task'|'agent', op: 'create'|'update'|'delete', data }
 */
function enqueueChange(projectRoot, change) {
  if (!isSyncEnabled()) return;
  const queue = loadQueue(projectRoot);
  const key = dedupKey(change);

  if (key) {
    // Dedup: remove any existing change with the same key
    queue.pending = queue.pending.filter((c) => c._dedupKey !== key);
  }

  queue.pending.push({
    ...change,
    queuedAt: Date.now(),
    attempts: 0,
    _dedupKey: key,
  });
  saveQueue(projectRoot, queue);
}

/**
 * Sleep for ms milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send a batch of changes to the sync endpoint.
 * @returns {object} { success: boolean, status: number, error?: string }
 */
async function sendBatch(syncUrl, authToken, workspaceId, batch) {
  const headers = { "Content-Type": "application/json" };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const body = {
    changes: batch,
    workspaceId: workspaceId || undefined,
  };

  try {
    const resp = await fetch(syncUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (resp.ok) {
      return { success: true, status: resp.status };
    }
    const text = await resp.text().catch(() => "");
    return {
      success: false,
      status: resp.status,
      error: `HTTP ${resp.status}: ${text.substring(0, 200)}`,
    };
  } catch (err) {
    return { success: false, status: 0, error: err.message };
  }
}

/**
 * Flush the sync queue to the backend. Called periodically or on demand.
 * Implements retry with exponential backoff and batch dedup.
 * @param {string} projectRoot
 * @returns {object} { flushed, errors, retried, pending }
 */
async function flushQueue(projectRoot) {
  if (!isSyncEnabled())
    return { flushed: 0, errors: [], retried: 0, pending: 0 };

  const queue = loadQueue(projectRoot);
  if (queue.pending.length === 0)
    return { flushed: 0, errors: [], retried: 0, pending: 0 };

  const syncUrl = process.env.SIMPLEBEACON_SYNC_URL;
  const authToken = process.env.SIMPLEBEACON_SYNC_TOKEN || null;
  const workspaceId = process.env.SIMPLEBEACON_SYNC_WORKSPACE_ID || null;

  const errors = [];
  let flushed = 0;
  let retried = 0;

  // Take a batch (up to BATCH_SIZE), sorted by queuedAt
  const batch = queue.pending
    .sort((a, b) => a.queuedAt - b.queuedAt)
    .slice(0, BATCH_SIZE);
  const remaining = queue.pending.slice(BATCH_SIZE);

  // Send the batch
  const result = await sendBatch(syncUrl, authToken, workspaceId, batch);

  if (result.success) {
    flushed = batch.length;
  } else {
    // Batch failed — retry individual changes with backoff
    for (const change of batch) {
      change.attempts = (change.attempts || 0) + 1;

      if (change.attempts >= MAX_RETRIES) {
        // Max retries exceeded — drop and log error
        errors.push({
          change: { type: change.type, op: change.op, data: change.data },
          error: `Max retries (${MAX_RETRIES}) exceeded: ${result.error}`,
        });
        continue;
      }

      // Retry with exponential backoff
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, change.attempts - 1);
      await sleep(backoff);

      const singleResult = await sendBatch(syncUrl, authToken, workspaceId, [
        change,
      ]);
      if (singleResult.success) {
        flushed++;
        retried++;
      } else {
        errors.push({
          change: { type: change.type, op: change.op, data: change.data },
          error: singleResult.error,
        });
        // Re-queue for next flush
        remaining.push(change);
      }
    }
  }

  // Update queue: remove flushed changes, keep remaining + retried failures
  queue.pending = remaining;
  saveQueue(projectRoot, queue);

  return { flushed, errors, retried, pending: queue.pending.length };
}

/**
 * Get sync status.
 */
function getSyncStatus(projectRoot) {
  const queue = loadQueue(projectRoot);
  return {
    enabled: isSyncEnabled(),
    syncUrl: isSyncEnabled() ? process.env.SIMPLEBEACON_SYNC_URL : null,
    hasAuthToken: !!process.env.SIMPLEBEACON_SYNC_TOKEN,
    workspaceId: process.env.SIMPLEBEACON_SYNC_WORKSPACE_ID || null,
    pendingCount: queue.pending.length,
    maxRetries: MAX_RETRIES,
    batchSize: BATCH_SIZE,
  };
}

module.exports = {
  isSyncEnabled,
  enqueueChange,
  flushQueue,
  getSyncStatus,
  _loadQueue: loadQueue,
  _saveQueue: saveQueue,
  _dedupKey: dedupKey,
};
