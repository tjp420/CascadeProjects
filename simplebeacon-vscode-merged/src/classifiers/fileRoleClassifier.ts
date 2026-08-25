/**
 * FileRole classifier — determines the role of a file in the repository
 * before any detection rules fire. This is the foundation of false-positive
 * suppression: a `console.log` in a test file is not the same severity as
 * a `console.log` in production app code.
 *
 * Milestone 1: Trust and Noise Reduction
 */

/** The role a file plays in the repository. */
export type FileRole =
  | 'app' // production application code
  | 'config' // configuration files (.env, .yml, .json, .toml, .ini)
  | 'test' // test files, specs, fixtures
  | 'docs' // markdown, rst, text documentation
  | 'generated' // build output, minified bundles, auto-generated code
  | 'vendor' // node_modules, third-party, vendored code
  | 'infra' // Dockerfiles, CI configs, IaC, scripts
  | 'sample'; // examples, demos, mock data, sample code

export interface FileRoleResult {
  role: FileRole;
  /** 0-1 confidence in the classification. Lower = more uncertain. */
  confidence: number;
  /** Which signals triggered the classification, for debugging/audit. */
  signals: string[];
}

interface RoleSignal {
  role: FileRole;
  signal: string;
  /** Higher weight wins when multiple signals match. */
  weight: number;
}

// ─── Path-based signals ───
// Checked against the normalized file path (forward slashes).
const PATH_PATTERNS: RoleSignal[] = [
  // Vendor / third-party
  { role: 'vendor', signal: 'path:node_modules/', weight: 100 },
  { role: 'vendor', signal: 'path:/vendor/', weight: 90 },
  { role: 'vendor', signal: 'path:/third_party/', weight: 90 },
  { role: 'vendor', signal: 'path:/bower_components/', weight: 90 },

  // Generated / build output
  { role: 'generated', signal: 'path:/dist/', weight: 90 },
  { role: 'generated', signal: 'path:/build/', weight: 90 },
  { role: 'generated', signal: 'path:/out/', weight: 85 },
  { role: 'generated', signal: 'path:/.next/', weight: 90 },
  { role: 'generated', signal: 'path:/coverage/', weight: 85 },
  { role: 'generated', signal: 'path:/.vscode-test/', weight: 85 },
  { role: 'generated', signal: 'path:/target/', weight: 85 }, // Rust/Java build
  { role: 'generated', signal: 'path:/__generated__/', weight: 95 },

  // Test files
  { role: 'test', signal: 'path:/__tests__/', weight: 90 },
  { role: 'test', signal: 'path:/test/', weight: 75 },
  { role: 'test', signal: 'path:/tests/', weight: 75 },
  { role: 'test', signal: 'path:/spec/', weight: 80 },
  { role: 'test', signal: 'path:/specs/', weight: 80 },
  { role: 'test', signal: 'path:/fixtures/', weight: 85 },
  { role: 'test', signal: 'path:/__fixtures__/', weight: 90 },
  { role: 'test', signal: 'path:/__mocks__/', weight: 90 },
  { role: 'test', signal: 'path:/.vscode-test/', weight: 80 },

  // Docs
  { role: 'docs', signal: 'path:/docs/', weight: 70 },
  { role: 'docs', signal: 'path:/documentation/', weight: 75 },
  { role: 'docs', signal: 'path:/.github/', weight: 50 }, // could be infra too

  // Sample / demo
  { role: 'sample', signal: 'path:/examples/', weight: 85 },
  { role: 'sample', signal: 'path:/example/', weight: 80 },
  { role: 'sample', signal: 'path:/demo/', weight: 85 },
  { role: 'sample', signal: 'path:/samples/', weight: 85 },
  { role: 'sample', signal: 'path:/mock/', weight: 80 },

  // Infra
  { role: 'infra', signal: 'path:/.github/workflows/', weight: 90 },
  { role: 'infra', signal: 'path:/.gitlab/', weight: 85 },
  { role: 'infra', signal: 'path:/infra/', weight: 85 },
  { role: 'infra', signal: 'path:/deploy/', weight: 75 },
  { role: 'infra', signal: 'path:/k8s/', weight: 85 },
  { role: 'infra', signal: 'path:/.terraform/', weight: 85 },
];

// ─── File name patterns ───
const FILE_NAME_PATTERNS: RoleSignal[] = [
  // Test files
  { role: 'test', signal: 'name:.test.', weight: 90 },
  { role: 'test', signal: 'name:.spec.', weight: 90 },
  { role: 'test', signal: 'name:.stories.', weight: 85 },
  { role: 'test', signal: 'name:.bench.', weight: 80 },
  { role: 'test', signal: 'name:test-', weight: 70 },
  { role: 'test', signal: 'name:-test.', weight: 70 },
  { role: 'test', signal: 'name:_test.', weight: 75 },
  { role: 'test', signal: 'name:conftest.', weight: 90 }, // Python pytest

  // Sample / demo / example files
  { role: 'sample', signal: 'name:.example.', weight: 85 },
  { role: 'sample', signal: 'name:.demo.', weight: 85 },
  { role: 'sample', signal: 'name:.sample.', weight: 85 },
  { role: 'sample', signal: 'name:.mock.', weight: 80 },
  { role: 'sample', signal: 'name:example-', weight: 75 },
  { role: 'sample', signal: 'name:demo-', weight: 75 },

  // Generated / minified
  { role: 'generated', signal: 'name:.min.js', weight: 95 },
  { role: 'generated', signal: 'name:.min.css', weight: 95 },
  { role: 'generated', signal: 'name:.bundle.js', weight: 90 },
  { role: 'generated', signal: 'name:.map', weight: 90 },
  { role: 'generated', signal: 'name:.lock', weight: 60 }, // package-lock, yarn.lock
  { role: 'generated', signal: 'name:package-lock.json', weight: 85 },

  // Infra
  { role: 'infra', signal: 'name:Dockerfile', weight: 95 },
  { role: 'infra', signal: 'name:docker-compose', weight: 95 },
  { role: 'infra', signal: 'name:.yml', weight: 40 }, // could be config
  { role: 'infra', signal: 'name:.yaml', weight: 40 },
  { role: 'infra', signal: 'name:.tf', weight: 85 },
  { role: 'infra', signal: 'name:.tfvars', weight: 80 },
  { role: 'infra', signal: 'name:.sh', weight: 50 }, // could be app
  { role: 'infra', signal: 'name:.bash', weight: 50 },
  { role: 'infra', signal: 'name:Makefile', weight: 75 },
  { role: 'infra', signal: 'name:render.yaml', weight: 90 },
  { role: 'infra', signal: 'name:wrangler.toml', weight: 85 },
  { role: 'infra', signal: 'name:wrangler.jsonc', weight: 85 },

  // Config
  { role: 'config', signal: 'name:.env', weight: 85 },
  { role: 'config', signal: 'name:.ini', weight: 70 },
  { role: 'config', signal: 'name:.cfg', weight: 70 },
  { role: 'config', signal: 'name:.conf', weight: 70 },
  { role: 'config', signal: 'name:.toml', weight: 65 },
  { role: 'config', signal: 'name:tsconfig.json', weight: 90 },
  { role: 'config', signal: 'name:jsconfig.json', weight: 90 },
  { role: 'config', signal: 'name:.eslintrc', weight: 85 },
  { role: 'config', signal: 'name:.prettierrc', weight: 85 },
  { role: 'config', signal: 'name:babel.config', weight: 85 },
  { role: 'config', signal: 'name:jest.config', weight: 85 },
  { role: 'config', signal: 'name:vite.config', weight: 85 },
  { role: 'config', signal: 'name:webpack.config', weight: 85 },
  { role: 'config', signal: 'name:rollup.config', weight: 85 },

  // Docs
  { role: 'docs', signal: 'name:.md', weight: 80 },
  { role: 'docs', signal: 'name:.mdx', weight: 80 },
  { role: 'docs', signal: 'name:.rst', weight: 85 },
  { role: 'docs', signal: 'name:.txt', weight: 50 }, // could be app
  { role: 'docs', signal: 'name:README', weight: 90 },
  { role: 'docs', signal: 'name:CHANGELOG', weight: 90 },
  { role: 'docs', signal: 'name:LICENSE', weight: 90 },
  { role: 'docs', signal: 'name:CONTRIBUTING', weight: 90 },
];

// ─── Content markers (checked in first 500 chars of file) ───
const CONTENT_MARKERS: Array<{ role: FileRole; regex: RegExp; signal: string; weight: number }> = [
  // Generated
  { role: 'generated', regex: /DO NOT EDIT/i, signal: 'content:DO NOT EDIT', weight: 95 },
  { role: 'generated', regex: /AUTO-GENERATED/i, signal: 'content:AUTO-GENERATED', weight: 95 },
  { role: 'generated', regex: /\/\/\s*generated by/i, signal: 'content:generated by', weight: 90 },
  { role: 'generated', regex: /#\s*generated by/i, signal: 'content:generated by (hash)', weight: 90 },
  { role: 'generated', regex: /This file was automatically generated/i, signal: 'content:auto-generated', weight: 95 },
  {
    role: 'generated',
    regex: /Built with (?:webpack|vite|rollup|esbuild)/i,
    signal: 'content:built with bundler',
    weight: 80,
  },

  // Sample / demo
  { role: 'sample', regex: /This is (a )?demo/i, signal: 'content:demo marker', weight: 80 },
  { role: 'sample', regex: /This is (an )?example/i, signal: 'content:example marker', weight: 75 },
  { role: 'sample', regex: /Sample (code|implementation)/i, signal: 'content:sample marker', weight: 80 },
];

// ─── Extension routing (lowest priority fallback) ───
const EXTENSION_ROLES: Record<string, { role: FileRole; weight: number }> = {
  '.md': { role: 'docs', weight: 60 },
  '.mdx': { role: 'docs', weight: 60 },
  '.rst': { role: 'docs', weight: 65 },
  '.json': { role: 'config', weight: 30 }, // could be app (tsconfig) or data
  '.yml': { role: 'config', weight: 35 },
  '.yaml': { role: 'config', weight: 35 },
  '.toml': { role: 'config', weight: 40 },
  '.ini': { role: 'config', weight: 50 },
  '.cfg': { role: 'config', weight: 50 },
  '.conf': { role: 'config', weight: 50 },
  '.env': { role: 'config', weight: 60 },
  '.dockerfile': { role: 'infra', weight: 70 },
  '.tf': { role: 'infra', weight: 70 },
  '.tfvars': { role: 'infra', weight: 65 },
  '.sh': { role: 'infra', weight: 40 },
  '.bash': { role: 'infra', weight: 40 },
  '.map': { role: 'generated', weight: 70 },
  '.lock': { role: 'generated', weight: 50 },
};

/**
 * Classify a file's role in the repository.
 *
 * @param filePath Absolute or relative file path
 * @param fileContent Optional first 500 chars of file content for content-based signals
 * @returns FileRoleResult with role, confidence, and signals that triggered it
 */
export function classifyFileRole(filePath: string, fileContent?: string): FileRoleResult {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const fileName = normalizedPath.split('/').pop() || normalizedPath;
  const lowerFileName = fileName.toLowerCase();
  const lowerPath = normalizedPath.toLowerCase();

  const matchedSignals: RoleSignal[] = [];

  // ─── 1. Path-based signals (highest weight) ───
  for (const pattern of PATH_PATTERNS) {
    if (pattern.signal.startsWith('path:')) {
      const pathPattern = pattern.signal.slice(5);
      // Match if the path contains the pattern (with leading slash or at start)
      if (lowerPath.includes(pathPattern) || lowerPath.startsWith(pathPattern.slice(1))) {
        matchedSignals.push(pattern);
      }
    }
  }

  // ─── 2. File name signals ───
  for (const pattern of FILE_NAME_PATTERNS) {
    if (pattern.signal.startsWith('name:')) {
      const namePattern = pattern.signal.slice(5);
      if (lowerFileName.includes(namePattern.toLowerCase())) {
        matchedSignals.push(pattern);
      }
    }
  }

  // ─── 3. Content markers (if content provided) ───
  if (fileContent) {
    const head = fileContent.slice(0, 500);
    for (const marker of CONTENT_MARKERS) {
      if (marker.regex.test(head)) {
        matchedSignals.push({
          role: marker.role,
          signal: marker.signal,
          weight: marker.weight,
        });
      }
    }
  }

  // ─── 4. Extension fallback (lowest weight) ───
  const ext = fileName.includes('.') ? '.' + fileName.split('.').pop()?.toLowerCase() : '';
  if (ext && EXTENSION_ROLES[ext]) {
    matchedSignals.push({
      role: EXTENSION_ROLES[ext].role,
      signal: `ext:${ext}`,
      weight: EXTENSION_ROLES[ext].weight,
    });
  }

  // ─── Resolve: pick the role with highest total weight ───
  if (matchedSignals.length === 0) {
    // No signals matched — default to app code
    return {
      role: 'app',
      confidence: 0.3,
      signals: ['fallback:default-app'],
    };
  }

  // Tally weights per role
  const roleWeights = new Map<FileRole, number>();
  const roleSignals = new Map<FileRole, string[]>();
  for (const sig of matchedSignals) {
    roleWeights.set(sig.role, (roleWeights.get(sig.role) || 0) + sig.weight);
    if (!roleSignals.has(sig.role)) {
      roleSignals.set(sig.role, []);
    }
    roleSignals.get(sig.role)!.push(sig.signal);
  }

  // Find the role with the highest total weight
  let bestRole: FileRole = 'app';
  let bestWeight = 0;
  for (const [role, weight] of roleWeights) {
    if (weight > bestWeight) {
      bestRole = role;
      bestWeight = weight;
    }
  }

  // Confidence = normalized weight (cap at 1.0)
  // 100+ weight = 0.9+ confidence, 50 weight = ~0.5 confidence
  const confidence = Math.min(1.0, bestWeight / 100);

  return {
    role: bestRole,
    confidence,
    signals: roleSignals.get(bestRole) || [],
  };
}

/**
 * Quick check: should this file role be scanned at all?
 * Some roles (generated, vendor) should be skipped entirely.
 */
export function shouldScanRole(role: FileRole): boolean {
  return role !== 'generated' && role !== 'vendor';
}

/**
 * Quick check: is this file role one where findings should be reported
 * with full severity, or downshifted?
 */
export function isProductionRole(role: FileRole): boolean {
  return role === 'app' || role === 'config' || role === 'infra';
}
