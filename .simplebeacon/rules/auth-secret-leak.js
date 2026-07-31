/**
 * Custom Rule: ENT-SEC-101 — Hardcoded Authorization Secret in LLM Config
 *
 * High-velocity regex rule that flags hardcoded authorization secrets left
 * inside model instantiation configurations (OpenAI, Anthropic, Bedrock, etc.).
 * Catches string literals assigned to apiKey/authToken/secretKey/bearerToken
 * that are NOT process.env references.
 *
 * Remediation: Replaces the hardcoded value with process.env.SB_SECRET_KEY.
 */

module.exports = {
  id: 'ENT-SEC-101',
  name: 'Hardcoded Auth Secret',
  severity: 'high',
  impact: 'high',
  likelihood: 'high',
  category: 'Credentials',
  description:
    'Hardcoded authorization secret detected in LLM model instantiation. ' +
    'Secrets must be injected via environment variables, never committed to source.',
  guidance:
    'Replace hardcoded secrets with process.env.SB_SECRET_KEY. ' +
    'Ensure SB_SECRET_KEY is set in your environment and never committed to version control.',
  tags: ['security', 'secrets', 'llm', 'owasp-llm-top10', 'credential-exposure'],

  matcher: {
    type: 'regex',
    pattern: /(?:apiKey|api_key|authToken|auth_token|secretKey|secret_key|bearerToken|bearer_token|authorization)\s*[:=]\s*["'][^"']{8,}["']/g,
    fileGlobs: ['**/*.js', '**/*.cjs', '**/*.mjs', '**/*.ts', '**/*.tsx', '**/*.jsx', '**/*.py'],
    ignorePatterns: [
      /process\.env\./,
      /require\(/,
      /import\(/,
      /from\s+['"]/,
      /simplebeacon-ignore/,
    ],
  },

  fix: {
    type: 'string-replace',
    description:
      'Replace the hardcoded secret literal with a process.env.SB_SECRET_KEY reference. ' +
      'Add SB_SECRET_KEY to your .env file and ensure .env is in .gitignore.',
    find: /((?:apiKey|api_key|authToken|auth_token|secretKey|secret_key|bearerToken|bearer_token|authorization)\s*[:=]\s*)(["'])([^"']{8,})\2/g,
    replace: '$1process.env.SB_SECRET_KEY',
    language: 'js',
  },

  examples: [
    {
      bad: "const openai = new OpenAI({ apiKey: 'sk-proj-abc123def456ghi789' });",
      good: "const openai = new OpenAI({ apiKey: process.env.SB_SECRET_KEY });",
    },
    {
      bad: "const client = new Anthropic({ apiKey: 'sk-ant-api03-xyz789abc456' });",
      good: "const client = new Anthropic({ apiKey: process.env.SB_SECRET_KEY });",
    },
    {
      bad: "const config = { secretKey: 'my-hardcoded-secret-value' };",
      good: "const config = { secretKey: process.env.SB_SECRET_KEY };",
    },
    {
      bad: "headers: { Authorization: 'Bearer dGhpcyBpcyBhIHRva2Vu' }",
      good: "headers: { Authorization: `Bearer ${process.env.SB_SECRET_KEY}` }",
    },
  ],
};
