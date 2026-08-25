"use strict";

/**
 * Agent PDA — Agent Detection
 *
 * Auto-detect which AI agent is calling based on environment variables.
 * Falls back to SIMPLEBEACON_AGENT_NAME or 'unknown-agent'.
 */

const DETECTION_RULES = [
  { type: "cursor", envVar: "CURSOR_TRACE_ID", name: "Cursor" },
  { type: "cursor", envVar: "CURSOR_SESSION_ID", name: "Cursor" },
  { type: "claude", envVar: "CLAUDE_API_KEY", name: "Claude" },
  { type: "claude", envVar: "ANTHROPIC_API_KEY", name: "Claude" },
  { type: "devin", envVar: "DEVIN_SESSION_ID", name: "Devin" },
  { type: "devin", envVar: "DEVIN_API_KEY", name: "Devin" },
  { type: "copilot", envVar: "GITHUB_COPILOT_TOKEN", name: "GitHub Copilot" },
  { type: "copilot", envVar: "COPILOT_INTEGRATION_ID", name: "GitHub Copilot" },
  { type: "cline", envVar: "CLINE_TASK_ID", name: "Cline" },
  { type: "windsurf", envVar: "WINDSURF_SESSION_ID", name: "Windsurf" },
  { type: "aider", envVar: "AIDER_CHAT_SESSION", name: "Aider" },
  { type: "continue", envVar: "CONTINUE_SESSION_ID", name: "Continue" },
];

/**
 * Detect the calling agent from environment variables.
 * @returns {object} { type, name, id } or null if undetectable
 */
function detectAgent() {
  // Check explicit override first
  if (process.env.SIMPLEBEACON_AGENT_NAME) {
    return {
      type: process.env.SIMPLEBEACON_AGENT_TYPE || "custom",
      name: process.env.SIMPLEBEACON_AGENT_NAME,
      id: null,
    };
  }

  for (const rule of DETECTION_RULES) {
    if (process.env[rule.envVar]) {
      return {
        type: rule.type,
        name: rule.name,
        id: process.env[rule.envVar],
      };
    }
  }

  return null;
}

/**
 * Get the agent identity, detecting if needed and falling back to 'unknown-agent'.
 */
function getAgentIdentity() {
  const detected = detectAgent();
  if (detected) return detected;
  return { type: "unknown", name: "unknown-agent", id: null };
}

module.exports = {
  detectAgent,
  getAgentIdentity,
  DETECTION_RULES,
};
