// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Scan repository for git hygiene issues:
 * - Large files in git history
 * - Sensitive files that should not be committed
 * - Suspicious patterns in recent commit messages
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { walkProjectFiles } = require('./utils/project-walker');
const constants = require('../../lib/constants');

const SENSITIVE_FILE_PATTERNS = [
  /^\.env(?!\.example)/, // .env, .env.local, .env.production — but NOT .env.example
  /^\.env\.(?!example)/, // .env.* — but NOT .env.example
  /id_rsa/,
  /id_dsa/,
  /id_ecdsa/,
  /id_ed25519/,
  /\.p12$/,
  /\.pfx$/,
  /\.key$/,
  /\.keystore$/,
  /\.jks$/,
  /\.htpasswd/,
  /\.npmrc$/,
  /\.pypirc$/,
  /\.aws\//,
  /\.docker\/config\.json$/,
  /kubeconfig/,
  /known_hosts$/,
  /authorized_keys$/,
  /\.history$/,
  /\.bash_history$/,
  /\.zsh_history$/,
  /\.psql_history$/,
  /dump\.sql$/,
  /backup\.sql$/,
  /\.sql\.gz$/,
  /\.dump$/,
  /\.tar\.gz$/,
  /\.7z$/,
  /\.rar$/,
];

/** Secret token files — not auth/token *source modules* named token-*.cjs / *Service.js. */
const TOKEN_SECRET_FILE_PATTERNS = [
  /\.tokenkey$/i,
  /-token\.txt$/i,
  /^tokens?\.(txt|json|key|pem)$/i,
  /\/tokens\/[^/]+\.(txt|json|key|pem)$/i,
];

const EXCLUDED_SENSITIVE_PATHS = [
  /secret-config\.cjs$/, // Secret resolution library (reads from env, no hardcoded secrets)
  /token-bleed-patterns\.js$/, // Scanner rule that detects token leaks in other code
  /license-token\.(js|cjs)$/, // Token signing/validation library
  /generate-license-token\.(cjs|js|bat)$/, // CLI tooling
  /generate-token\.bat$/, // Token launcher script
  /generate-test-token\.cjs$/, // Test tooling
  /get-test-token\.cjs$/, // Token retrieval utility
  /free-token\.cjs$/, // Route that generates tokens from env
  /token-service\.cjs$/,
  /token-db\.cjs$/,
  /token-auth/,
  /password-service\.cjs$/,
  /validate-project-token\.cjs$/,
  /tokenStockpileService\.js$/,
  /token-(manager|chain|file-system|entry-guard|validate)/,
  /admin-token\.cjs$/,
  /time-tokens\.cjs$/,
  /token-chain-(store|utils)\.cjs$/,
  /schema-token-(rotation|system)\.sql$/,
  /token-registry\.json$/,
  /context-token-optimization\.sql$/,
  /secret-in-comments-scanner\.js$/,
  /audit-token-bleed\.js$/,
  /token-generator\.md$/,
  /decrypt-token\.js$/,
  /simplebeacon-public-live\.pem$/, // Public license cert, not a private key
  /\/releases\//,
  /upload-bundle\.zip$/,
  /temp\.vsix\.zip$/,
];

function isPublicPemPath(normalized) {
  return /\.pem$/i.test(normalized) && /(?:public|live-public|-public)/i.test(normalized);
}

function isReleaseArchivePath(normalized) {
  if (!/\.zip$/i.test(normalized)) return false;
  return (
    /\/releases?\//i.test(normalized) ||
    /upload-bundle\.zip$/i.test(normalized) ||
    /temp\.vsix\.zip$/i.test(normalized)
  );
}

function isSensitiveFile(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  if (EXCLUDED_SENSITIVE_PATHS.some((re) => re.test(normalized))) return false;
  if (isPublicPemPath(normalized)) return false;
  if (isReleaseArchivePath(normalized)) return false;
  if (TOKEN_SECRET_FILE_PATTERNS.some((re) => re.test(normalized))) return true;
  const baseName = normalized.split('/').pop() || '';
  if (/^token\.(txt|json|key|pem)$/i.test(baseName)) return true;
  if (/\.zip$/i.test(normalized)) return true;
  if (/\.pem$/i.test(normalized)) return true;
  if (/credentials\.(json|ya?ml|xml|ini)$/i.test(normalized)) return true;
  if (/(?:^|\/)secrets\.(json|ya?ml)$/i.test(normalized)) return true;
  return SENSITIVE_FILE_PATTERNS.some((re) => re.test(normalized));
}

const COMMIT_SENSITIVE_PATTERNS = [
  /BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /glpat-[a-zA-Z0-9\-]{20}/,
  /sk-[a-zA-Z0-9]{48}/,
  /-----BEGIN CERTIFICATE-----/,
  /\bpassword\s*[=:]\s*\S+/i,
  /\bpasswd\s*[=:]\s*\S+/i,
  /\bsecret\s*[=:]\s*\S+/i,
  /\bapi[_-]?key\s*[=:]\s*\S+/i,
  /\btoken\s*[=:]\s*\S+/i,
];

const LARGE_FILE_THRESHOLD_BYTES = constants.BYTES_PER_KB * 1024;
const LARGE_BLOB_THRESHOLD_BYTES = 5 * 1024 * 1024;
const MAX_COMMITS_TO_SCAN = 20;

function isGitRepo(projectRoot) {
  return fs.existsSync(path.join(projectRoot, '.git'));
}

function isInsideGitRepo(projectRoot) {
  if (isGitRepo(projectRoot)) return true;
  let current = projectRoot;
  while (current !== path.dirname(current)) {
    current = path.dirname(current);
    if (fs.existsSync(path.join(current, '.git'))) return true;
  }
  return false;
}

function getGitTrackedFiles(projectRoot) {
  try {
    const output = execSync('git ls-files', {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return output.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function getRecentCommits(projectRoot, count = MAX_COMMITS_TO_SCAN) {
  try {
    const output = execSync(`git log --pretty=format:"%H%n%s%n%b%n---COMMIT_END---" -n ${count}`, {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    const commits = [];
    const parts = output.split('---COMMIT_END---');
    for (const part of parts) {
      const lines = part.trim().split('\n');
      if (lines.length >= 2) {
        commits.push({ hash: lines[0], subject: lines[1], body: lines.slice(2).join('\n') });
      }
    }
    return commits;
  } catch {
    return [];
  }
}

function getLargeBlobs(projectRoot, thresholdBytes = LARGE_BLOB_THRESHOLD_BYTES) {
  try {
    const output = execSync(
      'git rev-list --objects --all | git cat-file --batch-check="%(objecttype) %(objectname) %(objectsize) %(rest)"',
      { cwd: projectRoot, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, shell: true }
    );
    const large = [];
    for (const line of output.split('\n')) {
      const parts = line.trim().split(' ');
      if (parts.length >= 4 && parts[0] === 'blob') {
        const size = parseInt(parts[2], 10);
        if (size >= thresholdBytes) {
          large.push({ hash: parts[1], size, path: parts.slice(3).join(' ') });
        }
      }
    }
    return large;
  } catch {
    return [];
  }
}

class GitHygieneScanner {
  constructor(config = {}) {
    this.largeFileThreshold = config.largeFileThreshold ?? LARGE_FILE_THRESHOLD_BYTES;
    this.largeBlobThreshold = config.largeBlobThreshold ?? LARGE_BLOB_THRESHOLD_BYTES;
    this.maxCommits = config.maxCommits ?? MAX_COMMITS_TO_SCAN;
    this.enabled = config.enabled !== false;
    this.excludedPaths = new Set((config.excludedPaths || []).map((p) => p.replace(/\\/g, '/')));
    this.excludedCommitHashes = new Set(
      (config.excludedCommitHashes || []).map((h) => h.toLowerCase())
    );
  }

  async scan(projectRoot, options = {}) {
    const findings = [];
    let filesAnalyzed = 0;
    let commitsScanned = 0;

    if (!isGitRepo(projectRoot)) {
      if (!isInsideGitRepo(projectRoot)) {
        return {
          scanner: 'git-hygiene',
          findings: [
            {
              type: 'git-hygiene-warning',
              path: projectRoot,
              reason: 'Not a git repository — skipping git hygiene scan',
              severity: 'low',
              confidence: 'high',
              action: 'initialize-git',
            },
          ],
          summary: {
            isGitRepo: false,
            sensitiveFiles: 0,
            largeFiles: 0,
            largeBlobs: 0,
            suspiciousCommits: 0,
            commitsScanned: 0,
            filesAnalyzed: 0,
          },
        };
      }
      return {
        scanner: 'git-hygiene',
        findings: [],
        summary: {
          isGitRepo: false,
          insideGitRepo: true,
          sensitiveFiles: 0,
          largeFiles: 0,
          largeBlobs: 0,
          suspiciousCommits: 0,
          commitsScanned: 0,
          filesAnalyzed: 0,
        },
      };
    }

    const inventory = options.inventory || (await walkProjectFiles(projectRoot, options));
    const trackedFiles = getGitTrackedFiles(projectRoot);
    const trackedSet = new Set(trackedFiles);

    for (const file of inventory.files) {
      filesAnalyzed++;
      const isTracked = trackedSet.has(file.relativePath.replace(/\\/g, '/'));
      if (!isTracked) continue;

      if (isSensitiveFile(file.relativePath)) {
        const relPath = file.relativePath.replace(/\\/g, '/');
        if (!this.excludedPaths.has(relPath)) {
          findings.push({
            type: 'git-sensitive-file',
            path: file.relativePath,
            reason: `Sensitive file pattern detected in version control`,
            severity: 'high',
            confidence: 'high',
            action: 'remove-from-git-and-add-to-gitignore',
            metadata: { size: file.size },
          });
        }
      }

      if (file.size >= this.largeFileThreshold) {
        const relNorm = file.relativePath.replace(/\\/g, '/');
        if (/\.wasm$/i.test(relNorm)) continue; // Tree-sitter grammar files are legitimately large binaries
        findings.push({
          type: 'git-large-file',
          path: file.relativePath,
          reason: `Large file (${(file.size / 1024 / 1024).toFixed(1)}MB) in version control`,
          severity: 'medium',
          confidence: 'high',
          action: 'migrate-to-git-lfs',
          metadata: { sizeBytes: file.size },
        });
      }
    }

    const largeBlobs = getLargeBlobs(projectRoot, this.largeBlobThreshold);
    for (const blob of largeBlobs) {
      if (!blob.path) continue;
      findings.push({
        type: 'git-large-blob',
        path: blob.path,
        reason: `Large blob (${(blob.size / 1024 / 1024).toFixed(1)}MB) in git history`,
        severity: 'medium',
        confidence: 'high',
        action: 'rewrite-history-to-remove-blob',
        metadata: { blobHash: blob.hash, sizeBytes: blob.size },
      });
    }

    const commits = getRecentCommits(projectRoot, this.maxCommits);
    commitsScanned = commits.length;
    for (const commit of commits) {
      const text = `${commit.subject}\n${commit.body}`;
      for (const pattern of COMMIT_SENSITIVE_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(text)) {
          if (!this.excludedCommitHashes.has(commit.hash.toLowerCase())) {
            findings.push({
              type: 'git-sensitive-commit',
              path: commit.hash.slice(0, 8),
              reason: `Potentially sensitive data in commit message`,
              severity: 'high',
              confidence: 'low',
              action: 'review-commit-and-amend-if-needed',
              metadata: { commitHash: commit.hash, subject: commit.subject.slice(0, 60) },
            });
          }
          break;
        }
      }
    }

    return {
      scanner: 'git-hygiene',
      findings,
      summary: {
        isGitRepo: true,
        sensitiveFiles: findings.filter((f) => f.type === 'git-sensitive-file').length,
        largeFiles: findings.filter((f) => f.type === 'git-large-file').length,
        largeBlobs: findings.filter((f) => f.type === 'git-large-blob').length,
        suspiciousCommits: findings.filter((f) => f.type === 'git-sensitive-commit').length,
        commitsScanned,
        filesAnalyzed,
      },
    };
  }
}

module.exports = { GitHygieneScanner };
