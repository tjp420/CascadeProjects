'use strict';

/**
 * AI Guardrails & Prompt Firewall — Detection Engine
 *
 * Analyzes prompt text for:
 *   1. Prompt injection attempts (jailbreaks, role-play overrides, instruction ignore)
 *   2. PII leakage (SSN, email, phone, credit card, API keys)
 *   3. Harmful content requests (violence, weapons, drugs, self-harm)
 *   4. Filter bypass / safety override attempts
 *
 * Returns a verdict: allow, scrub, or block — with matched rules and scrubbed text.
 */

// ── Injection patterns ──────────────────────────────────────────────────────

const INJECTION_PATTERNS = [
  {
    id: 'ignore-instructions',
    pattern: /ignore\s+(all\s+)?(previous|prior|above|system)\s+instructions/i,
    severity: 'high',
    desc: 'Attempt to override system instructions',
  },
  {
    id: 'forget-rules',
    pattern: /forget\s+(all\s+)?(your|the)\s+(rules|instructions|guidelines)/i,
    severity: 'high',
    desc: 'Attempt to make model forget its rules',
  },
  {
    id: 'new-identity',
    pattern: /you\s+are\s+now\s+(dan|do\s+anything|evil|unrestricted|jailbroken|free)/i,
    severity: 'high',
    desc: 'Role-play identity override attempt',
  },
  {
    id: 'act-as',
    pattern:
      /act\s+as\s+(if\s+you\s+(have\s+no|are\s+without|don't\s+have)\s+(rules|restrictions|filters|guidelines))/i,
    severity: 'high',
    desc: 'Act-as filter bypass attempt',
  },
  {
    id: 'system-prompt-extraction',
    pattern: /(show|reveal|print|output|display|repeat)\s+(me\s+)?(your|the)\s+(system\s+)?prompt/i,
    severity: 'medium',
    desc: 'System prompt extraction attempt',
  },
  {
    id: 'filter-removal',
    pattern: /(disable|remove|turn\s+off|bypass)\s+(all\s+)?(safety|content|filter|restriction)/i,
    severity: 'high',
    desc: 'Safety filter removal attempt',
  },
  {
    id: 'override-safety',
    pattern: /override\s+(your|the)\s+(safety|content|ethical)\s+(filter|guideline|rule|policy)/i,
    severity: 'high',
    desc: 'Safety override attempt',
  },
  {
    id: 'pretend-mode',
    pattern: /pretend\s+(you\s+(are|can)|to\s+be\s+(a|an)\s+(unrestricted|unfiltered|unlimited))/i,
    severity: 'medium',
    desc: 'Pretend mode bypass attempt',
  },
  {
    id: 'developer-mode',
    pattern: /(developer|debug|admin|root|god)\s+mode\s+(enabled|activated|on)/i,
    severity: 'medium',
    desc: 'Developer mode activation attempt',
  },
  {
    id: 'base64-injection',
    pattern: /decode\s+(the\s+)?following\s+(base64|b64|encoded)/i,
    severity: 'low',
    desc: 'Base64 encoded instruction smuggling',
  },
];

// ── PII patterns ────────────────────────────────────────────────────────────

const PII_PATTERNS = [
  {
    id: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    severity: 'high',
    desc: 'Social Security Number',
    replacement: '[REDACTED-SSN]',
  },
  {
    id: 'credit-card',
    pattern: /\b(?:\d[ -]*?){13,16}\b/g,
    severity: 'high',
    desc: 'Credit card number',
    replacement: '[REDACTED-CC]',
  },
  {
    id: 'email',
    pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    severity: 'medium',
    desc: 'Email address',
    replacement: '[REDACTED-EMAIL]',
  },
  {
    id: 'phone',
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    severity: 'medium',
    desc: 'Phone number',
    replacement: '[REDACTED-PHONE]',
  },
  {
    id: 'api-key',
    pattern: /\b(?:sk|pk|rk)-[a-zA-Z0-9]{20,}\b/g,
    severity: 'high',
    desc: 'API key (OpenAI/Stripe style)',
    replacement: '[REDACTED-KEY]',
  },
  {
    id: 'aws-key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    severity: 'high',
    desc: 'AWS access key ID',
    replacement: '[REDACTED-AWS-KEY]',
  },
  {
    id: 'ip-address',
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    severity: 'low',
    desc: 'IP address',
    replacement: '[REDACTED-IP]',
  },
];

// ── Harmful content patterns ────────────────────────────────────────────────

const HARMFUL_PATTERNS = [
  {
    id: 'weapon-manufacturing',
    pattern:
      /(how\s+to\s+(make|build|create))\s+(a\s+)?(bomb|weapon|gun|firearm|explosive|grenade|mine)/i,
    severity: 'block',
    desc: 'Weapon manufacturing instructions',
  },
  {
    id: 'drug-synthesis',
    pattern:
      /(how\s+to\s+)?(synthesiz|mak|creat|produc)e?\s+(illegal|controlled)?\s*(drug|meth|cocaine|heroin|fentanyl|lsd|mdma)/i,
    severity: 'block',
    desc: 'Illegal drug synthesis',
  },
  {
    id: 'self-harm',
    pattern: /(how\s+to\s+)?(kill|hurt|cut|hang|overdose)\s+(myself|yourself|oneself)/i,
    severity: 'block',
    desc: 'Self-harm instructions',
  },
  {
    id: 'malware-creation',
    pattern:
      /(how\s+to\s+)?(creat|writ|build|mak)e?\s+(a\s+)?(virus|malware|ransomware|trojan|worm|keylogger|rootkit)/i,
    severity: 'block',
    desc: 'Malware creation instructions',
  },
  {
    id: 'hacking-instructions',
    pattern:
      /(how\s+to\s+)?(hack|exploit|penetrate|breach|crack)\s+(into\s+)?(a\s+)?(website|server|database|system|account|network|bank)/i,
    severity: 'high',
    desc: 'Hacking instructions',
  },
  {
    id: 'phishing-template',
    pattern:
      /(creat|writ|generat|mak)e?\s+(a\s+)?(phishing|scam)\s+(email|message|page|template|site)/i,
    severity: 'high',
    desc: 'Phishing template creation',
  },
  {
    id: 'social-engineering',
    pattern:
      /(how\s+to\s+)?(manipulat|trick|deceiv|fool|social\s+engineer)\s+(people|users|someone|victims)/i,
    severity: 'medium',
    desc: 'Social engineering instructions',
  },
  {
    id: 'doxxing',
    pattern:
      /(find|get|lookup|search\s+for)\s+(someone's|a\s+person's)\s+(home\s+address|real\s+name|phone\s+number|location)/i,
    severity: 'high',
    desc: 'Doxxing instructions',
  },
];

// ── Filter bypass patterns ──────────────────────────────────────────────────

const BYPASS_PATTERNS = [
  {
    id: 'no-restrictions',
    pattern:
      /no\s+restrictions|no\s+restrictions\s+apply|without\s+any\s+(restriction|limitation|filter)/i,
    severity: 'high',
    desc: 'No-restrictions bypass attempt',
  },
  {
    id: 'uncensored-mode',
    pattern: /uncensored|unfiltered|unrestricted\s+(mode|mode|ai|model|response)/i,
    severity: 'high',
    desc: 'Uncensored mode request',
  },
  {
    id: 'jailbreak',
    pattern:
      /jailbreak|jail\s+break|break\s+(out\s+of|free\s+from)\s+(your|the)\s+(cage|prison|restriction|filter)/i,
    severity: 'high',
    desc: 'Jailbreak attempt',
  },
  {
    id: 'dan-prompt',
    pattern: /do\s+anything\s+now|dan\s+prompt|dan\s+mode/i,
    severity: 'high',
    desc: 'DAN jailbreak prompt',
  },
];

// ── Main detection function ─────────────────────────────────────────────────

/**
 * Analyze prompt text for guardrail violations.
 * @param {string} text - The prompt text to analyze
 * @param {object} [options] - Configuration options
 * @param {boolean} [options.scrubPII=true] - Whether to scrub PII from text
 * @param {boolean} [options.blockInjection=true] - Whether to block injection attempts
 * @param {boolean} [options.blockHarmful=true] - Whether to block harmful content
 * @param {boolean} [options.blockBypass=true] - Whether to block filter bypass attempts
 * @returns {{ verdict: 'allow'|'scrub'|'block', text: string, matches: array, summary: string }}
 */
function analyzePrompt(text, options = {}) {
  const {
    scrubPII = true,
    blockInjection = true,
    blockHarmful = true,
    blockBypass = true,
  } = options;

  const matches = [];
  let scrubbedText = text;
  let shouldBlock = false;

  // Check injection patterns
  if (blockInjection) {
    for (const rule of INJECTION_PATTERNS) {
      if (rule.pattern.test(text)) {
        matches.push({ type: 'injection', id: rule.id, severity: rule.severity, desc: rule.desc });
        if (rule.severity === 'high') shouldBlock = true;
      }
    }
  }

  // Check bypass patterns
  if (blockBypass) {
    for (const rule of BYPASS_PATTERNS) {
      if (rule.pattern.test(text)) {
        matches.push({ type: 'bypass', id: rule.id, severity: rule.severity, desc: rule.desc });
        if (rule.severity === 'high') shouldBlock = true;
      }
    }
  }

  // Check harmful content patterns
  if (blockHarmful) {
    for (const rule of HARMFUL_PATTERNS) {
      if (rule.pattern.test(text)) {
        matches.push({ type: 'harmful', id: rule.id, severity: rule.severity, desc: rule.desc });
        if (rule.severity === 'block') shouldBlock = true;
      }
    }
  }

  // Check and scrub PII patterns
  if (scrubPII) {
    for (const rule of PII_PATTERNS) {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      const found = regex.test(text);
      if (found) {
        matches.push({ type: 'pii', id: rule.id, severity: rule.severity, desc: rule.desc });
        scrubbedText = scrubbedText.replace(rule.pattern, rule.replacement);
      }
    }

    // Apply custom PII redaction patterns from the policy store
    if (options.customPiiPatterns && Array.isArray(options.customPiiPatterns)) {
      for (const rule of options.customPiiPatterns) {
        try {
          const regex = new RegExp(rule.regex.source, rule.regex.flags);
          if (regex.test(scrubbedText)) {
            matches.push({
              type: 'custom_pii',
              id: rule.id,
              name: rule.name,
              severity: rule.severity,
              desc: rule.description || rule.name,
            });
            scrubbedText = scrubbedText.replace(new RegExp(rule.regex.source, rule.regex.flags), rule.replacement);
          }
        } catch {}
      }
    }
  }

  // Determine verdict
  let verdict = 'allow';
  let summary = 'No guardrail violations detected';

  if (shouldBlock) {
    verdict = 'block';
    const blockReasons = matches
      .filter((m) => m.severity === 'block' || m.severity === 'high')
      .map((m) => m.desc);
    summary = `Request blocked: ${blockReasons.join('; ')}`;
  } else if (matches.some((m) => m.type === 'pii' || m.type === 'custom_pii')) {
    verdict = 'scrub';
    summary = `PII scrubbed: ${matches
      .filter((m) => m.type === 'pii' || m.type === 'custom_pii')
      .map((m) => m.desc)
      .join(', ')}`;
  } else if (matches.length > 0) {
    verdict = 'allow';
    summary = `Allowed with warnings: ${matches.map((m) => m.desc).join('; ')}`;
  }

  return { verdict, text: scrubbedText, matches, summary };
}

// ── Quick check (for middleware use) ────────────────────────────────────────

/**
 * Quick boolean check if text should be blocked.
 * @param {string} text
 * @returns {boolean}
 */
function shouldBlockPrompt(text) {
  if (!text || typeof text !== 'string') return false;
  for (const rule of INJECTION_PATTERNS) {
    if (rule.severity === 'high' && rule.pattern.test(text)) return true;
  }
  for (const rule of BYPASS_PATTERNS) {
    if (rule.severity === 'high' && rule.pattern.test(text)) return true;
  }
  for (const rule of HARMFUL_PATTERNS) {
    if (rule.severity === 'block' && rule.pattern.test(text)) return true;
  }
  return false;
}

module.exports = {
  analyzePrompt,
  shouldBlockPrompt,
  INJECTION_PATTERNS,
  PII_PATTERNS,
  HARMFUL_PATTERNS,
  BYPASS_PATTERNS,
};
