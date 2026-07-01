import * as fs from 'fs';
import * as path from 'path';

/**
 * Parse named exports from a TypeScript source file.
 * Handles:
 *   export { foo, bar } from './module'
 *   export function foo(...)
 *   export const foo = ...
 */
function parseNamedExports(source: string): Set<string> {
  const names = new Set<string>();

  // Remove namespace blocks so we don't pick up internal declarations
  const cleaned = source.replace(/export\s+namespace\s+\w+\s*\{[\s\S]*?\n\}/g, '');

  // export { a, b, c } from '...'
  const reExportBlocks = cleaned.matchAll(/export\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g);
  for (const block of reExportBlocks) {
    block[1].split(',').forEach((raw) => {
      const name = raw.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    });
  }

  // export function foo(
  const fnMatches = cleaned.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+(\w+)/g);
  for (const m of fnMatches) names.add(m[1]);

  return names;
}

function getSrcFile(filePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../../../', filePath), 'utf8');
}

describe('utils/index.ts sync with utils.ts', () => {
  const utilsSrc = getSrcFile('src/utils.ts');
  const indexSrc = getSrcFile('src/utils/index.ts');

  const utilsExports = parseNamedExports(utilsSrc);
  const indexExports = parseNamedExports(indexSrc);

  test('every named export in utils.ts is also in index.ts', () => {
    const missing = [...utilsExports].filter((name) => !indexExports.has(name));
    if (missing.length > 0) {
      throw new Error(
        `The following exports from utils.ts are missing from index.ts:\n  ${missing.join(', ')}\n\n` +
        `Add them to src/utils/index.ts to keep the barrel in sync.`
      );
    }
  });

  test('index.ts does not export symbols absent from utils.ts', () => {
    // We allow the default export (Utils) and namespace imports in index.ts
    // that are not direct re-exports from utils.ts.
    const allowedExtras = new Set(['default']);
    const unexpected = [...indexExports].filter(
      (name) => !utilsExports.has(name) && !allowedExtras.has(name)
    );
    if (unexpected.length > 0) {
      throw new Error(
        `index.ts exports the following symbols not re-exported by utils.ts:\n  ${unexpected.join(', ')}\n\n` +
        `Either add them to utils.ts or remove them from index.ts to keep the API consistent.`
      );
    }
  });
});
