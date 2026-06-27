import { Finding } from '../analyzers/workspaceAnalyzer';

export interface FixResult {
  description: string;
  search: RegExp;
  replace: string;
  autoFixable: boolean;
}

/**
 * Function type for generating an automated fix from a code snippet and finding.
 */
export type FixFunction = (snippet: string, finding: Finding) => FixResult | null;

/**
 * Registry mapping finding types to their automated fix functions.
 */
export const FIX_REGISTRY: Record<string, FixFunction> = {
  debugArtifacts: (snippet) => {
    // Only auto-fix debugger statements, not console.log usage messages
    if (/\bdebugger\b/.test(snippet)) {
      return {
        description: 'Remove debugger statement',
        search: /\bdebugger\b;?/,
        replace: '',
        autoFixable: true,
      };
    }
    return null;
  },

  innerHtmlXss: (snippet) => {
    // Only safe auto-fix: innerHTML = '' -> textContent = ''
    if (/\.innerHTML\s*=\s*['"]\s*['"]/.test(snippet)) {
      return {
        description: 'Replace innerHTML clearing with textContent clearing',
        search: /\.innerHTML/,
        replace: '.textContent',
        autoFixable: true,
      };
    }
    // Suggest but don't auto-fix when content is present
    if (/\.innerHTML\s*=/.test(snippet)) {
      return {
        description: 'Consider using textContent or DOM APIs instead of innerHTML',
        search: /\.innerHTML\s*=\s*(.+);?/,
        replace: '.textContent = $1;',
        autoFixable: false,
      };
    }
    return null;
  },

  evalDanger: () => null, // not auto-fixable — requires semantic understanding

  prototypePollution: () => null, // not auto-fixable — requires architectural change

  unhandledPromise: (snippet) => {
    if (/\.then\s*\(/.test(snippet) && !/\.catch/.test(snippet)) {
      return {
        description: 'Add .catch() handler to promise chain',
        search: /(\.then\s*\([^)]*\))\s*;?\s*$/,
        replace: '$1.catch(err => console.error(err));',
        autoFixable: false,
      };
    }
    return null;
  },

  dbAntiPattern: (snippet) => {
    // Suggest parameterized query pattern
    if (/SELECT\s+.*['"]\s*\+\s*['"]/.test(snippet)) {
      return {
        description: 'Replace string concatenation with parameterized query',
        search: /['"]\s*\+\s*['"]/,
        replace: '?',
        autoFixable: false,
      };
    }
    return null;
  },

  typeSafetyAny: (snippet) => {
    // Suggest unknown instead of any
    if (/:\s*any\b/.test(snippet)) {
      return {
        description: 'Replace any with unknown or a specific type',
        search: /:\s*any\b/,
        replace: ': unknown',
        autoFixable: false,
      };
    }
    return null;
  },

  insecureRandom: (snippet) => {
    if (/Math\.random\s*\(\)/.test(snippet)) { // simplebeacon-ignore weak-crypto — scanner rule definition
      return {
        // simplebeacon-ignore weak-crypto — remediation advice text, not actual usage
        description: 'Replace Math.random() with crypto.randomBytes() or crypto.randomUUID()',
        search: /Math\.random\s*\(\)/, // simplebeacon-ignore weak-crypto — scanner rule definition
        replace: 'crypto.randomBytes(16).toString("hex")',
        autoFixable: false,
      };
    }
    return null;
  },
};

/**
 * Look up and apply the registered fix function for a given finding.
 * @param finding - Workspace finding with patternId and matched snippet.
 * @returns Fix result or null if no fix is registered.
 */
export function getFixForFinding(finding: Finding): FixResult | null {
  if (!finding.patternId || !FIX_REGISTRY[finding.patternId]) return null;
  const match = finding.matches?.[0]?.snippet;
  if (!match) return null;
  return FIX_REGISTRY[finding.patternId](match, finding);
}
