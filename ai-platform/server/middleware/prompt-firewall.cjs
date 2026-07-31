'use strict';

/**
 * Prompt Firewall Middleware — Express middleware that intercepts
 * LLM-bound requests, runs the guardrail detection engine, and
 * blocks/scrubs/allows based on the verdict.
 *
 * Usage:
 *   const { promptFirewall } = require('../middleware/prompt-firewall.cjs');
 *   app.post('/api/chatbot/message', promptFirewall(), handler);
 *
 * Or apply globally to all routes that send prompts to LLMs:
 *   app.use('/api/chatbot', promptFirewall());
 */

const { analyzePrompt } = require('../lib/prompt-firewall.cjs');
const incidentStore = require('../lib/guardrail-incident-store.cjs');

/**
 * Extract prompt text from common request body shapes.
 * @param {object} body
 * @returns {{ text: string, provider: string }|null}
 */
function extractPrompt(body) {
  if (!body) return null;

  // Chatbot message shape
  if (body.message && typeof body.message === 'string') {
    return { text: body.message, provider: body.provider || '' };
  }

  // Model eval run shape (inline tests)
  if (Array.isArray(body.tests)) {
    const combined = body.tests.map(t => t.prompt || '').join('\n---\n');
    return { text: combined, provider: body.provider || '' };
  }

  // Generic prompt field
  if (body.prompt && typeof body.prompt === 'string') {
    return { text: body.prompt, provider: body.provider || '' };
  }

  // Messages array (OpenAI-style)
  if (Array.isArray(body.messages)) {
    const userMessages = body.messages.filter(m => m.role === 'user').map(m => m.content || '');
    if (userMessages.length > 0) {
      return { text: userMessages.join('\n'), provider: body.provider || '' };
    }
  }

  return null;
}

/**
 * Express middleware factory.
 * @param {object} [options]
 * @param {boolean} [options.scrubPII=true]
 * @param {boolean} [options.blockInjection=true]
 * @param {boolean} [options.blockHarmful=true]
 * @param {boolean} [options.blockBypass=true]
 * @param {boolean} [options.logIncidents=true]
 * @returns {function} Express middleware
 */
function promptFirewall(options = {}) {
  const config = {
    scrubPII: options.scrubPII !== false,
    blockInjection: options.blockInjection !== false,
    blockHarmful: options.blockHarmful !== false,
    blockBypass: options.blockBypass !== false,
    logIncidents: options.logIncidents !== false,
  };

  return function promptFirewallMiddleware(req, res, next) {
    const extracted = extractPrompt(req.body);
    if (!extracted || !extracted.text) return next();

    const result = analyzePrompt(extracted.text, config);
    const orgId = req.user?.id || req.user?.email || 'default';

    // Log incident if there are any matches
    if (config.logIncidents && result.matches.length > 0) {
      try {
        incidentStore.recordIncident({
          orgId,
          actorId: req.user?.id || 'unknown',
          actorEmail: req.user?.email || 'unknown',
          verdict: result.verdict,
          endpoint: req.originalUrl || '',
          provider: extracted.provider || '',
          matches: result.matches,
          summary: result.summary,
          originalText: extracted.text,
          scrubbedText: result.text,
        });
      } catch { /* silent — don't block request on logging failure */ }
    }

    if (result.verdict === 'block') {
      return res.status(403).json({
        success: false,
        error: 'guardrail_blocked',
        message: result.summary,
        matches: result.matches.map(m => ({ type: m.type, id: m.id, severity: m.severity, desc: m.desc })),
      });
    }

    // If scrubbed, modify the request body in-place
    if (result.verdict === 'scrub' && result.text !== extracted.text) {
      if (req.body.message) req.body.message = result.text;
      if (req.body.prompt) req.body.prompt = result.text;
      if (Array.isArray(req.body.messages)) {
        let scrubbedIdx = 0;
        for (const msg of req.body.messages) {
          if (msg.role === 'user') {
            // Re-apply scrubbing per-message to maintain structure
            const perMsg = analyzePrompt(msg.content || '', config);
            if (perMsg.text !== msg.content) {
              msg.content = perMsg.text;
            }
            scrubbedIdx++;
          }
        }
      }
      if (Array.isArray(req.body.tests)) {
        for (const test of req.body.tests) {
          if (test.prompt) {
            const perTest = analyzePrompt(test.prompt, config);
            if (perTest.text !== test.prompt) {
              test.prompt = perTest.text;
            }
          }
        }
      }
    }

    // Attach warning info for downstream handlers
    if (result.matches.length > 0) {
      req.guardrailWarnings = result.matches;
    }

    next();
  };
}

module.exports = { promptFirewall, extractPrompt };
