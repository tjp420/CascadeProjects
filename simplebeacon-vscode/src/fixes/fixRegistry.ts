import { Finding } from '../analyzers/workspaceAnalyzer';

export interface FixResult {
  description: string;
  search: RegExp;
  replace: string;
  autoFixable: boolean;
}

export type FixFunction = (snippet: string, finding: Finding) => FixResult | null;

export const FIX_REGISTRY: Record<string, FixFunction> = {
  debugArtifacts: (snippet) => {
    // Only auto-fix debugger statements, not console.log usage messages
    if (/\bdebugger\b/.test(snippet)) {
      return {
        description: 'Remove debugger statement',
        search: /\bdebugger\b;?/,
        replace: '',
        autoFixable: true
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
        autoFixable: true
      };
    }
    // Suggest but don't auto-fix when content is present
    if (/\.innerHTML\s*=/.test(snippet)) {
      return {
        description: 'Consider using textContent or DOM APIs instead of innerHTML',
        search: /\.innerHTML\s*=\s*(.+);?/,
        replace: '.textContent = $1;',
        autoFixable: false
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
        autoFixable: false
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
        autoFixable: false
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
        autoFixable: false
      };
    }
    return null;
  },

  insecureRandom: (snippet) => {
    if (/Math\.random\s*\(\)/.test(snippet)) {
      return {
        description: 'Replace Math.random() with crypto.randomBytes() or crypto.randomUUID()',
        search: /Math\.random\s*\(\)/,
        replace: 'crypto.randomBytes(16).toString("hex")',
        autoFixable: false
      };
    }
    return null;
  },

  a11yGap: (snippet) => {
    if (/<input[^>]*>/.test(snippet) && !/aria-label|aria-labelledby|title|placeholder/.test(snippet)) {
      return {
        description: 'Add aria-label or accessible label to input element',
        search: /(<input[^>]*)>/,
        replace: '$1 aria-label="Description">',
        autoFixable: false
      };
    }
    if (/<img[^>]*>/.test(snippet) && !/alt=/.test(snippet)) {
      return {
        description: 'Add alt attribute to img element',
        search: /(<img[^>]*)>/,
        replace: '$1 alt="">',
        autoFixable: true
      };
    }
    return null;
  },

  missingStrictMode: () => {
    return {
      description: 'Add "use strict" at the top of the function or file',
      search: /^(function\s*\(|\(|const\s+|let\s+|var\s+)/m,
      replace: '"use strict";\n$1',
      autoFixable: false
    };
  },

  uninitializedVariable: (snippet) => {
    const match = snippet.match(/let\s+(\w+);/);
    if (match) {
      return {
        description: `Initialize ${match[1]} to a default value`,
        search: new RegExp(`let\\s+${match[1]};`),
        replace: `let ${match[1]} = null;`,
        autoFixable: false
      };
    }
    return null;
  },

  orphanedExport: () => {
    return {
      description: 'Remove unused export or ensure it is imported elsewhere',
      search: /export\s+(?:default\s+)?(?:function|const|let|var|class)\s+\w+/,
      replace: '',
      autoFixable: false
    };
  },
};

export function getFixForFinding(finding: Finding): FixResult | null {
  if (!finding.patternId || !FIX_REGISTRY[finding.patternId]) return null;
  const match = finding.matches?.[0]?.snippet;
  if (!match) return null;
  return FIX_REGISTRY[finding.patternId](match, finding);
}
