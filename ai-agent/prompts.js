// SPDX-License-Identifier: MIT
/**
 * Prompt templates optimized for 2B parameter models.
 * Single-purpose, strictly formatted instructions to prevent drift.
 *
 * @license MIT
 */

/**
 * Prompt 1: Planning (Decomposition)
 * Forces the 2B model to split a user goal into strict JSON actions.
 */
function getPlanningPrompt(userGoal) { // simplebeacon-ignore debug-artifact — core prompt builder for agent orchestration
    return `You are a strict code execution planner.
Decompose the user's goal into a structured JSON array of actions.
Available operations: "read_file", "patch_file", "run_tests".

User Goal: "${userGoal}"

Output ONLY a valid JSON array. Each element must be an object with an "op" field.
Use these exact operation shapes:
- read_file:  { "op": "read_file", "path": "<relative-path-from-repo-root>" }
- patch_file: { "op": "patch_file", "path": "<relative-path-from-repo-root>", "search": "<exact-string>", "replace": "<exact-string>" }
- run_tests:  { "op": "run_tests" }

Derive paths from the User Goal. Do not invent paths. Do not use ".." or absolute paths.
Do not write explanations, markdown blocks, or text outside the JSON array.`;
}

/**
 * Prompt 2: Verification Analysis
 * Asks the 2B model to evaluate if raw terminal logs represent a pass or fail.
 */
function getVerificationPrompt(terminalOutput) { // simplebeacon-ignore debug-artifact — core prompt builder for agent orchestration
    return `Analyze the raw terminal logs below. Determine if the operations or tests succeeded.
Terminal Output:
"""
${terminalOutput}
"""

Output ONLY one word: "SUCCESS" or "FAILURE". Do not write anything else.`;
}

module.exports = {
    getPlanningPrompt,
    getVerificationPrompt
};