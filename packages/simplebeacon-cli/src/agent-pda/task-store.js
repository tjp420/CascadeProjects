"use strict";

/**
 * Agent PDA — Task Store
 *
 * Local-first JSON-backed task store for AI agents.
 * Each workspace gets .simplebeacon/agent-pda/tasks.json
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { atomicWriteFileSync } = require("../lib/atomic-writer");

const VALID_STATUSES = [
  "pending",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
];
const VALID_PRIORITIES = ["low", "medium", "high", "critical"];

const _DEFAULT_DATA = { tasks: [], version: 1 };

function getDbPath(projectRoot) {
  return path.join(
    projectRoot || process.cwd(),
    ".simplebeacon",
    "agent-pda",
    "tasks.json",
  );
}

function load(dbPath) {
  try {
    const raw = fs.readFileSync(dbPath, "utf8");
    const data = JSON.parse(raw);
    if (!data.tasks || !Array.isArray(data.tasks))
      return { tasks: [], version: 1 };
    return data;
  } catch {
    return { tasks: [], version: 1 };
  }
}

function save(dbPath, data) {
  atomicWriteFileSync(dbPath, JSON.stringify(data, null, 2));
}

function genId() {
  return "task_" + crypto.randomBytes(6).toString("hex");
}

function validateStatus(status) {
  if (status && !VALID_STATUSES.includes(status)) {
    throw new Error(
      `Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(", ")}`,
    );
  }
}

function validatePriority(priority) {
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    throw new Error(
      `Invalid priority: ${priority}. Must be one of: ${VALID_PRIORITIES.join(", ")}`,
    );
  }
}

/**
 * Create a task for an agent.
 * @param {string} projectRoot
 * @param {string} agentId
 * @param {string} title
 * @param {object} opts — { description, priority, parentId, approvalRequired }
 * @returns {object} the created task
 */
function createTask(projectRoot, agentId, title, opts = {}) {
  const dbPath = getDbPath(projectRoot);
  const data = load(dbPath);
  validatePriority(opts.priority);

  const now = Date.now();
  const task = {
    id: genId(),
    agentId,
    title,
    description: opts.description || "",
    status: "pending",
    priority: opts.priority || "medium",
    parentId: opts.parentId || null,
    approvalRequired: !!opts.approvalRequired,
    approvedBy: null,
    approvedAt: null,
    blockReason: null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    timeSpentMs: 0,
  };

  data.tasks.push(task);
  save(dbPath, data);
  return task;
}

/**
 * Update a task.
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {object} patch — { title, description, status, priority, blockReason }
 * @returns {object|null} updated task
 */
function updateTask(projectRoot, taskId, patch = {}) {
  const dbPath = getDbPath(projectRoot);
  const data = load(dbPath);

  if (patch.status) validateStatus(patch.status);
  if (patch.priority) validatePriority(patch.priority);

  const idx = data.tasks.findIndex((t) => t.id === taskId);
  if (idx < 0) return null;

  const task = data.tasks[idx];
  const now = Date.now();

  if (patch.title !== undefined) task.title = patch.title;
  if (patch.description !== undefined) task.description = patch.description;
  if (patch.status !== undefined) {
    // Time tracking: accumulate time when leaving in_progress
    if (task.status === "in_progress" && patch.status !== "in_progress") {
      if (task.startedAt) {
        task.timeSpentMs = (task.timeSpentMs || 0) + (now - task.startedAt);
      }
      task.startedAt = null;
    }
    // Time tracking: start timer when entering in_progress
    if (patch.status === "in_progress" && task.status !== "in_progress") {
      task.startedAt = now;
    }
    task.status = patch.status;
    if (patch.status === "completed") {
      // Accumulate any remaining in_progress time
      if (task.startedAt) {
        task.timeSpentMs = (task.timeSpentMs || 0) + (now - task.startedAt);
        task.startedAt = null;
      }
      task.completedAt = now;
    }
  }
  if (patch.priority !== undefined) task.priority = patch.priority;
  if (patch.blockReason !== undefined) task.blockReason = patch.blockReason;
  task.updatedAt = now;

  data.tasks[idx] = task;
  save(dbPath, data);
  return task;
}

/**
 * Mark a task complete.
 * Enforces task dependencies: a task with an uncompleted parent cannot be completed.
 * @returns {object} the updated task, or { error: 'parent_incomplete', parentTask } if blocked
 */
function completeTask(projectRoot, taskId) {
  const task = getTask(projectRoot, taskId);
  if (!task) return null;

  // Enforce dependency: parent must be completed first
  if (task.parentId) {
    const parent = getTask(projectRoot, task.parentId);
    if (parent && parent.status !== "completed") {
      return {
        error: "parent_incomplete",
        message: `Cannot complete task "${task.title}" — parent task "${parent.title}" (id: ${parent.id}) is not completed (status: ${parent.status}).`,
        parentTask: parent,
      };
    }
  }

  return updateTask(projectRoot, taskId, { status: "completed" });
}

/**
 * Mark a task as blocked.
 */
function blockTask(projectRoot, taskId, reason) {
  return updateTask(projectRoot, taskId, {
    status: "blocked",
    blockReason: reason,
  });
}

/**
 * Approve a task (human approval).
 */
function approveTask(projectRoot, taskId, approvedBy) {
  const dbPath = getDbPath(projectRoot);
  const data = load(dbPath);
  const idx = data.tasks.findIndex((t) => t.id === taskId);
  if (idx < 0) return null;

  const task = data.tasks[idx];
  task.approvedBy = approvedBy || "human";
  task.approvedAt = Date.now();
  task.updatedAt = task.approvedAt;
  data.tasks[idx] = task;
  save(dbPath, data);
  return task;
}

/**
 * List tasks for an agent.
 * @param {string} projectRoot
 * @param {string} agentId — optional, filter by agent
 * @param {string} status — optional, filter by status
 * @returns {array}
 */
function listTasks(projectRoot, agentId, status) {
  const dbPath = getDbPath(projectRoot);
  const data = load(dbPath);
  return data.tasks
    .filter((t) => {
      if (agentId && t.agentId !== agentId) return false;
      if (status && t.status !== status) return false;
      return true;
    })
    .sort((a, b) => {
      // Sort: in_progress first, then by priority, then by createdAt
      const statusOrder = {
        in_progress: 0,
        blocked: 1,
        pending: 2,
        completed: 3,
        cancelled: 4,
      };
      const sa = statusOrder[a.status] ?? 5;
      const sb = statusOrder[b.status] ?? 5;
      if (sa !== sb) return sa - sb;
      const pa = VALID_PRIORITIES.indexOf(a.priority);
      const pb = VALID_PRIORITIES.indexOf(b.priority);
      if (pa !== pb) return pb - pa;
      return a.createdAt - b.createdAt;
    });
}

/**
 * Get a single task by ID.
 */
function getTask(projectRoot, taskId) {
  const dbPath = getDbPath(projectRoot);
  const data = load(dbPath);
  return data.tasks.find((t) => t.id === taskId) || null;
}

/**
 * Get all child tasks of a parent task.
 * @param {string} projectRoot
 * @param {string} parentId
 * @returns {array} child tasks
 */
function getChildTasks(projectRoot, parentId) {
  const dbPath = getDbPath(projectRoot);
  const data = load(dbPath);
  return data.tasks.filter((t) => t.parentId === parentId);
}

/**
 * Get tasks awaiting human approval.
 */
function getPendingApprovals(projectRoot) {
  const dbPath = getDbPath(projectRoot);
  const data = load(dbPath);
  return data.tasks.filter(
    (t) => t.approvalRequired && !t.approvedBy && t.status !== "cancelled",
  );
}

/**
 * Cancel a task.
 */
function cancelTask(projectRoot, taskId) {
  return updateTask(projectRoot, taskId, { status: "cancelled" });
}

module.exports = {
  createTask,
  updateTask,
  completeTask,
  blockTask,
  approveTask,
  cancelTask,
  listTasks,
  getTask,
  getChildTasks,
  getPendingApprovals,
  VALID_STATUSES,
  VALID_PRIORITIES,
  _getDbPath: getDbPath,
  _load: load,
  _save: save,
};
