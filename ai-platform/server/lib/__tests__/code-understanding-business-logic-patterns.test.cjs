'use strict';

const { DOMAIN_PATTERNS, detectBusinessLogicPatterns, inferDomainHints } = require('../code-understanding/business-logic-patterns.cjs');

describe('code-understanding/business-logic-patterns', () => {
  test('exports expected functions and constants', () => {
    expect(DOMAIN_PATTERNS).toBeDefined();
    expect(typeof detectBusinessLogicPatterns).toBe('function');
    expect(typeof inferDomainHints).toBe('function');
  });

  test('DOMAIN_PATTERNS has expected domains', () => {
    expect(DOMAIN_PATTERNS['web-api']).toBeDefined();
    expect(DOMAIN_PATTERNS.auth).toBeDefined();
    expect(DOMAIN_PATTERNS.billing).toBeDefined();
    expect(DOMAIN_PATTERNS['game-modding']).toBeDefined();
    expect(DOMAIN_PATTERNS.testing).toBeDefined();
  });

  test('detectBusinessLogicPatterns returns object with domains and patterns', () => {
    const content = 'app.get("/api/users", authenticate, (req, res) => {});';
    const result = detectBusinessLogicPatterns(content, { language: 'javascript' });
    expect(typeof result).toBe('object');
    expect(Array.isArray(result.domains)).toBe(true);
    expect(Array.isArray(result.patterns)).toBe(true);
  });

  test('detectBusinessLogicPatterns detects web-api patterns', () => {
    const content = 'router.post("/login", validate(schema), handler);';
    const result = detectBusinessLogicPatterns(content, { language: 'javascript', filePath: 'server/routes/api.js' });
    expect(result.patterns.length).toBeGreaterThan(0);
  });

  test('detectBusinessLogicPatterns detects auth patterns', () => {
    const content = 'const token = jwt.sign(payload, secret);';
    const result = detectBusinessLogicPatterns(content, { language: 'javascript', filePath: 'server/auth/login.js' });
    expect(result.patterns.length).toBeGreaterThan(0);
  });

  test('detectBusinessLogicPatterns detects game-modding patterns', () => {
    const content = 'class MyWeapon : Weapon { States { Fire: ... } }';
    const result = detectBusinessLogicPatterns(content, { language: 'zscript', filePath: 'weapons/sword.zs' });
    expect(result.patterns.length).toBeGreaterThan(0);
  });

  test('inferDomainHints returns array of strings', () => {
    const hints = inferDomainHints('server/routes/api.js', 'javascript');
    expect(Array.isArray(hints)).toBe(true);
  });
});
