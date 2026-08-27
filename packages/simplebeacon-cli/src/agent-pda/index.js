"use strict";

/**
 * Agent PDA — Barrel Export
 *
 * Single entry point for the Agent PDA engine.
 * All stores and engines are accessible from here.
 */

const memoryStore = require("./memory-store");
const taskStore = require("./task-store");
const policyEngine = require("./policy-engine");
const gateBridge = require("./gate-bridge");
const agentRegistry = require("./agent-registry");
const agentDetect = require("./agent-detect");
const syncLayer = require("./sync-layer");
const crossProjectLearner = require("./cross-project-learner");
const tokenSavingsTracker = require("./token-savings-tracker");

module.exports = {
  // Memory
  remember: memoryStore.remember,
  recall: memoryStore.recall,
  recallLatest: memoryStore.recallLatest,
  forget: memoryStore.forget,
  listMemoriesByCategory: memoryStore.listByCategory,
  purgeExpired: memoryStore.purgeExpired,
  exportMemoriesMarkdown: memoryStore.exportMarkdown,
  importMemoriesMarkdown: memoryStore.importMarkdown,

  // Tasks
  createTask: taskStore.createTask,
  updateTask: taskStore.updateTask,
  completeTask: taskStore.completeTask,
  blockTask: taskStore.blockTask,
  approveTask: taskStore.approveTask,
  cancelTask: taskStore.cancelTask,
  listTasks: taskStore.listTasks,
  getTask: taskStore.getTask,
  getChildTasks: taskStore.getChildTasks,
  getPendingApprovals: taskStore.getPendingApprovals,

  // Policies
  loadPolicies: policyEngine.loadPolicies,
  savePolicies: policyEngine.savePolicies,
  checkAction: policyEngine.checkAction,
  listPolicies: policyEngine.listPolicies,
  addPolicy: policyEngine.addPolicy,
  removePolicy: policyEngine.removePolicy,
  togglePolicy: policyEngine.togglePolicy,
  initPolicies: policyEngine.initPolicies,

  // Gate
  runGate: gateBridge.runGate,
  getGateStatus: gateBridge.getGateStatus,
  canFinalize: gateBridge.canFinalize,

  // Agents
  registerAgent: agentRegistry.registerAgent,
  autoRegister: agentRegistry.autoRegister,
  listAgents: agentRegistry.listAgents,
  getAgent: agentRegistry.getAgent,
  touchAgent: agentRegistry.touchAgent,
  removeAgent: agentRegistry.removeAgent,

  // Detection
  detectAgent: agentDetect.detectAgent,
  getAgentIdentity: agentDetect.getAgentIdentity,

  // Sync
  isSyncEnabled: syncLayer.isSyncEnabled,
  flushSyncQueue: syncLayer.flushQueue,
  getSyncStatus: syncLayer.getSyncStatus,

  // Cross-Project Learning
  collectProjectData: crossProjectLearner.collectProjectData,
  extractPatterns: crossProjectLearner.extractPatterns,
  generateLearningReport: crossProjectLearner.generateReport,

  // Token Savings
  recordTokenSavings: tokenSavingsTracker.recordSavings,
  getTokenSavings: tokenSavingsTracker.getSavings,
  getTokenSavingsBrief: tokenSavingsTracker.getSavingsBrief,
  estimateTokens: tokenSavingsTracker.estimateTokens,

  // Sub-modules (for advanced use)
  memoryStore,
  taskStore,
  policyEngine,
  gateBridge,
  agentRegistry,
  agentDetect,
  syncLayer,
  crossProjectLearner,
  tokenSavingsTracker,
};
