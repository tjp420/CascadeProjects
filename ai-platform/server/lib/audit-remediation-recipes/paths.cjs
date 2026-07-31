/**
 * Path utilities, location parsing, and artifact-context inference.
 * Separated from the main module for easier unit testing.
 */

const path = require('path');

function normalizePathKey(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .toLowerCase();
}

function parseLocation(location) {
  const raw = String(location || '').trim();
  if (!raw) {
    return { file: null, line: null, column: null };
  }
  const match = raw.match(/^(.+?):(\d+)(?::(\d+))?$/);
  if (match) {
    return {
      file: match[1],
      line: Number(match[2]),
      column: match[3] ? Number(match[3]) : null,
    };
  }
  return { file: raw, line: null, column: null };
}

function isHandoffArtifactPath(filePath) {
  const normalized = normalizePathKey(filePath);
  return (
    /(^|\/)deliverables\//.test(normalized) || /(^|\/)\.simplebeacon\/.*\.html$/.test(normalized)
  );
}

function isIntentionalFixturePath(filePath) {
  const normalized = normalizePathKey(filePath);
  return (
    /(^|\/)tests\/fixtures\//.test(normalized) ||
    /(^|\/)web\/data\/.*-sample\.json$/.test(normalized) ||
    /toxic-fixtures/.test(normalized)
  );
}

function isDocumentationPath(filePath) {
  return /(^|\/)docs\//.test(normalizePathKey(filePath));
}

function inferArtifactContext(row = {}) {
  const file = parseLocation(row.location).file || row.filePath || '';
  if (isHandoffArtifactPath(file)) {
    return {
      blocksGate: false,
      artifactType: 'handoff-deliverable',
      businessImpact:
        'No action on artifact — regenerate handoff export instead of editing deliverables in place',
    };
  }
  if (isIntentionalFixturePath(file)) {
    return {
      blocksGate: false,
      artifactType: 'intentional-fixture',
      businessImpact: 'Intentional test/sample fixture — verify purpose before changing',
    };
  }
  if (isDocumentationPath(file)) {
    return {
      blocksGate: false,
      artifactType: 'documentation',
      businessImpact: 'Documentation example — tokenize PII when convenient; not a deploy blocker',
    };
  }
  if (/packages\/simplebeacon-cli\/src\/rules\//.test(normalizePathKey(file))) {
    return {
      blocksGate: false,
      artifactType: 'scanner-rule',
      businessImpact:
        'Scanner rule source — pattern detectors may contain literal match tokens by design',
    };
  }
  if (/audit-remediation-recipes\.c?js$/.test(normalizePathKey(file))) {
    return {
      blocksGate: false,
      artifactType: 'scanner-rule',
      businessImpact: 'Remediation recipe source — contains debug pattern match tokens by design',
    };
  }
  return null;
}

function resolveFindingFilePath(finding = {}, options = {}) {
  const raw = finding.filePath || finding.path || finding.metadata?.filePath || '';
  const anchor = options.platformRoot || options.projectPath || '';
  if (raw) {
    return path.isAbsolute(raw) ? normalizePathKey(raw) : normalizePathKey(path.join(anchor, raw));
  }
  const parsed = parseLocation(finding.location || '');
  if (parsed.file) {
    return path.isAbsolute(parsed.file)
      ? normalizePathKey(parsed.file)
      : normalizePathKey(path.join(anchor, parsed.file));
  }
  return '';
}

function isFindingInProjectScope(finding, options = {}) {
  const projectPath = options.projectPath;
  if (!projectPath) return true;
  const scopeKey = normalizePathKey(path.resolve(projectPath));
  const fileKey = resolveFindingFilePath(finding, options);
  if (!fileKey) return true;
  return fileKey === scopeKey || fileKey.startsWith(`${scopeKey}/`);
}

function shouldScopeFindingsToProject(options = {}) {
  const projectPath = options.projectPath;
  if (!projectPath) return false;
  return /[/\\]github-cache[/\\]/i.test(String(projectPath));
}

function filterFindingsByProjectScope(findings = [], options = {}) {
  if (!shouldScopeFindingsToProject(options)) return findings;
  return findings.filter((finding) => isFindingInProjectScope(finding, options));
}

module.exports = {
  normalizePathKey,
  parseLocation,
  isHandoffArtifactPath,
  isIntentionalFixturePath,
  isDocumentationPath,
  inferArtifactContext,
  resolveFindingFilePath,
  isFindingInProjectScope,
  shouldScopeFindingsToProject,
  filterFindingsByProjectScope,
};
