/**
 * Unit tests for server/config/constants.cjs and its sub-modules.
 * Run with: node --test __tests__/constants.test.cjs
 */

const assert = require('assert');
const { describe, it } = require('node:test');

const constants = require('../constants.cjs');

describe('Facade loads', () => {
  it('exports many properties', () => {
    assert.ok(Object.keys(constants).length > 100, 'facade should have 100+ exports');
  });

  it('has all sub-module categories', () => {
    assert.ok(constants.EXTENSIONS, 'file-types');
    assert.ok(constants.HTTP_STATUS, 'http');
    assert.ok(constants.TRUST_LEVELS, 'trust');
    assert.ok(constants.AI_TIMEOUTS, 'ai');
    assert.ok(constants.LANGUAGE_MAP, 'language');
    assert.strictEqual(typeof constants.parseSize, 'function', 'format');
    assert.strictEqual(typeof constants.env, 'function', 'env');
    assert.strictEqual(typeof constants.clamp, 'function', 'encoding');
    assert.strictEqual(typeof constants.isBlank, 'function', 'strings');
    assert.strictEqual(typeof constants.countBy, 'function', 'arrays');
    assert.strictEqual(typeof constants.mapValues, 'function', 'objects');
    assert.strictEqual(typeof constants.isNil, 'function', 'type-guards');
    assert.strictEqual(typeof constants.isDotFile, 'function', 'paths');
  });

  it('has legacy aliases', () => {
    assert.ok(Array.isArray(constants.CODE_EXTENSIONS));
    assert.ok(Array.isArray(constants.CONFIG_EXTENSIONS));
  });
});

describe('file-types', () => {
  it('EXTENSIONS has expected categories', () => {
    assert.ok(constants.EXTENSIONS.CODE.includes('.js'));
    assert.ok(constants.EXTENSIONS.IMAGE.includes('.png'));
    assert.ok(constants.EXTENSIONS.BINARY.includes('.zip'));
  });

  it('hasExtension works', () => {
    assert.strictEqual(constants.hasExtension('file.js'), true);
    assert.strictEqual(constants.hasExtension('file.js', 'CODE'), true);
    assert.strictEqual(constants.hasExtension('file.js', 'IMAGE'), false);
    assert.strictEqual(constants.hasExtension('noext'), false);
  });

  it('getExtensionCategory categorizes', () => {
    assert.strictEqual(constants.getExtensionCategory('test.js'), 'CODE');
    assert.strictEqual(constants.getExtensionCategory('photo.png'), 'IMAGE');
    assert.strictEqual(constants.getExtensionCategory('Makefile'), undefined);
  });

  it('isTextFile / isCodeFile / isImageFile', () => {
    assert.strictEqual(constants.isTextFile('main.js'), true);
    assert.strictEqual(constants.isCodeFile('main.js'), true);
    assert.strictEqual(constants.isImageFile('photo.png'), true);
    assert.strictEqual(constants.isImageFile('main.js'), false);
  });

  it('getAllExtensions returns flat sorted array', () => {
    const all = constants.getAllExtensions();
    assert.ok(Array.isArray(all));
    assert.ok(all.length > 50);
    assert.ok(all.includes('.js'));
  });

  it('groupFilesByCategory groups paths', () => {
    const groups = constants.groupFilesByCategory(['a.js', 'b.png', 'c.md']);
    assert.ok(groups.CODE.includes('a.js'));
    assert.ok(groups.IMAGE.includes('b.png'));
    assert.ok(groups.DOCUMENT.includes('c.md'));
  });

  it('isLockFile detects lockfiles', () => {
    assert.strictEqual(constants.isLockFile('yarn.lock'), true);
    assert.strictEqual(constants.isLockFile('main.js'), false);
  });

  it('isPackageFile detects manifests', () => {
    assert.strictEqual(constants.isPackageFile('package.json'), true);
    assert.strictEqual(constants.isPackageFile('readme.md'), false);
  });

  it('isMinifiedFile detects minified', () => {
    assert.strictEqual(constants.isMinifiedFile('app.min.js'), true);
    assert.strictEqual(constants.isMinifiedFile('app.js'), false);
  });

  it('isSourceMapFile detects .map', () => {
    assert.strictEqual(constants.isSourceMapFile('bundle.js.map'), true);
    assert.strictEqual(constants.isSourceMapFile('bundle.js'), false);
  });
});

describe('http', () => {
  it('HTTP_STATUS has common codes', () => {
    assert.strictEqual(constants.HTTP_STATUS.OK, 200);
    assert.strictEqual(constants.HTTP_STATUS.NOT_FOUND, 404);
    assert.strictEqual(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR, 500);
  });

  it('isSuccessCode detects 2xx', () => {
    assert.strictEqual(constants.isSuccessCode(200), true);
    assert.strictEqual(constants.isSuccessCode(404), false);
    assert.strictEqual(constants.isSuccessCode('204'), true);
  });

  it('isClientErrorCode detects 4xx', () => {
    assert.strictEqual(constants.isClientErrorCode(400), true);
    assert.strictEqual(constants.isClientErrorCode(500), false);
  });

  it('isServerErrorCode detects 5xx', () => {
    assert.strictEqual(constants.isServerErrorCode(500), true);
    assert.strictEqual(constants.isServerErrorCode(400), false);
  });

  it('isErrorCode detects 4xx+5xx', () => {
    assert.strictEqual(constants.isErrorCode(404), true);
    assert.strictEqual(constants.isErrorCode(500), true);
    assert.strictEqual(constants.isErrorCode(200), false);
  });
});

describe('trust', () => {
  it('TRUST_LEVELS is ordered', () => {
    assert.deepStrictEqual(constants.TRUST_LEVELS, ['bronze', 'silver', 'gold']);
  });

  it('getUploadLimitForTrust returns limits', () => {
    assert.strictEqual(constants.getUploadLimitForTrust('gold'), 100);
    assert.strictEqual(constants.getUploadLimitForTrust('unknown'), 10); // fallback to bronze
  });

  it('isValidTrustLevel validates', () => {
    assert.strictEqual(constants.isValidTrustLevel('silver'), true);
    assert.strictEqual(constants.isValidTrustLevel('platinum'), false);
  });
});

describe('language', () => {
  it('getLanguageName maps extensions', () => {
    assert.strictEqual(constants.getLanguageName('.js'), 'JavaScript');
    assert.strictEqual(constants.getLanguageName('.ts'), 'TypeScript');
    assert.strictEqual(constants.getLanguageName('.unknown'), 'Unknown');
  });
});

describe('format', () => {
  it('parseSize parses human sizes', () => {
    assert.strictEqual(constants.parseSize('1KB'), 1024);
    assert.strictEqual(constants.parseSize('2MB'), 2097152);
  });

  it('formatSize round-trips', () => {
    assert.strictEqual(constants.formatSize(1024), '1.0 KB');
    assert.strictEqual(constants.formatSize(0), '0.0 B');
  });

  it('parseDuration parses durations', () => {
    assert.strictEqual(constants.parseDuration('1s'), 1000);
    assert.strictEqual(constants.parseDuration('1m'), 60000);
    assert.strictEqual(constants.parseDuration('1h'), 3600000);
  });

  it('formatDuration formats ms', () => {
    assert.strictEqual(constants.formatDuration(500), '500ms');
    assert.ok(constants.formatDuration(61000).includes('m'));
  });

  it('parseRate parses rate strings', () => {
    const r = constants.parseRate('100/m');
    assert.strictEqual(r.count, 100);
    assert.strictEqual(r.windowMs, 60000);
  });

  it('formatRate formats back', () => {
    assert.strictEqual(constants.formatRate(100, 60000), '100/m');
    assert.strictEqual(constants.formatRate(10, 1000), '10/s');
  });

  it('checkRateLimit calculates correctly', () => {
    const now = Date.now();
    const result = constants.checkRateLimit(5, 60000, [now - 1000, now - 2000]);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.remaining, 3);
  });

  it('safeJsonLimit normalizes', () => {
    assert.strictEqual(constants.safeJsonLimit('10mb'), '10mb');
    assert.strictEqual(constants.safeJsonLimit('bad'), '10mb');
  });
});

describe('env', () => {
  it('env reads process.env', () => {
    process.env.TEST_FOO = 'bar';
    assert.strictEqual(constants.env('TEST_FOO'), 'bar');
    assert.strictEqual(constants.env('TEST_FOO_MISSING', 'fallback'), 'fallback');
    delete process.env.TEST_FOO;
  });

  it('envInt parses integers', () => {
    process.env.TEST_NUM = '42';
    assert.strictEqual(constants.envInt('TEST_NUM'), 42);
    assert.strictEqual(constants.envInt('TEST_NUM_MISSING', 7), 7);
    delete process.env.TEST_NUM;
  });

  it('envBool parses booleans', () => {
    process.env.TEST_BOOL = 'yes';
    assert.strictEqual(constants.envBool('TEST_BOOL'), true);
    assert.strictEqual(constants.envBool('TEST_BOOL_MISSING', false), false);
    delete process.env.TEST_BOOL;
  });

  it('parseBoolean handles inputs', () => {
    assert.strictEqual(constants.parseBoolean('true'), true);
    assert.strictEqual(constants.parseBoolean('false'), false);
    assert.strictEqual(constants.parseBoolean('maybe'), undefined);
    assert.strictEqual(constants.parseBoolean(true), true);
    assert.strictEqual(constants.parseBoolean(1), true);
  });
});

describe('platform', () => {
  it('platform detection returns booleans', () => {
    assert.strictEqual(typeof constants.isWindows(), 'boolean');
    assert.strictEqual(typeof constants.isMacOS(), 'boolean');
    assert.strictEqual(typeof constants.isLinux(), 'boolean');
    assert.strictEqual(typeof constants.isCI(), 'boolean');
    assert.strictEqual(typeof constants.isServer(), 'boolean');
  });
});

describe('encoding', () => {
  it('clamp constrains values', () => {
    assert.strictEqual(constants.clamp(5, 0, 10), 5);
    assert.strictEqual(constants.clamp(-1, 0, 10), 0);
    assert.strictEqual(constants.clamp(15, 0, 10), 10);
  });

  it('getEncodingForExt suggests encoding', () => {
    assert.strictEqual(constants.getEncodingForExt('.txt'), 'utf8');
    assert.strictEqual(constants.getEncodingForExt('.bin'), 'binary');
  });
});

describe('strings', () => {
  it('isBlank detects emptiness', () => {
    assert.strictEqual(constants.isBlank(null), true);
    assert.strictEqual(constants.isBlank(''), true);
    assert.strictEqual(constants.isBlank('  '), true);
    assert.strictEqual(constants.isBlank('a'), false);
  });

  it('safeParseInt parses safely', () => {
    assert.strictEqual(constants.safeParseInt('42'), 42);
    assert.strictEqual(constants.safeParseInt('abc', 0), 0);
  });

  it('safeParseFloat parses safely', () => {
    assert.strictEqual(constants.safeParseFloat('3.14'), 3.14);
    assert.strictEqual(constants.safeParseFloat('abc', 0), 0);
  });

  it('capitalize capitalizes', () => {
    assert.strictEqual(constants.capitalize('hello'), 'Hello');
    assert.strictEqual(constants.capitalize(''), '');
  });

  it('pluralize pluralizes', () => {
    assert.strictEqual(constants.pluralize(1, 'item'), '1 item');
    assert.strictEqual(constants.pluralize(2, 'item'), '2 items');
  });

  it('truncate truncates', () => {
    assert.strictEqual(constants.truncate('hello world', 8), 'hello w…');
    assert.strictEqual(constants.truncate('hi', 8), 'hi');
  });

  it('ensureArray ensures array', () => {
    assert.deepStrictEqual(constants.ensureArray(1), [1]);
    assert.deepStrictEqual(constants.ensureArray([1, 2]), [1, 2]);
    assert.deepStrictEqual(constants.ensureArray(null), []);
  });

  it('isEmpty detects emptiness', () => {
    assert.strictEqual(constants.isEmpty(null), true);
    assert.strictEqual(constants.isEmpty([]), true);
    assert.strictEqual(constants.isEmpty({}), true);
    assert.strictEqual(constants.isEmpty({ a: 1 }), false);
  });
});

describe('arrays', () => {
  it('countBy counts', () => {
    const result = constants.countBy([1, 2, 2, 3], (x) => x % 2 === 0 ? 'even' : 'odd');
    assert.strictEqual(result.even, 2);
    assert.strictEqual(result.odd, 2);
  });

  it('maxBy finds max', () => {
    assert.strictEqual(constants.maxBy([{ v: 1 }, { v: 3 }, { v: 2 }], (x) => x.v).v, 3);
  });

  it('minBy finds min', () => {
    assert.strictEqual(constants.minBy([{ v: 1 }, { v: 3 }, { v: 2 }], (x) => x.v).v, 1);
  });

  it('findIndex finds index', () => {
    assert.strictEqual(constants.findIndex([1, 2, 3], (x) => x === 2), 1);
    assert.strictEqual(constants.findIndex([1, 2, 3], (x) => x === 5), -1);
  });

  it('sum adds numbers', () => {
    assert.strictEqual(constants.sum([1, 2, 3]), 6);
    assert.strictEqual(constants.sum([{ v: 1 }, { v: 2 }], (x) => x.v), 3);
  });

  it('mean calculates average', () => {
    assert.strictEqual(constants.mean([2, 4, 6]), 4);
  });
});

describe('objects', () => {
  it('defaultsDeep deep-assigns defaults', () => {
    const obj = { a: { b: 1 } };
    constants.defaultsDeep(obj, { a: { c: 2 }, d: 3 });
    assert.deepStrictEqual(obj, { a: { b: 1, c: 2 }, d: 3 });
  });

  it('mapValues maps values', () => {
    assert.deepStrictEqual(constants.mapValues({ a: 1, b: 2 }, (v) => v * 2), { a: 2, b: 4 });
  });

  it('mapKeys maps keys', () => {
    assert.deepStrictEqual(constants.mapKeys({ a: 1 }, (k) => k.toUpperCase()), { A: 1 });
  });

  it('invert inverts keys/values', () => {
    assert.deepStrictEqual(constants.invert({ a: '1', b: '2' }), { '1': 'a', '2': 'b' });
  });
});

describe('type-guards', () => {
  it('isNil detects null/undefined', () => {
    assert.strictEqual(constants.isNil(null), true);
    assert.strictEqual(constants.isNil(undefined), true);
    assert.strictEqual(constants.isNil(0), false);
  });

  it('isNull detects only null', () => {
    assert.strictEqual(constants.isNull(null), true);
    assert.strictEqual(constants.isNull(undefined), false);
  });

  it('isSymbol detects symbols', () => {
    assert.strictEqual(constants.isSymbol(Symbol('a')), true);
    assert.strictEqual(constants.isSymbol('a'), false);
  });

  it('isMap / isSet detect collections', () => {
    assert.strictEqual(constants.isMap(new Map()), true);
    assert.strictEqual(constants.isMap({}), false);
    assert.strictEqual(constants.isSet(new Set()), true);
    assert.strictEqual(constants.isSet([]), false);
  });
});

describe('paths', () => {
  it('isDotFile detects dot files', () => {
    assert.strictEqual(constants.isDotFile('.gitignore'), true);
    assert.strictEqual(constants.isDotFile('file.js'), false);
  });

  it('isTestFile detects test files', () => {
    assert.strictEqual(constants.isTestFile('app.test.js'), true);
    assert.strictEqual(constants.isTestFile('app.js'), false);
  });

  it('isNodeModulesPath detects node_modules', () => {
    assert.strictEqual(constants.isNodeModulesPath('project/node_modules/foo.js'), true);
    assert.strictEqual(constants.isNodeModulesPath('project/src/foo.js'), false);
  });

  it('isGitPath detects .git', () => {
    assert.strictEqual(constants.isGitPath('project/.git/config'), true);
    assert.strictEqual(constants.isGitPath('project/src/index.js'), false);
  });
});

describe('immutability', () => {
  it('root export is frozen', () => {
    assert.strictEqual(Object.isFrozen(constants), true);
  });

  it('categories namespace is frozen', () => {
    assert.strictEqual(Object.isFrozen(constants.categories), true);
  });

  it('nested category objects are frozen', () => {
    assert.strictEqual(Object.isFrozen(constants.categories.time), true);
    assert.strictEqual(Object.isFrozen(constants.categories.fileTypes), true);
    assert.strictEqual(Object.isFrozen(constants.categories.http), true);
  });

  it('mutating frozen objects is silently ignored or throws', () => {
    const originalCount = Object.keys(constants.categories).length;
    constants.categories.newKey = 'should-not-stick';
    assert.strictEqual(Object.keys(constants.categories).length, originalCount);
    assert.strictEqual(constants.categories.newKey, undefined);
  });
});
