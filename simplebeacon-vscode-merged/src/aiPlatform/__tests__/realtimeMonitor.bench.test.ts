// Performance benchmark for realtimeMonitor optimization
// Measures O(log n) binary search vs O(n) linear scan on a 10,000-line sample file

/**
 * Replicate the OLD linear scan line-number lookup for comparison.
 */
function linearLineLookup(lines: string[], matchIndex: number): number {
  let charCount = 0;
  for (let i = 0; i < lines.length; i++) {
    charCount += lines[i].length + 1;
    if (charCount > matchIndex) {
      return i + 1;
    }
  }
  return 1;
}

/**
 * Replicate the NEW binary search line-number lookup.
 */
function buildLineOffsets(lines: string[]): number[] {
  const offsets: number[] = new Array(lines.length);
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    offsets[i] = pos;
    pos += lines[i].length + 1;
  }
  return offsets;
}

function lineFromOffset(lineOffsets: number[], charOffset: number): number {
  let lo = 0,
    hi = lineOffsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineOffsets[mid] <= charOffset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/**
 * Generate a realistic 10,000-line TypeScript source file.
 * Includes patterns that trigger security + AI slop detection.
 */
function generateSampleFile(lineCount: number): string {
  const lines: string[] = [];
  const patterns = [
    'const password = "hardcoded_secret";',
    'console.log("debug output");',
    'const apiKey = "sk_live_abc123def456";',
    'element.innerHTML = userInput;',
    'eval(untrustedData);',
    'const result = processData(items);',
    'function handleRequest(req, res) { return res.json(data); }',
    '// TODO: This function handles the user authentication flow and returns a JWT token',
    'const helper = (data) => data.map(item => item.value);',
    'var legacyVar = "should be const";',
    'const token = "ghp_1234567890abcdef";',
    'db.query("SELECT * FROM users WHERE id = " + userId);',
    '// This function processes the incoming request data and transforms it',
    'const manager = new DataManager(config);',
    'if (password == "admin") { return true; }',
    '        const deeply = () => {',
    '            const nested = () => {',
    '                return data.filter(x => x.active);',
    '            };',
    '        };',
    "import { Component } from 'react';",
    "import { useState } from 'react';",
    "import { useEffect } from 'react';",
    "import { useCallback } from 'react';",
    "import { useRef } from 'react';",
    'debugger;',
    'try { riskyOperation(); } catch (e) { console.log(e); }',
    'try { anotherRiskyOp(); } catch (e) { console.log(e); }',
    'try { thirdOp(); } catch (e) { console.log(e); }',
    'try { fourthOp(); } catch (e) { console.log(e); }',
    'try { fifthOp(); } catch (e) { console.log(e); }',
    'try { sixthOp(); } catch (e) { console.log(e); }',
    'const normalLine = "just regular code";',
    'export class Service { constructor() {} }',
  ];

  for (let i = 0; i < lineCount; i++) {
    const pattern = patterns[i % patterns.length];
    const indent = i % 4 === 0 ? '' : '  '.repeat(i % 3);
    lines.push(`${indent}${pattern} // line ${i + 1}`);
  }

  return lines.join('\n');
}

describe('realtimeMonitor line-lookup performance', () => {
  const LINE_COUNT = 10000;
  const content = generateSampleFile(LINE_COUNT);
  const lines = content.split('\n');
  const lineOffsets = buildLineOffsets(lines);

  // Generate 500 random match positions to simulate regex matches
  const matchPositions: number[] = [];
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    if (i % 20 === 0) {
      // Simulate a match at a random column in this line
      const col = Math.floor(Math.random() * Math.min(40, lines[i].length));
      matchPositions.push(pos + col);
    }
    pos += lines[i].length + 1;
  }

  it('produces correct line numbers from both methods', () => {
    for (const mp of matchPositions) {
      const linear = linearLineLookup(lines, mp);
      const binary = lineFromOffset(lineOffsets, mp);
      expect(binary).toBe(linear);
    }
  });

  it('binary search is faster than linear scan for line lookup', () => {
    const ITERATIONS = 100;

    // Benchmark linear scan
    const linearStart = process.hrtime.bigint();
    for (let iter = 0; iter < ITERATIONS; iter++) {
      for (const mp of matchPositions) {
        linearLineLookup(lines, mp);
      }
    }
    const linearEnd = process.hrtime.bigint();
    const linearMs = Number(linearEnd - linearStart) / 1e6;

    // Benchmark binary search (include offset build cost once)
    const binaryStart = process.hrtime.bigint();
    const offsets = buildLineOffsets(lines);
    for (let iter = 0; iter < ITERATIONS; iter++) {
      for (const mp of matchPositions) {
        lineFromOffset(offsets, mp);
      }
    }
    const binaryEnd = process.hrtime.bigint();
    const binaryMs = Number(binaryEnd - binaryStart) / 1e6;

    const speedup = linearMs / binaryMs;

    // eslint-disable-next-line no-console
    console.log(`
┌──────────────────────────────────────────────────────────┐
│  RealtimeMonitor Line-Lookup Benchmark (10K lines)      │
├──────────────────────────────────────────────────────────┤
│  Match positions:    ${matchPositions.length.toString().padStart(6)}                   │
│  Iterations:         ${ITERATIONS.toString().padStart(6)}                   │
│  Total lookups:      ${(matchPositions.length * ITERATIONS).toString().padStart(6)}                   │
├──────────────────────────────────────────────────────────┤
│  Linear scan:   ${linearMs.toFixed(2).padStart(8)} ms                          │
│  Binary search: ${binaryMs.toFixed(2).padStart(8)} ms                          │
│  Speedup:       ${speedup.toFixed(2).padStart(8)}x                           │
└──────────────────────────────────────────────────────────┘
    `);

    // Binary search should be at least 2x faster on 10K lines
    expect(speedup).toBeGreaterThan(2);
  });

  it('buildLineOffsets produces correct offsets', () => {
    const testLines = ['hello', 'world', 'foo'];
    const offsets = buildLineOffsets(testLines);
    expect(offsets).toEqual([0, 6, 12]); // 'hello'\n = 6, 'world'\n = 12
  });

  it('lineFromOffset finds correct line for edge cases', () => {
    const testLines = ['abc', 'def', 'ghi'];
    const offsets = buildLineOffsets(testLines);

    expect(lineFromOffset(offsets, 0)).toBe(1); // start of line 1
    expect(lineFromOffset(offsets, 3)).toBe(1); // end of line 1 (before \n)
    expect(lineFromOffset(offsets, 4)).toBe(2); // start of line 2
    expect(lineFromOffset(offsets, 7)).toBe(2); // end of line 2
    expect(lineFromOffset(offsets, 8)).toBe(3); // start of line 3
    expect(lineFromOffset(offsets, 11)).toBe(3); // end of line 3
  });

  it('handles single-line content', () => {
    const single = ['only line'];
    const offsets = buildLineOffsets(single);
    expect(lineFromOffset(offsets, 0)).toBe(1);
    expect(lineFromOffset(offsets, 9)).toBe(1);
  });

  it('content split produces expected line count', () => {
    expect(lines.length).toBe(LINE_COUNT);
  });
});
