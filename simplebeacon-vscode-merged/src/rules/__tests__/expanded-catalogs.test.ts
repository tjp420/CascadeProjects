/**
 * Tests for the expanded rule catalogs (security, OWASP LLM, EU AI Act).
 * Verifies that:
 *   1. All catalog JSON files parse correctly
 *   2. Every rule has valid regex patterns that compile
 *   3. Key patterns match expected test strings (positive cases)
 *   4. Context exclusions work (test files, simplebeacon-ignore comments)
 *   5. The total pattern count increased from 7 (original) to 35+ (expanded)
 *
 * simplebeacon-ignore security — test fixtures contain known example patterns
 * (e.g. AKIAIOSFODNN7EXAMPLE from AWS public docs) that are not real credentials
 */

import * as fs from 'fs';
import * as path from 'path';

interface CatalogRule {
  id: string;
  regexSource: string;
  regexFlags: string;
  severity: 'error' | 'warning' | 'info';
  confidence: number;
  description: string;
  type: string;
  message: string;
  suggestion: string;
  contextExclusions?: { ext?: string[]; linePrefixes?: string[] };
}

function loadCatalog(name: string): CatalogRule[] {
  const filePath = path.join(__dirname, '..', `${name}.json`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

describe('Expanded rule catalogs', () => {
  describe('Catalog file integrity', () => {
    test('security-patterns.json exists and parses', () => {
      const catalog = loadCatalog('security-patterns');
      expect(catalog.length).toBeGreaterThan(0);
      expect(catalog.length).toBeGreaterThanOrEqual(15);
    });

    test('owasp-llm-patterns.json exists and parses', () => {
      const catalog = loadCatalog('owasp-llm-patterns');
      expect(catalog.length).toBeGreaterThan(0);
      expect(catalog.length).toBeGreaterThanOrEqual(6);
    });

    test('compliance-patterns.json exists and parses', () => {
      const catalog = loadCatalog('compliance-patterns');
      expect(catalog.length).toBeGreaterThan(0);
      expect(catalog.length).toBeGreaterThanOrEqual(7);
    });

    test('llm-slop-catalog.json still exists and has 7 rules', () => {
      const catalog = loadCatalog('llm-slop-catalog');
      expect(catalog.length).toBe(7);
    });
  });

  describe('Rule schema validation', () => {
    const allCatalogs = [
      { name: 'security-patterns', rules: loadCatalog('security-patterns') },
      { name: 'owasp-llm-patterns', rules: loadCatalog('owasp-llm-patterns') },
      { name: 'compliance-patterns', rules: loadCatalog('compliance-patterns') },
    ];

    for (const { name, rules } of allCatalogs) {
      test(`${name}: every rule has required fields`, () => {
        for (const rule of rules) {
          expect(rule.id).toBeTruthy();
          expect(rule.regexSource).toBeTruthy();
          expect(rule.regexFlags).toBeTruthy();
          expect(['error', 'warning', 'info', 'high', 'medium', 'low']).toContain(rule.severity);
          expect(rule.confidence).toBeGreaterThan(0);
          expect(rule.confidence).toBeLessThanOrEqual(1);
          expect(rule.type).toBeTruthy();
          expect(rule.message).toBeTruthy();
          expect(rule.suggestion).toBeTruthy();
        }
      });

      test(`${name}: every regex compiles without error`, () => {
        for (const rule of rules) {
          expect(() => new RegExp(rule.regexSource, rule.regexFlags)).not.toThrow();
        }
      });

      test(`${name}: every rule has a unique ID`, () => {
        const ids = rules.map((r) => r.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
      });
    }
  });

  describe('Security pattern matching (positive cases)', () => {
    const catalog = loadCatalog('security-patterns');

    function findRule(id: string): CatalogRule {
      const rule = catalog.find((r) => r.id === id);
      if (!rule) throw new Error(`Rule ${id} not found`);
      return rule;
    }

    function testMatch(ruleId: string, testString: string, shouldMatch = true) {
      const rule = findRule(ruleId);
      const regex = new RegExp(rule.regexSource, rule.regexFlags);
      if (shouldMatch) {
        expect(regex.test(testString)).toBe(true);
      } else {
        expect(regex.test(testString)).toBe(false);
      }
    }

    test('SB-SEC-007a detects hardcoded passwords', () => {
      testMatch('SB-SEC-007a', 'const password = "mySecret123"');
      testMatch('SB-SEC-007a', 'password: "hunter2"');
    });

    test('SB-SEC-007b detects hardcoded API keys', () => {
      testMatch('SB-SEC-007b', 'const api_key = "sk-abcdefghijklmnopqrstuvwxyz"');
      testMatch('SB-SEC-007b', 'apiKey = "AKIA1234567890ABCD"');
    });

    test('SB-SEC-007e detects AWS key IDs', () => {
      testMatch('SB-SEC-007e', 'AWS_KEY=AKIAIOSFODNN7EXAMPLE');
      testMatch('SB-SEC-007e', 'ASIAJEXAMPLEKEY12345');
    });

    test('SB-SEC-007f detects connection strings', () => {
      testMatch('SB-SEC-007f', 'mongodb://user:pass@host:27017/db');
      testMatch('SB-SEC-007f', 'postgres://admin:secret@db.internal:5432/prod');
    });

    test('SB-SEC-010b detects credential logging', () => {
      testMatch('SB-SEC-010b', 'console.log("password:", password)');
      testMatch('SB-SEC-010b', 'logger.info("token: " + token)');
    });

    test('SB-SEC-010c detects SSN logging', () => {
      testMatch('SB-SEC-010c', 'console.log("SSN:", user.ssn)');
    });

    test('SB-SEC-010d detects credit card logging', () => {
      testMatch('SB-SEC-010d', 'console.log("CVV:", payment.cvv)');
    });

    test('SB-SEC-006a detects weak hash algorithms', () => {
      testMatch('SB-SEC-006a', "createHash('md5')");
      testMatch('SB-SEC-006a', 'crypto.createHash("sha1")');
    });

    test('SB-SEC-006b detects Math.random for security', () => {
      testMatch('SB-SEC-006b', 'const token = Math.random()');
      testMatch('SB-SEC-006b', 'Math.floor(Math.random() * 1000000)');
    });

    test('SB-PERF-001a detects sync file I/O', () => {
      testMatch('SB-PERF-001a', 'const data = fs.readFileSync("/etc/passwd")');
      testMatch('SB-PERF-001a', 'fs.writeFileSync(path, content)');
    });

    test('SB-PERF-002a detects event listeners', () => {
      testMatch('SB-PERF-002a', "element.addEventListener('click', handler)");
    });

    test('SB-PERF-002b detects setInterval', () => {
      testMatch('SB-PERF-002b', 'setInterval(() => poll(), 1000)');
    });
  });

  describe('OWASP LLM pattern matching (positive cases)', () => {
    const catalog = loadCatalog('owasp-llm-patterns');

    function findRule(id: string): CatalogRule {
      const rule = catalog.find((r) => r.id === id);
      if (!rule) throw new Error(`Rule ${id} not found`);
      return rule;
    }

    function testMatch(ruleId: string, testString: string) {
      const rule = findRule(ruleId);
      const regex = new RegExp(rule.regexSource, rule.regexFlags);
      expect(regex.test(testString)).toBe(true);
    }

    test('OWASP-LLM01-001 detects prompt injection', () => {
      testMatch('OWASP-LLM01-001', 'prompt += req.body.userInput');
      testMatch('OWASP-LLM01-001', 'messages.push(req.query.input)');
    });

    test('OWASP-LLM02-001 detects sensitive data to LLM', () => {
      testMatch('OWASP-LLM02-001', 'openai.chat.completions.create({ messages: [{ content: email }])');
    });

    test('OWASP-LLM05-001 detects unsafe LLM output rendering', () => {
      testMatch('OWASP-LLM05-001', 'innerHTML = aiResponse');
      testMatch('OWASP-LLM05-001', 'document.write(llmOutput)');
    });

    test('OWASP-LLM06-001 detects excessive agency', () => {
      testMatch('OWASP-LLM06-001', 'exec(aiCommand)');
      testMatch('OWASP-LLM06-001', 'db.query(llmResult)');
    });

    test('OWASP-LLM07-001 detects system prompt secrets', () => {
      testMatch('OWASP-LLM07-001', "role: 'system', content: 'Your api_key is sk-live-xxx'");
    });

    test('OWASP-LLM10-001 detects unbounded consumption', () => {
      testMatch('OWASP-LLM10-001', 'max_tokens: 999999');
      testMatch('OWASP-LLM10-001', 'maxTokens: Infinity');
    });
  });

  describe('EU AI Act pattern matching (positive cases)', () => {
    const catalog = loadCatalog('compliance-patterns');

    function findRule(id: string): CatalogRule {
      const rule = catalog.find((r) => r.id === id);
      if (!rule) throw new Error(`Rule ${id} not found`);
      return rule;
    }

    function testMatch(ruleId: string, testString: string) {
      const rule = findRule(ruleId);
      const regex = new RegExp(rule.regexSource, rule.regexFlags);
      expect(regex.test(testString)).toBe(true);
    }

    test('EUAI-HR-001 detects employment AI', () => {
      testMatch('EUAI-HR-001', 'resume screening AI model');
      testMatch('EUAI-HR-001', 'candidate scoring algorithm');
    });

    test('EUAI-HR-002 detects credit scoring AI', () => {
      testMatch('EUAI-HR-002', 'credit score model');
      testMatch('EUAI-HR-002', 'loan approval AI');
    });

    test('EUAI-HR-003 detects biometric AI', () => {
      testMatch('EUAI-HR-003', 'facial recognition system');
      testMatch('EUAI-HR-003', 'biometric identification');
    });

    test('EUAI-HO-002 detects missing human oversight', () => {
      testMatch('EUAI-HO-002', 'fully automated decision');
      testMatch('EUAI-HO-002', 'no human review required');
    });
  });

  describe('Context exclusions work correctly', () => {
    const securityCatalog = loadCatalog('security-patterns');

    test('rules have contextExclusions defined', () => {
      const withExclusions = securityCatalog.filter((r) => r.contextExclusions);
      expect(withExclusions.length).toBeGreaterThan(0);
      for (const rule of withExclusions) {
        expect(rule.contextExclusions?.ext).toBeDefined();
        expect(Array.isArray(rule.contextExclusions?.ext)).toBe(true);
      }
    });

    test('test file extensions are excluded', () => {
      const rule = securityCatalog.find((r) => r.id === 'SB-SEC-007a');
      expect(rule?.contextExclusions?.ext).toContain('.test.js');
      expect(rule?.contextExclusions?.ext).toContain('.spec.ts');
    });

    test('simplebeacon-ignore line prefix is excluded', () => {
      const rule = securityCatalog.find((r) => r.id === 'SB-SEC-007a');
      expect(rule?.contextExclusions?.linePrefixes).toContain('// simplebeacon-ignore');
    });
  });

  describe('Total pattern count increased', () => {
    test('combined catalogs have 35+ patterns (was 7)', () => {
      const slop = loadCatalog('llm-slop-catalog');
      const security = loadCatalog('security-patterns');
      const owasp = loadCatalog('owasp-llm-patterns');
      const compliance = loadCatalog('compliance-patterns');
      const total = slop.length + security.length + owasp.length + compliance.length;
      expect(total).toBeGreaterThanOrEqual(35);
    });
  });
});
