/**
 * IDE opt-in team telemetry — anonymized scan summaries for paid/team tiers.
 * Mirrors packages/simplebeacon-cli/src/lib/ci-telemetry.js payload shape.
 * Never transmits source code, file paths, or full reports.
 */

import * as crypto from 'crypto';
import * as http from 'http';
import * as https from 'https';
import * as vscode from 'vscode';
import { getAuthManager } from './auth/authContext';
import { validateLicenseLocally } from './licenseManager';
import { PUBLIC_KEY_PEM } from './realtimeMonitor';
import { isPaidTier, resolveTier } from './tierConstants';
import { getSbConfig } from './utils/vscode';

const DEFAULT_TELEMETRY_URL = 'https://simplebeacon.ai/api/simplebeacon/ci/telemetry';
const TELEMETRY_POST_TIMEOUT_MS = 3000;
const PROMPT_DISMISSED_KEY = 'simplebeacon.teamTelemetry.promptDismissed';

const ERROR_TYPE_CATEGORIES: Record<string, string> = {
  'Schema Violation': 'schema',
  'Invalid JSON': 'syntax',
  'Empty File': 'data-quality',
  'Duplicate Data': 'data-quality',
  'Production Path Leak': 'security',
  'Credential Pattern': 'security',
  'Fiction KPI': 'ai-quality',
  'LLM Slop': 'ai-quality',
  'EU AI Act Risk': 'compliance',
  'Agency Handoff Marker': 'ai-quality',
  'Jest Baseline Failure': 'testing',
  'Sample Consistency Failure': 'data-quality',
  'Roadmap Schema Violation': 'schema',
  'Oversized Roadmap File': 'data-quality',
  'Legacy Fiction Roadmap': 'data-quality',
};

export interface TeamTelemetryReport {
  gate?: { pass?: boolean; blockingCount?: number };
  severityCounts?: Record<string, number>;
  qualityScore?: number | null;
  totalFiles?: number;
  filesAnalyzed?: number;
  projectRoot?: string;
  scanScope?: { diffOnly?: boolean; diffFileCount?: number; rulesEnabled?: string[] };
  rawIssues?: Array<{ type?: string; severity?: string; severityBand?: string; count?: number }>;
  detectedIssues?: Array<{ type?: string; severity?: string; severityBand?: string; count?: number }>;
  categoryCounts?: Record<string, number>;
  aggregate?: { byCategory?: Record<string, number> };
}

interface LicenseInfo {
  paid: boolean;
  tier: string;
  token: string;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(Buffer.from(base64 + pad, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function buildRepoFingerprint(projectRoot: string): string {
  const salt = process.env.SIMPLEBEACON_ANON_SALT || 'simplebeacon-anon-v1';
  return crypto
    .createHash('sha256')
    .update(`${salt}:${String(projectRoot || '').replace(/\\/g, '/')}`)
    .digest('hex')
    .slice(0, 24);
}

function buildRulesFingerprint(scanScope: { rulesEnabled?: string[] } = {}): string {
  const rules = Array.isArray(scanScope.rulesEnabled) ? scanScope.rulesEnabled : [];
  return crypto
    .createHash('sha256')
    .update([...rules].sort().join('|'))
    .digest('hex')
    .slice(0, 16);
}

function buildSeverityRollup(report: TeamTelemetryReport): Record<string, number> {
  const counts = report.severityCounts || {};
  return {
    critical: Number(counts.critical || 0),
    high: Number(counts.high || 0),
    medium: Number(counts.medium || 0),
    low: Number(counts.low || 0),
  };
}

function resolveIssueCategory(issueType: string): string {
  const normalized = String(issueType || '').trim();
  if (ERROR_TYPE_CATEGORIES[normalized]) {
    return ERROR_TYPE_CATEGORIES[normalized];
  }
  return 'unknown';
}

function buildCategoryRollup(report: TeamTelemetryReport): Record<string, number> {
  const rawIssues = report.rawIssues || report.detectedIssues || [];
  if (rawIssues.length > 0) {
    const byCategory: Record<string, number> = {};
    for (const issue of rawIssues) {
      const category = resolveIssueCategory(issue.type || '');
      const count = issue.count || 1;
      byCategory[category] = (byCategory[category] || 0) + count;
    }
    return byCategory;
  }
  if (report.categoryCounts && typeof report.categoryCounts === 'object') {
    return { ...report.categoryCounts };
  }
  if (report.aggregate?.byCategory && typeof report.aggregate.byCategory === 'object') {
    return { ...report.aggregate.byCategory };
  }
  return {};
}

/** Build anonymized team_scan payload matching CLI buildCiTelemetryPayload. */
export function buildIdeTeamTelemetryPayload(
  report: TeamTelemetryReport,
  license: LicenseInfo,
  projectRoot: string
): Record<string, unknown> {
  const gate = report.gate || {};
  const counts = report.severityCounts || {};
  const gateFailed = gate.pass === false || (gate.blockingCount || 0) > 0;

  const payload: Record<string, unknown> = {
    event: 'team_scan',
    timestamp: new Date().toISOString(),
    tier: license.tier || 'developer',
    scan_source: 'ide',
    gate_pass: !gateFailed,
    gates_tripped: gateFailed ? 1 : 0,
    blocking_count: gate.blockingCount || 0,
    critical_blocked: counts.critical || 0,
    high_blocked: counts.high || 0,
    medium_count: counts.medium || 0,
    files_scanned: report.totalFiles || report.filesAnalyzed || 0,
    diff_only: Boolean(report.scanScope?.diffOnly),
    diff_files: report.scanScope?.diffFileCount || 0,
    quality_score: report.qualityScore ?? null,
    severity_rollup: buildSeverityRollup(report),
    category_rollup: buildCategoryRollup(report),
  };

  if (projectRoot) {
    payload.workspace_fingerprint = buildRepoFingerprint(projectRoot);
  }

  const rulesFingerprint = buildRulesFingerprint(report.scanScope || {});
  if (rulesFingerprint) {
    payload.rules_fingerprint = rulesFingerprint;
  }

  return payload;
}

async function resolveLicenseForTelemetry(context: vscode.ExtensionContext): Promise<LicenseInfo | null> {
  const config = getSbConfig();
  let tier = 'developer';
  let token = '';

  const licenseToken = config.get<string>('licenseKey', '') || config.get<string>('licenseToken', '');
  if (licenseToken) {
    const meta = validateLicenseLocally(licenseToken, PUBLIC_KEY_PEM);
    if (meta) {
      tier = resolveTier(meta.tier);
      if (isPaidTier(tier)) {
        return { paid: true, tier, token: licenseToken };
      }
    }
  }

  try {
    token = (await getAuthManager().getToken()) || '';
  } catch {
    /* auth manager may not be initialized */
  }

  if (!token) {
    token = config.get<string>('apiToken', '') || context.globalState.get<string>('simplebeacon.apiToken', '') || '';
  }

  if (!token) {
    return null;
  }

  const payload = decodeJwtPayload(token);
  if (payload) {
    if (payload.exp && Number(payload.exp) * 1000 < Date.now()) {
      return null;
    }
    const user = payload.user as Record<string, unknown> | undefined;
    const data = payload.data as Record<string, unknown> | undefined;
    const account = payload.account as Record<string, unknown> | undefined;
    const subscription = payload.subscription as Record<string, unknown> | undefined;
    const rawTier = String(
      payload.tier ||
        payload.plan ||
        payload.product ||
        payload.role ||
        user?.tier ||
        user?.plan ||
        data?.tier ||
        data?.plan ||
        account?.tier ||
        account?.plan ||
        subscription?.tier ||
        subscription?.plan ||
        ''
    ).toLowerCase();
    tier = resolveTier(rawTier);
    if (isPaidTier(tier)) {
      return { paid: true, tier, token };
    }
  }

  return null;
}

function resolveTelemetryUrl(): string {
  const config = getSbConfig();
  const apiUrl = config.get<string>('apiUrl', '') || config.get<string>('apiServerUrl', '');
  if (apiUrl) {
    return apiUrl.replace(/\/+$/, '') + '/api/simplebeacon/ci/telemetry';
  }
  return DEFAULT_TELEMETRY_URL;
}

function postTelemetryPayload(
  url: string,
  payload: Record<string, unknown>,
  token: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  return new Promise((resolve) => {
    try {
      const body = JSON.stringify(payload);
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request(
        parsed,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            'Content-Length': String(Buffer.byteLength(body)),
          },
          timeout: TELEMETRY_POST_TIMEOUT_MS,
        },
        (res) => {
          let respBody = '';
          res.on('data', (chunk: Buffer) => {
            respBody += chunk.toString();
          });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ ok: true });
            } else {
              resolve({
                ok: false,
                status: res.statusCode,
                error: respBody.slice(0, 200),
              });
            }
          });
        }
      );
      req.on('error', (err: Error) => {
        resolve({ ok: false, error: err.message });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, error: 'timeout' });
      });
      req.write(body);
      req.end();
    } catch (err) {
      resolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
}

const PROMPT_TEXT =
  'Help your team track gate pass rates and quality trends? SimpleBeacon can send anonymized scan summaries (no source code or file paths). You can change this anytime in Settings.';

/** One-time opt-in prompt for paid/team users after first successful scan. */
export async function maybeShowTeamTelemetryPrompt(context: vscode.ExtensionContext): Promise<void> {
  const config = getSbConfig();
  if (config.get<boolean>('teamTelemetry.enabled', false)) {
    return;
  }
  if (context.globalState.get<boolean>(PROMPT_DISMISSED_KEY, false)) {
    return;
  }
  if (config.get<boolean>('offlineMode', false)) {
    return;
  }

  const license = await resolveLicenseForTelemetry(context);
  if (!license?.paid) {
    return;
  }

  const choice = await vscode.window.showInformationMessage(PROMPT_TEXT, 'Enable team telemetry', 'Not now');
  await context.globalState.update(PROMPT_DISMISSED_KEY, true);
  if (choice === 'Enable team telemetry') {
    await config.update('teamTelemetry.enabled', true, vscode.ConfigurationTarget.Global);
  }
}

/** Post anonymized team telemetry after scan when opted in. Non-blocking. */
export async function postIdeTeamTelemetry(
  context: vscode.ExtensionContext,
  report: TeamTelemetryReport,
  projectPath: string,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  try {
    const config = getSbConfig();
    if (!config.get<boolean>('teamTelemetry.enabled', false)) {
      return;
    }
    if (config.get<boolean>('offlineMode', false)) {
      return;
    }

    const license = await resolveLicenseForTelemetry(context);
    if (!license?.paid || !license.token) {
      return;
    }

    const payload = buildIdeTeamTelemetryPayload(report, license, projectPath);
    const url = resolveTelemetryUrl();
    const result = await postTelemetryPayload(url, payload, license.token);

    if (result.ok) {
      outputChannel.appendLine('[SimpleBeacon] Team telemetry recorded.');
    } else {
      const detail = result.error?.includes('timeout')
        ? 'timed out'
        : result.status
          ? `HTTP ${result.status}`
          : result.error || 'network error';
      outputChannel.appendLine(`[SimpleBeacon] Warning: Team telemetry ${detail}.`);
    }
  } catch (err) {
    outputChannel.appendLine(
      `[SimpleBeacon] Warning: Team telemetry failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/** Orchestrate opt-in prompt and telemetry POST after successful scan. */
export function handleScanCompleteTeamTelemetry(
  context: vscode.ExtensionContext,
  report: TeamTelemetryReport,
  projectPath: string,
  outputChannel: vscode.OutputChannel
): void {
  void maybeShowTeamTelemetryPrompt(context);
  void postIdeTeamTelemetry(context, report, projectPath, outputChannel);
}
