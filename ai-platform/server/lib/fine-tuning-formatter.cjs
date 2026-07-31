'use strict';

/**
 * Fine-tuning dataset formatters.
 *
 * Converts telemetry entries into common small-model training schemas:
 *   - jsonl  : default { messages: [...] }
 *   - alpaca : { instruction, input, output }
 *   - chatml : { messages: [{ role, content }] }
 *
 * @module fine-tuning-formatter
 */

/**
 * Format a telemetry entry into the requested training schema.
 * @param {object} entry
 * @param {string} format - 'jsonl' | 'alpaca' | 'chatml'
 * @returns {string} JSON stringified row
 */
function formatRow(entry, format) {
  if (format === 'alpaca') {
    return JSON.stringify({
      instruction: 'Respond to the following user message.',
      input: entry.input,
      output: entry.output,
    });
  }
  if (format === 'chatml') {
    return JSON.stringify({
      messages: [
        { role: 'user', content: entry.input },
        { role: 'assistant', content: entry.output },
      ],
    });
  }
  // default jsonl
  return JSON.stringify({
    messages: [
      { role: 'user', content: entry.input },
      { role: 'assistant', content: entry.output },
    ],
    score: entry.score,
    turns: entry.turns,
    model: entry.model,
    timestamp: entry.timestamp,
  });
}

module.exports = { formatRow };
