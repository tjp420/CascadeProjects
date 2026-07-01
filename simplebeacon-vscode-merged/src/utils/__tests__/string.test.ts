import {
  escapeHtml, escapeRegExp, truncate, capitalize, camelCase, kebabCase, snakeCase,
  padStart, padEnd, pluralize, formatPercent, formatDate, relativeTime, formatDuration,
  titleCase, reverse, slugify, repeat, startsWith, endsWith, trim, splitLines, stripAnsi, wordCount
} from '../string';

describe('string utilities', () => {
  describe('escapeHtml', () => {
    test('escapes special characters', () => {
      expect(escapeHtml('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    });
    test('handles null/undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });
  });

  describe('escapeRegExp', () => {
    test('escapes regex metacharacters', () => {
      expect(escapeRegExp('a.b*c+d?e[f]g(h)i{j}k|l^m$n\\o')).toBe('a\\.b\\*c\\+d\\?e\\[f\\]g\\(h\\)i\\{j\\}k\\|l\\^m\\$n\\\\o');
    });
  });

  describe('truncate', () => {
    test('truncates long strings', () => {
      expect(truncate('hello world', 8)).toBe('hello w…');
    });
    test('returns short strings unchanged', () => {
      expect(truncate('short', 10)).toBe('short');
    });
    test('custom suffix', () => {
      expect(truncate('hello world', 8, '...')).toBe('hello...');
    });
  });

  describe('capitalize', () => {
    test('capitalizes first letter only', () => {
      expect(capitalize('hello')).toBe('Hello');
    });
    test('only uppercases first char', () => {
      expect(capitalize('hello')).toBe('Hello');
    });
    test('handles empty', () => {
      expect(capitalize('')).toBe('');
    });
  });

  describe('camelCase', () => {
    test('converts kebab-case', () => {
      expect(camelCase('foo-bar')).toBe('fooBar');
    });
    test('converts snake_case', () => {
      expect(camelCase('foo_bar')).toBe('fooBar');
    });
    test('handles spaces', () => {
      expect(camelCase('Foo Bar')).toBe('fooBar');
    });
  });

  describe('kebabCase', () => {
    test('converts camelCase', () => {
      expect(kebabCase('fooBar')).toBe('foo-bar');
    });
    test('handles spaces', () => {
      expect(kebabCase('foo bar')).toBe('foo-bar');
    });
  });

  describe('snakeCase', () => {
    test('converts camelCase', () => {
      expect(snakeCase('fooBar')).toBe('foo_bar');
    });
    test('handles hyphens', () => {
      expect(snakeCase('foo-bar')).toBe('foo_bar');
    });
  });

  describe('padStart', () => {
    test('pads string to length', () => {
      expect(padStart('42', 5, '0')).toBe('00042');
    });
    test('no-op if already long enough', () => {
      expect(padStart('hello', 3, 'x')).toBe('hello');
    });
  });

  describe('padEnd', () => {
    test('pads string to length', () => {
      expect(padEnd('42', 5, '0')).toBe('42000');
    });
  });

  describe('pluralize', () => {
    test('singular form for 1', () => {
      expect(pluralize(1, 'file')).toBe('1 file');
    });
    test('plural form for 0', () => {
      expect(pluralize(0, 'file')).toBe('0 files');
    });
    test('custom plural', () => {
      expect(pluralize(2, 'child', 'children')).toBe('2 children');
    });
  });

  describe('formatPercent', () => {
    test('formats number with %', () => {
      expect(formatPercent(0.5)).toBe('0.5%');
    });
    test('handles string ending with %', () => {
      expect(formatPercent('50%')).toBe('50%');
    });
    test('returns em-dash for null', () => {
      expect(formatPercent(null)).toBe('—');
    });
  });

  describe('formatDate', () => {
    test('formats Date object', () => {
      const result = formatDate(new Date('2024-01-15'));
      expect(result).toContain('2024');
    });
    test('handles null', () => {
      expect(formatDate(null)).toBe('—');
    });
  });

  describe('relativeTime', () => {
    test('returns just now for recent', () => {
      expect(relativeTime(Date.now())).toBe('just now');
    });
    test('returns seconds ago', () => {
      expect(relativeTime(Date.now() - 5000)).toMatch(/5s ago/);
    });
  });

  describe('formatDuration', () => {
    test('formats milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });
    test('formats seconds', () => {
      expect(formatDuration(5000)).toBe('5s');
    });
    test('formats minutes', () => {
      expect(formatDuration(125000)).toBe('2m 5s');
    });
    test('handles null', () => {
      expect(formatDuration(null)).toBe('—');
    });
  });

  describe('titleCase', () => {
    test('capitalizes each word', () => {
      expect(titleCase('hello world')).toBe('Hello World');
    });
  });

  describe('reverse', () => {
    test('reverses string', () => {
      expect(reverse('hello')).toBe('olleh');
    });
  });

  describe('slugify', () => {
    test('creates URL-safe slug', () => {
      expect(slugify('Hello World!')).toBe('hello-world');
    });
  });

  describe('repeat', () => {
    test('repeats string N times', () => {
      expect(repeat('a', 3)).toBe('aaa');
    });
    test('zero count returns empty', () => {
      expect(repeat('a', 0)).toBe('');
    });
  });

  describe('startsWith', () => {
    test('true for matching prefix', () => {
      expect(startsWith('hello world', 'hello')).toBe(true);
    });
    test('false for non-matching', () => {
      expect(startsWith('hello world', 'world')).toBe(false);
    });
  });

  describe('endsWith', () => {
    test('true for matching suffix', () => {
      expect(endsWith('hello world', 'world')).toBe(true);
    });
    test('false for non-matching', () => {
      expect(endsWith('hello world', 'hello')).toBe(false);
    });
  });

  describe('trim', () => {
    test('removes whitespace', () => {
      expect(trim('  hello  ')).toBe('hello');
    });
  });

  describe('splitLines', () => {
    test('splits on \\n', () => {
      expect(splitLines('a\nb')).toEqual(['a', 'b']);
    });
    test('splits on \\r\\n', () => {
      expect(splitLines('a\r\nb')).toEqual(['a', 'b']);
    });
    test('returns empty for empty string', () => {
      expect(splitLines('')).toEqual([]);
    });
  });

  describe('stripAnsi', () => {
    test('removes ANSI codes', () => {
      expect(stripAnsi('\u001B[31mred\u001B[0m')).toBe('red');
    });
  });

  describe('wordCount', () => {
    test('counts words', () => {
      expect(wordCount('hello world')).toBe(2);
    });
    test('zero for empty', () => {
      expect(wordCount('')).toBe(0);
    });
  });
});
