'use strict';

jest.mock('../../services/cloud-inference-service.cjs', () => ({
  explainCodeWithProvider: jest.fn(),
  providerConfigured: jest.fn().mockReturnValue(false),
}));

const {
  analyzeSemanticLayer,
  classifyPurpose,
  assessAssumptions,
} = require('../code-understanding/semantic-analyzer.cjs');

describe('code-understanding/semantic-analyzer', () => {
  test('exports expected functions', () => {
    expect(typeof analyzeSemanticLayer).toBe('function');
    expect(typeof classifyPurpose).toBe('function');
    expect(typeof assessAssumptions).toBe('function');
  });

  test('classifyPurpose detects test files', () => {
    const result = classifyPurpose(
      'describe("test", () => {});',
      'javascript',
      [],
      'src/file.test.js'
    );
    expect(result.tags).toContain('test');
  });

  test('classifyPurpose detects API files', () => {
    const result = classifyPurpose(
      'app.get("/users", handler);',
      'javascript',
      [],
      'server/routes/api.js'
    );
    expect(result.tags).toContain('api');
  });

  test('classifyPurpose detects zscript actor', () => {
    const result = classifyPurpose('class MyActor : Actor { }', 'zscript', [], 'actors/myactor.zs');
    expect(result.tags).toContain('actor');
  });

  test('classifyPurpose detects zscript weapon', () => {
    const result = classifyPurpose(
      'class MyWeapon : Weapon { }',
      'zscript',
      [],
      'weapons/sword.zs'
    );
    expect(result.tags).toContain('weapon');
  });

  test('classifyPurpose returns object with tags and summary for plain content', () => {
    const result = classifyPurpose('const x = 1;', 'javascript', [], 'src/utils.js');
    expect(typeof result).toBe('object');
    expect(Array.isArray(result.tags)).toBe(true);
    expect(typeof result.summary).toBe('string');
  });

  test('assessAssumptions returns array', () => {
    const result = assessAssumptions('const x = process.env.KEY;', 'javascript');
    expect(Array.isArray(result)).toBe(true);
  });
});
