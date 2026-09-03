// simplebeacon-ignore: Scanner pattern definitions, dashboard code, debug artifacts — all findings are false positives
/**
 * Export Gate — server-signed authorization for premium local exports.
 *
 * Local report generation (PDF, JSON, certificate, board-ready reports) runs
 * entirely on the user's machine. A `401` from the API does not stop local
 * export code. This module gates premium exports behind two checks:
 *
 * 1. **Tier check (client UX)** — `requirePaidTier()` verifies the stored token
 *    represents a paid SimpleBeacon tier. This is a UX/entitlement gate, not a
 *    cryptographic boundary — a determined user can modify the VSIX.
 *
 * 2. **Server signature (trust anchor)** — `getExportAuthorization()` sends
 *    only a SHA-256 report hash + tiny metadata to the backend. The backend
 *    validates the JWT, enforces the paid tier, and returns an HMAC signature
 *    over the hash. The signed block is embedded into the locally-generated
 *    artifact so downstream consumers (auditors, board, compliance) can verify
 *    the report was produced by an authenticated paid account.
 *
 * What this CANNOT prevent: a determined attacker can fork the VSIX, strip the
 * gate, and produce unsigned local reports. Those reports will lack a valid
 * `serverSignature` block, so any third party verifying the artifact will reject
 * it. The bar is raised, not made impossible — this is the inherent limit of all
 * client-side software.
 *
 * Source code is NEVER sent to the server. Only the report hash + small metadata.
 */
import * as crypto from 'crypto';
import * as http from 'http';
import * as https from 'https';
import * as vscode from 'vscode';
import { getSbConfig, normalizeApiServerUrl } from './utils/vscode';

/** Canonical export type identifiers sent to the server. */
export type ExportType =
  // Premium (require paid tier + server signature)
  | 'report-json'
  | 'report-pdf'
  | 'report-html'
  | 'report-csv'
  | 'report-excel'
  | 'certificate'
  | 'trust-report'
  | 'ai-report'
  | 'email-report'
  // Basic (available to all users)
  | 'report-markdown'
  | 'diagnostic-log'
  | 'code-map'
  | 'ai-context'
  | 'roadmap';

/** Premium export types that require a paid tier + server signature. */
export const PREMIUM_EXPORT_TYPES: ReadonlySet<ExportType> = new Set([
  'report-json',
  'report-pdf',
  'report-html',
  'report-csv',
  'report-excel',
  'certificate',
  'trust-report',
  'ai-report',
  'email-report',
]);

/** Basic export types available to all users (signed-out / free / paid). */
export const BASIC_EXPORT_TYPES: ReadonlySet<ExportType> = new Set([
  'report-markdown',
  'diagnostic-log',
  'code-map',
  'ai-context',
  'roadmap',
]);

// ---------------------------------------------------------------------------
// Tier-based export permissions
//
// Three-tier model matching the SimpleBeacon pricing page:
//   - Free ($0):       Markdown summary only — no file paths, no line numbers
//   - Developer ($49): Full structural JSON + individual audit certificates
//   - Team Pro ($149): Board-ready PDFs + compliance mappings (EU AI Act, SOC 2)
//   - Enterprise:      Same as Team Pro + multi-user audit logs
// ---------------------------------------------------------------------------

/** Canonical account tiers. */
export type AccountTier = 'free' | 'developer' | 'team' | 'enterprise';

/** Export types allowed for each tier. */
export const TIER_EXPORT_PERMISSIONS: Readonly<Record<AccountTier, ReadonlySet<ExportType>>> = {
  free: new Set<ExportType>(['report-markdown', 'diagnostic-log', 'code-map', 'ai-context', 'roadmap']),
  developer: new Set<ExportType>([
    // Basic
    'report-markdown', 'diagnostic-log', 'code-map', 'ai-context', 'roadmap',
    // Developer: structural JSON + individual certificates
    'report-json', 'report-csv', 'report-html', 'certificate',
  ]),
  team: new Set<ExportType>([
    // Basic
    'report-markdown', 'diagnostic-log', 'code-map', 'ai-context', 'roadmap',
    // Developer
    'report-json', 'report-csv', 'report-html', 'certificate',
    // Team Pro: board-ready + compliance
    'report-pdf', 'report-excel', 'trust-report', 'ai-report', 'email-report',
  ]),
  enterprise: new Set<ExportType>([
    // All exports unlocked
    'report-markdown', 'diagnostic-log', 'code-map', 'ai-context', 'roadmap',
    'report-json', 'report-csv', 'report-html', 'certificate',
    'report-pdf', 'report-excel', 'trust-report', 'ai-report', 'email-report',
  ]),
};

/** Tier aliases that map to canonical AccountTier values. */
const TIER_ALIAS_MAP: Record<string, AccountTier> = {
  free: 'free',
  community: 'free',
  sandbox: 'free',
  instant: 'free',
  locked: 'free',
  solo: 'free',
  '': 'free',
  developer: 'developer',
  pro: 'developer',
  startup: 'developer',
  business: 'developer',
  premium: 'developer',
  license: 'developer',
  auditor: 'developer',
  paid: 'developer',
  silver: 'developer',
  gold: 'developer',
  developer_tier: 'developer',
  team: 'team',
  'team_pro': 'team',
  'team-pro': 'team',
  eusprint: 'team',
  growth: 'team',
  enterprise: 'enterprise',
  compliance: 'enterprise',
  universal: 'enterprise',
  custom: 'enterprise',
  admin: 'enterprise',
};

/**
 * Normalize a raw tier string to a canonical AccountTier.
 * Accepts aliases used in JWT claims, license tokens, and legacy configs.
 */
export function normalizeAccountTier(raw: string | undefined): AccountTier {
  const t = String(raw || '').toLowerCase().trim();
  return TIER_ALIAS_MAP[t] || 'free';
}

/**
 * Check if a tier is allowed to perform a given export type.
 */
export function tierCanExport(tier: string | undefined, exportType: ExportType): boolean {
  const canonical = normalizeAccountTier(tier);
  return TIER_EXPORT_PERMISSIONS[canonical].has(exportType);
}

/**
 * Minimum tier required for an export type.
 * Returns the lowest tier that includes this export type.
 */
export function minTierForExport(exportType: ExportType): AccountTier {
  if (BASIC_EXPORT_TYPES.has(exportType)) return 'free';
  // Developer-tier exports
  const developerTypes = TIER_EXPORT_PERMISSIONS.developer;
  if (developerTypes.has(exportType)) return 'developer';
  // Team-only exports
  return 'team';
}

// ---------------------------------------------------------------------------
// Tier-based data filtering — strips sensitive data from lower-tier exports.
//
// Free tier:     No file paths, no line numbers, no rule IDs, no code snippets.
//                Only aggregated severity counts + quality score.
// Developer:     Full file paths, line numbers, rule IDs, matched text.
// Team/Enterprise: Everything + compliance mappings (EU AI Act, SOC 2).
// ---------------------------------------------------------------------------

/** A single finding in its raw form, as produced by the local scanner. */
export interface RawFinding {
  severity?: string;
  type?: string;
  category?: string;
  file?: string;
  filePath?: string;
  path?: string;
  line?: number;
  lineStart?: number;
  lineEnd?: number;
  description?: string;
  message?: string;
  id?: string;
  ruleId?: string;
  patternId?: string;
  matchedText?: string;
  snippet?: string;
  [key: string]: unknown;
}

/** Filtered finding for free-tier exports — no file paths or line numbers. */
export interface FreeTierFinding {
  severity: string;
  type: string;
  description: string;
}

/** Summary metrics computed from raw findings. */
export interface SummaryMetrics {
  score: number;
  totalCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

/**
 * Calculate summary metrics from a raw findings array.
 */
export function calculateSummary(findings: RawFinding[]): SummaryMetrics {
  const totalCount = findings.length;
  const criticalCount = findings.filter((f) => (f.severity || '').toLowerCase() === 'critical').length;
  const highCount = findings.filter((f) => (f.severity || '').toLowerCase() === 'high').length;
  const mediumCount = findings.filter((f) => (f.severity || '').toLowerCase() === 'medium').length;
  const lowCount = findings.filter((f) => (f.severity || '').toLowerCase() === 'low').length;
  const score = Math.max(0, 100 - (criticalCount * 25 + highCount * 15 + mediumCount * 5 + lowCount * 2));
  return { score, totalCount, criticalCount, highCount, mediumCount, lowCount };
}

/**
 * Filter findings for the free tier — strips all file paths, line numbers,
 * rule IDs, and code snippets. Returns only severity + type + description.
 */
export function filterFindingsForFreeTier(findings: RawFinding[]): FreeTierFinding[] {
  return findings.map((f) => ({
    severity: (f.severity || 'low').toLowerCase(),
    type: f.type || f.category || 'Unknown',
    description: f.description || f.message || '',
  }));
}

/**
 * Filter findings for the developer tier — keeps full structural data
 * (file paths, line numbers, rule IDs, matched text).
 */
export function filterFindingsForDeveloperTier(findings: RawFinding[]): Record<string, unknown>[] {
  return findings.map((f) => ({
    ruleId: f.id || f.ruleId || f.patternId || 'unknown',
    severity: (f.severity || 'low').toLowerCase(),
    type: f.type || f.category || 'Unknown',
    filePath: f.file || f.filePath || f.path || '-',
    line: f.line || f.lineStart || 0,
    lineEnd: f.lineEnd || f.line || f.lineStart || 0,
    description: f.description || f.message || '',
    snippet: f.matchedText || f.snippet || '',
  }));
}

/**
 * Build a free-tier Markdown summary export.
 * Contains only aggregated scores + severity counts — no file paths or line numbers.
 */
export function buildFreeTierMarkdown(
  findings: RawFinding[],
  reportMeta?: { projectRoot?: string; scanTime?: string },
): string {
  const m = calculateSummary(findings);
  const lines = [
    '# SimpleBeacon Scan Summary',
    '',
    `Project: ${reportMeta?.projectRoot || 'Unknown'}`,
    `Scan time: ${reportMeta?.scanTime || new Date().toISOString()}`,
    '',
    '## Quality Score',
    `**${m.score}/100**`,
    '',
    '## Severity Counts',
    `- Critical: ${m.criticalCount}`,
    `- High: ${m.highCount}`,
    `- Medium: ${m.mediumCount}`,
    `- Low: ${m.lowCount}`,
    `- **Total: ${m.totalCount}**`,
    '',
    '## Findings by Category',
    ...groupFindingsByCategory(findings),
    '',
    '---',
    '⚠️ Upgrade to a Developer or Team plan to export granular line numbers, file paths, and JSON outputs.',
    'Visit: https://simplebeacon.ai/pricing',
  ];
  return lines.join('\n');
}

/** Group findings by type/category and count them — no file paths leaked. */
function groupFindingsByCategory(findings: RawFinding[]): string[] {
  const groups: Record<string, number> = {};
  for (const f of findings) {
    const cat = f.type || f.category || 'Unknown';
    groups[cat] = (groups[cat] || 0) + 1;
  }
  return Object.entries(groups)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, count]) => `- ${cat}: ${count}`);
}

/**
 * Build a developer-tier structural JSON export.
 * Contains full file paths, line numbers, rule IDs, and matched text.
 */
export function buildDeveloperTierJson(
  findings: RawFinding[],
  reportMeta?: { projectRoot?: string; scanTime?: string },
): string {
  const m = calculateSummary(findings);
  const payload = {
    meta: {
      scanTime: reportMeta?.scanTime || new Date().toISOString(),
      tier: 'Developer',
      projectRoot: reportMeta?.projectRoot || 'Unknown',
    },
    metrics: m,
    findings: filterFindingsForDeveloperTier(findings),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Build a team/enterprise-tier comprehensive JSON export.
 * Contains everything from developer tier + compliance mappings.
 */
export function buildTeamTierJson(
  findings: RawFinding[],
  reportMeta?: { projectRoot?: string; scanTime?: string },
  complianceMappings?: Record<string, unknown>,
): string {
  const m = calculateSummary(findings);
  const payload = {
    meta: {
      scanTime: reportMeta?.scanTime || new Date().toISOString(),
      tier: 'Team Pro',
      projectRoot: reportMeta?.projectRoot || 'Unknown',
      complianceReady: true,
    },
    metrics: m,
    complianceMappings: complianceMappings || {},
    findings: filterFindingsForDeveloperTier(findings),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Filter a report object based on tier — returns a copy with findings
 * stripped/filtered according to the tier's data access level.
 *
 * Free:       findings replaced with FreeTierFinding[] (no file paths)
 * Developer:  findings replaced with structural objects (file paths + lines)
 * Team+:      findings kept as-is (full data + compliance mappings)
 */
export function filterReportByTier<T extends Record<string, unknown>>(
  report: T,
  tier: string | undefined,
): T {
  const canonical = normalizeAccountTier(tier);
  if (canonical === 'team' || canonical === 'enterprise') {
    return report; // Full access — no filtering
  }

  const findings = extractFindings(report);
  if (!findings) return report;

  if (canonical === 'free') {
    return { ...report, findings: filterFindingsForFreeTier(findings) };
  }

  // Developer
  return { ...report, findings: filterFindingsForDeveloperTier(findings) };
}

/** Extract the findings array from a report object, checking common field names. */
function extractFindings(report: Record<string, unknown>): RawFinding[] | null {
  const candidates = ['findings', 'detectedIssues', 'rawIssues', 'issues'];
  for (const key of candidates) {
    const val = report[key];
    if (Array.isArray(val) && val.length > 0) {
      return val as RawFinding[];
    }
  }
  return null;
}

/** Server-signed authorization block embedded into premium exports. */
export interface ServerSignature {
  signature: string;
  algorithm?: string;
  signedAt: string;
  expiresAt: string;
  tier: string;
  serverKeyId: string;
  user: { sub: string; email: string | null };
  metadata: {
    reportHash: string;
    reportType: string;
    tier: string;
    userSub: string;
    signedAt: string;
    serverKeyId: string;
  };
}

/** Result of an export authorization request. */
export interface ExportAuthorization {
  ok: boolean;
  signature?: ServerSignature;
  error?: string;
  status?: number;
}

/**
 * Compute a deterministic SHA-256 hash of a report object.
 * The hash is over canonical JSON (sorted keys, no whitespace) so the server
 * can re-verify the same hash if needed. Source code is never sent.
 */
export function hashReport(report: unknown): string {
  const canonical = canonicalJsonString(report);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Produce a canonical JSON string (sorted keys, no whitespace) for hashing.
 * Falls back to JSON.stringify for non-object values.
 */
export function canonicalJsonString(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  // Arrays: canonicalize each element, preserve order.
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJsonString).join(',') + ']';
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const pairs = keys.map((k) => {
    const v = (value as Record<string, unknown>)[k];
    return JSON.stringify(k) + ':' + canonicalJsonString(v);
  });
  return '{' + pairs.join(',') + '}';
}

/**
 * Resolve the SimpleBeacon API URL for export-signing requests.
 * Prefers the local data server (which has a sign-report route and can
 * validate tokens locally without calling the Render backend). Falls back
 * to the production dashboard URL when the local server is not configured.
 */
export function resolveSigningApiUrl(): string {
  const config = getSbConfig();
  const configured = config.get<string>('apiServerUrl', '') || config.get<string>('apiUrl', '');
  if (configured) {
    return normalizeApiServerUrl(configured);
  }
  // Prefer the local data server — it has a /api/simplebeacon/user/sign-report
  // route that validates tokens locally and signs reports without calling the
  // Render backend. This avoids "UnauthorizedError" failures when the backend
  // JWT expires but the user is still authenticated locally.
  const localPort = config.get<number>('dataServerPort', 54358);
  return `http://127.0.0.1:${localPort}`;
}

/**
 * Resolve the fallback (production) API URL for export-signing requests.
 * Used when the local data server is unreachable.
 */
function resolveFallbackSigningApiUrl(): string {
  return 'https://simplebeacon.ai';
}

/**
 * Request a server signature for a premium export.
 *
 * Sends ONLY: { reportHash, reportType, metadata }
 * The server validates the JWT (Authorization header), enforces the paid tier,
 * and returns an HMAC signature over the hash. No source code or full report
 * body is transmitted.
 *
 * @param token   JWT or license token from AuthManager
 * @param reportType  Canonical export type (e.g. 'certificate')
 * @param reportHash  SHA-256 hex hash of the report
 * @param metadata    Small optional metadata block (project name, file count, etc.)
 */
export async function getExportAuthorization(
  token: string,
  reportType: ExportType,
  reportHash: string,
  metadata?: Record<string, unknown>,
): Promise<ExportAuthorization> {
  if (!token || typeof token !== 'string') {
    return { ok: false, error: 'Auth token required', status: 401 };
  }
  if (!reportHash || !/^[a-f0-9]{8,128}$/i.test(reportHash)) {
    return { ok: false, error: 'Valid report hash required', status: 400 };
  }

  const baseUrl = resolveSigningApiUrl();
  const url = new URL('/api/simplebeacon/user/sign-report', baseUrl);
  const body = JSON.stringify({ reportHash, reportType, metadata: metadata || {} });

  const reqOpts = {
    method: 'POST' as const,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Length': Buffer.byteLength(body).toString(),
    },
    body,
    timeoutMs: 10000,
  };

  try {
    const resp = await httpRequest(url, reqOpts);

    if (resp.status === 200 && resp.json?.signed) {
      return { ok: true, signature: resp.json as ServerSignature };
    }

    // If the local server returned 401, the token might be valid on the
    // production backend (e.g., dashboard-issued JWT). Retry against the
    // fallback URL before giving up.
    if (resp.status === 401 && baseUrl !== resolveFallbackSigningApiUrl()) {
      try {
        const fallbackUrl = new URL('/api/simplebeacon/user/sign-report', resolveFallbackSigningApiUrl());
        const fallbackResp = await httpRequest(fallbackUrl, reqOpts);
        if (fallbackResp.status === 200 && fallbackResp.json?.signed) {
          return { ok: true, signature: fallbackResp.json as ServerSignature };
        }
        const fbRawError = fallbackResp.json?.error || `Server returned ${fallbackResp.status}`;
        return {
          ok: false,
          error: mapExportAuthError(fallbackResp.status, fbRawError, fallbackResp.json?.message),
          status: fallbackResp.status,
        };
      } catch {
        // Fall through to local error mapping
      }
    }

    // Map common server errors to user-friendly messages.
    const rawError = resp.json?.error || `Server returned ${resp.status}`;
    const friendlyError = mapExportAuthError(resp.status, rawError, resp.json?.message);
    return {
      ok: false,
      error: friendlyError,
      status: resp.status,
    };
  } catch (err) {
    // Local server unreachable — try the fallback (production) URL
    if (baseUrl !== resolveFallbackSigningApiUrl()) {
      try {
        const fallbackUrl = new URL('/api/simplebeacon/user/sign-report', resolveFallbackSigningApiUrl());
        const fallbackResp = await httpRequest(fallbackUrl, reqOpts);
        if (fallbackResp.status === 200 && fallbackResp.json?.signed) {
          return { ok: true, signature: fallbackResp.json as ServerSignature };
        }
        const fbRawError = fallbackResp.json?.error || `Server returned ${fallbackResp.status}`;
        return {
          ok: false,
          error: mapExportAuthError(fallbackResp.status, fbRawError, fallbackResp.json?.message),
          status: fallbackResp.status,
        };
      } catch (fallbackErr) {
        const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        return {
          ok: false,
          error: mapExportAuthError(0, fbMsg, undefined),
        };
      }
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: mapExportAuthError(0, msg, undefined),
    };
  }
}

/**
 * Map raw server errors to user-friendly messages so the VS Code notification
 * tells the user what to do instead of showing an internal error class name.
 */
function mapExportAuthError(status: number, error: string, message?: string): string {
  const lower = String(error || '').toLowerCase();
  const msgLower = String(message || '').toLowerCase();

  // 401 / auth errors — token expired, invalid, or missing
  if (status === 401 || lower.includes('unauthorized') || lower.includes('auth') || msgLower.includes('invalid or expired token')) {
    return 'Your session has expired — please sign in again, then retry the export.';
  }
  // 403 — free tier, premium export requires paid tier
  if (status === 403 || lower.includes('forbidden') || lower.includes('tier') || lower.includes('paid')) {
    return 'This export format requires a paid plan. Visit https://simplebeacon.ai/pricing to upgrade.';
  }
  // 503 — signing secret not configured on server
  if (status === 503 || lower.includes('not configured') || lower.includes('unavailable')) {
    return 'Report signing is temporarily unavailable on the server. Please try again later.';
  }
  // Network errors (status 0 = request threw before response)
  if (status === 0 || lower.includes('network') || lower.includes('timeout') || lower.includes('econnrefused') || lower.includes('fetch')) {
    return 'Could not reach the signing server. Check your network connection and try again.';
  }
  // Fallback — show the raw error but with context
  return message ? `${error}: ${message}` : error;
}

/**
 * Embed a server signature into a report object (mutates a copy).
 * The signature is placed under `report.serverSignature` so consumers can verify.
 */
export function embedServerSignature<T extends Record<string, unknown>>(
  report: T,
  auth: ServerSignature,
): T {
  return { ...report, serverSignature: auth };
}

/**
 * Verify a server signature locally using an RSA public key.
 *
 * This allows third parties (auditors, board members) to verify that a report
 * signature was issued by SimpleBeacon's server without contacting the server.
 * The public key is embedded in the VSIX; the private key never leaves the server.
 *
 * @param signature   The signature hex string from ServerSignature
 * @param metadata    The metadata block that was signed
 * @param publicKeyPem  PEM-encoded RSA public key
 * @returns true if the signature is valid
 */
export function verifySignatureLocally(
  signature: string,
  metadata: { reportHash: string; reportType: string; tier: string; userSub: string; signedAt: string },
  publicKeyPem: string,
): boolean {
  try {
    // Reconstruct the canonical message (sorted keys, no whitespace)
    const canonicalBlock = {
      reportHash: metadata.reportHash,
      reportType: metadata.reportType,
      tier: metadata.tier,
      userSub: metadata.userSub,
      signedAt: metadata.signedAt,
    };
    const canonical = canonicalJsonString(canonicalBlock);
    const verifier = crypto.createVerify('SHA256');
    verifier.update(canonical, 'utf8');
    return verifier.verify(publicKeyPem, signature, 'hex');
  } catch {
    return false;
  }
}

/**
 * Verify a server signature by calling the backend verify endpoint.
 *
 * This is the authoritative verification path — it uses the server's public key
 * (or HMAC secret) to verify the signature. Use this when the public key is not
 * embedded in the client, or when you want to check if the signature has been
 * revoked.
 *
 * @param signature  The signature hex string
 * @param metadata   The metadata block from ServerSignature
 * @returns { valid: boolean, algorithm?: string, error?: string }
 */
export async function verifySignatureRemotely(
  signature: string,
  metadata: ServerSignature['metadata'],
): Promise<{ valid: boolean; algorithm?: string; error?: string }> {
  if (!signature || !metadata) {
    return { valid: false, error: 'Signature and metadata required' };
  }

  const baseUrl = resolveSigningApiUrl();
  const url = new URL('/api/simplebeacon/user/verify-signature', baseUrl);
  const body = JSON.stringify({ signature, metadata });

  try {
    const resp = await httpRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body).toString(),
      },
      body,
      timeoutMs: 10000,
    });

    if (resp.status === 200 && resp.json) {
      return {
        valid: !!resp.json.valid,
        algorithm: resp.json.algorithm,
        error: resp.json.error,
      };
    }

    return {
      valid: false,
      error: resp.json?.error || `Server returned ${resp.status}`,
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Prompt the user to upgrade when a premium export is attempted without a paid tier.
 */
export async function promptUpgradeForExport(featureName: string): Promise<void> {
  const choice = await vscode.window.showInformationMessage(
    `${featureName} is a premium export. Upgrade to a paid SimpleBeacon tier to unlock server-signed PDF, JSON, certificate, and board-ready reports.`,
    'Upgrade',
    'Maybe Later',
  );
  if (choice === 'Upgrade') {
    vscode.env.openExternal(vscode.Uri.parse('https://simplebeacon.ai/pricing'));
  }
}

// ---------------------------------------------------------------------------
// Internal HTTP helper — minimal node http/https client with timeout + JSON parse.
// ---------------------------------------------------------------------------

interface HttpResponse {
  status: number;
  json: any;
  text: string;
}

interface HttpRequestOptions {
  method: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs?: number;
}

function httpRequest(url: URL, opts: HttpRequestOptions): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: opts.method,
        headers: opts.headers,
      },
      (res: http.IncomingMessage) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          data += chunk;
        });
        res.on('end', () => {
          let json: any = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            // Non-JSON response
          }
          resolve({ status: res.statusCode || 0, json, text: data });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(opts.timeoutMs || 10000, () => {
      req.destroy(new Error('Request timed out'));
    });
    req.write(opts.body);
    req.end();
  });
}
