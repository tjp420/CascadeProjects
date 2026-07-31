module.exports = {
  id: 'ENT-SEC-101',
  name: 'Hardcoded Auth Secret',
  severity: 'high',
  impact: 'high',
  likelihood: 'medium',
  category: 'Credentials',
  description: 'Detects hard-coded authorization tokens or secret literals in code.',
  guidance: 'Replace hardcoded secrets with environment-backed secrets (process.env).',
  matcher: {
    type: 'regex',
    // matches common patterns like "Authorization: Bearer <token>" or assignment to apiKey = "..."
    pattern: /Authorization:\s*Bearer\s+[A-Za-z0-9-_=.]+|apiKey\s*=\s*['\"][A-Za-z0-9-_=.]{16,}['\"]/g,
    paths: ['**/*.js','**/*.ts']
  },
  fix: {
    type: 'replace',
    // Replace obvious literal assignment to use environment variable reference
    pattern: /apiKey\s*=\s*(['\"])([A-Za-z0-9-_=.]{16,})\1/g,
    replacement: "apiKey = process.env.SB_SECRET_KEY"
  }
};
