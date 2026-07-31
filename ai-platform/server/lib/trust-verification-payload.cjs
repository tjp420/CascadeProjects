/**
 * Build public trust verification payload from Simplebeacon reports.
 * Uses scoped metrics only — never conflates gate-pass on sample paths with full-repo cleanliness.
 */

const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { readJsonFileCached } = require('./json-file-cache.cjs');

const { buildRepositoryHealthPayload } = require('./repository-health-payload.cjs');
const { appendTrustSnapshot, resolveTrustHistoryPath } = require('./trust-history-store.cjs');

/**
 * Read json if exists.
 * @param {string} filePath
 * @returns {any}
 */
function readJsonIfExists(filePath) {
  return readJsonFileCached(filePath);
}

/**
 * Redact path.
 * @param {any} value
 * @returns {any}
 */
function redactPath(value) {
  const normalized = String(value || '').replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (/^[A-Za-z]:$/i.test(parts[0]) && parts.length > 1) {
    parts.shift();
  }
  if (parts.length <= 2) return parts.join('/') || 'project';
  return `…/${parts.slice(-2).join('/')}`;
}

/**
 * Build report snapshot.
 * @param {number} report
 * @param {any} label
 * @returns {any}
 */
function buildReportSnapshot(report, label) {
  if (!report || report.type !== 'simplebeacon-report') return null;

  const gatePass = report.gate?.pass ?? null;
  const issueCount =
    report.issueCount ??
    (report.rawIssues || report.detectedIssues || []).reduce((sum, i) => sum + (i.count || 1), 0);

  return {
    label,
    projectRoot: redactPath(report.projectRoot),
    platformRoot: report.platformRoot ? redactPath(report.platformRoot) : undefined,
    generatedAt: report.generatedAt || null,
    reportVersion: report.reportVersion ?? 1,
    gatePass,
    qualityScore: report.qualityScore ?? null,
    schemaCompliance: report.schemaCompliance ?? null,
    schemaChecked: report.schemaChecked ?? report.pageSampleSchemaChecked ?? null,
    schemaPassed: report.schemaPassed ?? report.pageSampleSchemaPassed ?? null,
    consistencyScore: report.consistencyScore ?? null,
    consistencyChecked: report.consistencyChecked ?? null,
    consistencyPassed: report.consistencyPassed ?? null,
    issueCount,
    severityCounts: report.severityCounts || { high: 0, medium: 0, low: 0 },
    repositoryFilesTotal:
      report.repositoryFilesTotal ?? report.repositoryInventory?.totalFiles ?? null,
    ruleScopedFilesAnalyzed: report.ruleScopedFilesAnalyzed ?? report.filesAnalyzed ?? null,
    mockSampleFiles: report.mockSampleFiles ?? report.totalFiles ?? null,
    fictionJsonFilesScanned:
      report.fictionJsonFilesScanned ?? report.scanScope?.fictionJsonFilesScanned ?? null,
    fictionSampleFilesScanned:
      report.fictionSampleFilesScanned ?? report.scanScope?.fictionSampleFilesScanned ?? null,
    fictionScope: report.fictionScope ?? report.scanScope?.fictionScope ?? null,
    rulesEnabled: report.scanScope?.rulesEnabled || [],
    profile: report.scanScope?.profile || report.configPath ? 'configured' : 'standard',
    scopeNote:
      report.scanScope?.limitations?.[0] ||
      'Gate rules apply to configured scanPaths and production directories — not every file in the repository tree.',
  };
}

/**
 * Build trust disclaimers.
 * @param {number} platformSnap
 * @param {any} monorepoSnap
 * @returns {any}
 */
function buildTrustDisclaimers(platformSnap, monorepoSnap) {
  const disclaimers = [
    'Quality score and zero-issue counts apply to configured gate rules and sample paths — not semantic review of every source file.',
    'Repository file totals are explorer-style inventory counts; gate rules checked is a smaller scoped subset.',
    'Publish both platform and monorepo snapshots when available — a PASS gate on sample JSON does not imply a clean monorepo fiction scan.',
  ];

  if (platformSnap?.gatePass && monorepoSnap && (monorepoSnap.issueCount ?? 0) > 0) {
    disclaimers.unshift(
      `Platform gate PASS (${platformSnap.issueCount ?? 0} issues) differs from monorepo scan (${monorepoSnap.issueCount} issues) — use monorepo metrics for full-tree honesty.`
    );
  }

  return disclaimers;
}

/**
 * Verification digest.
 * @param {any} payload
 * @returns {any}
 */
function verificationDigest(payload) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        platform: payload.platform?.generatedAt,
        monorepo: payload.monorepo?.generatedAt,
        issueCount: payload.platform?.issueCount,
        monorepoIssues: payload.monorepo?.issueCount,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

/**
 * Parse iso time.
 * @param {any} value
 * @returns {any}
 */
function parseIsoTime(value) {
  const ms = Date.parse(String(value || ''));
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Pick headline snapshot.
 * @param {any} platform
 * @param {any} monorepo
 * @returns {any}
 */
function pickHeadlineSnapshot(platform, monorepo) {
  if (!platform && !monorepo) {
    return { primary: null, source: null, reason: 'No trust snapshots available.' };
  }
  if (platform && !monorepo) {
    return {
      primary: platform,
      source: 'platform',
      reason: 'Only platform snapshot is available.',
    };
  }
  if (!platform && monorepo) {
    return {
      primary: monorepo,
      source: 'monorepo',
      reason: 'Only monorepo snapshot is available.',
    };
  }

  const platformIssues = platform.issueCount ?? 0;
  const monorepoIssues = monorepo.issueCount ?? 0;

  if (platformIssues > 0 || monorepoIssues > 0) {
    if (monorepoIssues > platformIssues) {
      return {
        primary: monorepo,
        source: 'monorepo',
        reason: `Monorepo scan has higher issue count (${monorepoIssues}) than platform (${platformIssues}).`,
      };
    }
    if (platformIssues > monorepoIssues) {
      return {
        primary: platform,
        source: 'platform',
        reason: `Platform scan has higher issue count (${platformIssues}) than monorepo (${monorepoIssues}).`,
      };
    }
  }

  const platformTime = parseIsoTime(platform.generatedAt);
  const monorepoTime = parseIsoTime(monorepo.generatedAt);
  if (monorepoTime > platformTime) {
    return { primary: monorepo, source: 'monorepo', reason: 'Monorepo snapshot is newer.' };
  }
  return {
    primary: platform,
    source: 'platform',
    reason: 'Platform snapshot is newer or equally recent.',
  };
}

/**
 * Build fiction scope note.
 * @param {any} snap
 * @returns {any}
 */
function buildFictionScopeNote(snap) {
  if (!snap) {
    return 'Fiction/KPI rules use fictionScope repository-json when enabled — walk root is ai-platform, not the monorepo parent inventory.';
  }
  const mode = snap.fictionScope || 'repository-json';
  const walkRoot = snap.platformRoot || snap.projectRoot || 'ai-platform';
  const jsonCount = snap.fictionJsonFilesScanned;
  const sampleCount = snap.fictionSampleFilesScanned ?? snap.mockSampleFiles;
  if (jsonCount == null) {
    return (
      'Fiction/KPI JSON scope (fictionScope ' +
      mode +
      '): recursive .json walk from ' +
      walkRoot +
      ' with config.ignore — see scan report for file counts.'
    );
  }
  const samplePart =
    sampleCount != null ? ' (' + sampleCount + ' dashboard mock JSON files among them)' : '';
  return (
    'Fiction/KPI JSON scope (fictionScope ' +
    mode +
    '): recursive walk from ' +
    walkRoot +
    ', .json at most 512KB, minus config.ignore — ' +
    jsonCount +
    ' JSON pattern-checked' +
    samplePart +
    '; explorer inventory totals are separate and much larger.'
  );
}

/**
 * Build fiction scope block.
 * @param {number} platformSnap
 * @param {any} monorepoSnap
 * @param {any} headlineSource
 * @returns {any}
 */
function buildFictionScopeBlock(platformSnap, monorepoSnap, headlineSource) {
  const primary = headlineSource === 'monorepo' ? monorepoSnap : platformSnap;
  const walkRoot = platformSnap?.platformRoot || platformSnap?.projectRoot || null;
  return {
    mode: primary?.fictionScope || 'repository-json',
    walkRoot,
    fictionJsonFilesScanned: primary?.fictionJsonFilesScanned ?? null,
    fictionSampleFilesScanned:
      primary?.fictionSampleFilesScanned ?? primary?.mockSampleFiles ?? null,
    platform: platformSnap
      ? {
          fictionJsonFilesScanned: platformSnap.fictionJsonFilesScanned,
          fictionSampleFilesScanned:
            platformSnap.fictionSampleFilesScanned ?? platformSnap.mockSampleFiles,
          fictionScope: platformSnap.fictionScope,
        }
      : null,
    monorepo: monorepoSnap
      ? {
          fictionJsonFilesScanned: monorepoSnap.fictionJsonFilesScanned,
          fictionSampleFilesScanned:
            monorepoSnap.fictionSampleFilesScanned ?? monorepoSnap.mockSampleFiles,
          fictionScope: monorepoSnap.fictionScope,
        }
      : null,
  };
}

/**
 * Build trust methodology.
 * @param {number} platformSnap
 * @param {any} monorepoSnap
 * @param {any} headlineSource
 * @returns {any}
 */
function buildTrustMethodology(platformSnap, monorepoSnap, headlineSource) {
  const primary = headlineSource === 'monorepo' ? monorepoSnap : platformSnap;
  return [
    'Simplebeacon runs deterministic pattern matching on configured mock/sample JSON, credentials, and production-path rules.',
    buildFictionScopeNote(primary || platformSnap),
    'Codebase analyzer (separate scan) flags TODO/FIXME, broken JSON, debug artifacts, and ESLint violations.',
    'We publish scoped metrics so buyers can verify what was actually checked — not marketing averages.',
  ];
}

/**
 * Build trust verification payload.
 * @param {Object} options
 * @returns {any}
 */
function buildTrustVerificationPayload(options = {}) {
  const platformRoot = path.resolve(options.platformRoot || options.projectRoot || process.cwd());
  const monorepoRoot = options.monorepoRoot
    ? path.resolve(options.monorepoRoot)
    : path.resolve(platformRoot, '..');

  const platformReport = readJsonIfExists(
    options.platformReportPath || path.join(platformRoot, '.simplebeacon', 'report.json')
  );
  const monorepoReport = readJsonIfExists(
    options.monorepoReportPath || path.join(monorepoRoot, '.simplebeacon', 'report.json')
  );

  const platform = buildReportSnapshot(platformReport, 'Platform gate (ai-platform)');
  const monorepo =
    monorepoReport &&
    monorepoReport.projectRoot &&
    path.resolve(monorepoReport.projectRoot).toLowerCase() !==
      path.resolve(platformRoot).toLowerCase()
      ? buildReportSnapshot(monorepoReport, 'Monorepo root')
      : null;

  const picked = pickHeadlineSnapshot(platform, monorepo);
  const primary = picked.primary;
  const payload = {
    type: 'simplebeacon-trust-verification',
    generatedAt: new Date().toISOString(),
    verificationMethod: 'simplebeacon-deterministic-gate',
    platform,
    monorepo,
    headlineSource: picked.source,
    headlineReason: picked.reason,
    headline: primary
      ? {
          gatePass: primary.gatePass,
          qualityScore: primary.qualityScore,
          issueCount: primary.issueCount,
          schemaCompliance: primary.schemaCompliance,
          lastScan: primary.generatedAt,
          repositoryFilesTotal: primary.repositoryFilesTotal,
          ruleScopedFilesAnalyzed: primary.ruleScopedFilesAnalyzed,
        }
      : null,
    disclaimers: buildTrustDisclaimers(platform, monorepo),
    methodology: buildTrustMethodology(platform, monorepo, picked.source),
    fictionScope: buildFictionScopeBlock(platform, monorepo, picked.source),
  };

  payload.verificationId = verificationDigest(payload);
  payload.repositoryHealth = buildRepositoryHealthPayload({
    platformRoot,
    monorepoRoot,
  });
  return payload;
}

/**
 * Publish trust verification payload to public file and history.
 * @param {Object} options
 * @returns {any}
 */
function publishTrustVerification(options = {}) {
  const platformRoot = path.resolve(options.platformRoot || options.projectRoot || process.cwd());
  const monorepoRoot = options.monorepoRoot
    ? path.resolve(options.monorepoRoot)
    : path.resolve(platformRoot, '..');
  const publicDir = path.resolve(options.publicDir || path.join(platformRoot, 'public'));
  const trustHistoryPath = resolveTrustHistoryPath(platformRoot, options.trustHistoryPath);

  const payload = buildTrustVerificationPayload({ platformRoot, monorepoRoot });
  const publishPath = path.join(publicDir, 'trust-verification.json');

  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(publishPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const history = appendTrustSnapshot({
    payload,
    historyPath: trustHistoryPath,
    source: options.source || 'trust:publish',
  });

  return { payload, publishPath, history, generatedAt: payload.generatedAt };
}

/**
 * Build trust badge svg.
 * @param {any} payload
 * @param {Object} options
 * @returns {any}
 */
function buildTrustBadgeSvg(payload, options = {}) {
  const headline = payload.headline || {};
  const score = headline.qualityScore ?? '—';
  const gate = headline.gatePass === true ? 'PASS' : headline.gatePass === false ? 'REVIEW' : '—';
  const issues = headline.issueCount ?? '—';
  const width = options.width || 320;
  const height = options.height || 72;
  const gateColor =
    headline.gatePass === true ? '#3fb950' : headline.gatePass === false ? '#d29922' : '#8b949e';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Simplebeacon gate ${gate}, ${score}% quality">
  <rect width="${width}" height="${height}" rx="8" fill="#161b22" stroke="${gateColor}" stroke-width="2"/>
  <circle cx="${width - 18}" cy="18" r="6" fill="${gateColor}"/>
  <text x="12" y="22" fill="#8b949e" font-family="Inter,Segoe UI,sans-serif" font-size="11">SimpleBeacon verified</text>
  <text x="12" y="44" fill="#f0f6fc" font-family="Inter,Segoe UI,sans-serif" font-size="16" font-weight="600">Gate ${gate} - ${score}% quality</text>
  <text x="12" y="62" fill="#8b949e" font-family="Inter,Segoe UI,sans-serif" font-size="10">${issues} issues - scoped gate scan</text>
</svg>`;
}

/**
 * Build trust badge html.
 * @param {any} payload
 * @param {any} origin
 * @returns {any}
 */
function buildTrustBadgeHtml(payload, origin = '') {
  const headline = payload.headline || {};
  const base = origin || '';
  const svgUrl = `${base}/api/trust/badge.svg?raw=1`;
  const embed = `<img src="${svgUrl}" alt="SimpleBeacon gate verification badge" width="320" height="72" loading="lazy">`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SimpleBeacon Trust Badge</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: Inter, Segoe UI, sans-serif; background: #f6f8fa; color: #1f2328; margin: 0; line-height: 1.5; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { font-size: 1.35rem; margin: 0 0 8px; }
    .muted { color: #656d76; font-size: 0.875rem; }
    .card { background: #fff; border: 1px solid #d0d7de; border-radius: 12px; padding: 24px; margin: 20px 0; }
    .preview { background: repeating-conic-gradient(#e7ecf1 0% 25%, #fff 0% 50%) 50% / 16px 16px; border-radius: 8px; padding: 24px; display: inline-block; }
    pre { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 8px; padding: 12px; overflow: auto; font-size: 0.8rem; }
    a { color: #0969da; }
    .links { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
    @media (prefers-color-scheme: dark) {
      body { background: #0d1117; color: #e6edf3; }
      .muted { color: #8b949e; }
      .card { background: #161b22; border-color: #30363d; }
      pre { background: #0d1117; border-color: #30363d; }
      .preview { background: repeating-conic-gradient(#21262d 0% 25%, #161b22 0% 50%) 50% / 16px 16px; }
      a { color: #58a6ff; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Trust badge preview</h1>
    <p class="muted">Live metrics from Simplebeacon scans · ID <code>${esc(payload.verificationId)}</code></p>
    <div class="card">
      <div class="preview">${embed}</div>
      <p class="muted" style="margin:16px 0 8px;">Embed on your site:</p>
      <pre>${esc(embed)}</pre>
      <p class="muted">Headline: Gate ${headline.gatePass ? 'PASS' : 'REVIEW'} · ${esc(headline.qualityScore)}% quality · ${esc(headline.issueCount)} issues (monorepo-scoped when fiction debt exists).</p>
    </div>
    <div class="links">
      <a href="${svgUrl}">Raw SVG</a>
      <a href="/api/trust/verify?format=html">Verify page</a>
      <a href="/app#/trust">Trust dashboard</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Esc.
 * @param {any} value
 * @returns {any}
 */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render snapshot row.
 * @param {any} label
 * @param {any} snap
 * @returns {any}
 */
function renderSnapshotRow(label, snap) {
  if (!snap) {
    return `<section class="card"><h2>${esc(label)}</h2><p class="muted">No report on disk — run <code>npm run trust:refresh</code> first.</p></section>`;
  }
  const gate = snap.gatePass ? 'pass' : 'review';
  const gateLabel = snap.gatePass ? 'GATE PASS' : 'GATE REVIEW';
  return `
    <section class="card">
      <div class="row">
        <h2>${esc(label)}</h2>
        <span class="pill ${gate}">${gateLabel}</span>
      </div>
      <p class="muted">${esc(snap.scopeNote || '')}</p>
      <dl class="metrics">
        <div><dt>Quality</dt><dd>${esc(snap.qualityScore)}%</dd></div>
        <div><dt>Issues</dt><dd>${esc(snap.issueCount)}</dd></div>
        <div><dt>Schema</dt><dd>${esc(snap.schemaPassed)}/${esc(snap.schemaChecked)}</dd></div>
        <div><dt>Consistency</dt><dd>${esc(snap.consistencyScore)}%</dd></div>
        <div><dt>Repo files</dt><dd>${esc(snap.repositoryFilesTotal)}</dd></div>
        <div><dt>Gate checked</dt><dd>${esc(snap.ruleScopedFilesAnalyzed)}</dd></div>
        <div><dt>Fiction JSON</dt><dd>${esc(snap.fictionJsonFilesScanned ?? '—')}</dd></div>
        <div><dt>Last scan</dt><dd>${esc((snap.generatedAt || '').replace('T', ' ').slice(0, 19))}</dd></div>
      </dl>
    </section>`;
}

/**
 * Build trust verify html.
 * @param {any} payload
 * @returns {any}
 */
function buildTrustVerifyHtml(payload) {
  const headline = payload.headline || {};
  const gate = headline.gatePass ? 'pass' : 'review';
  const gateLabel = headline.gatePass ? 'GATE PASS' : 'GATE REVIEW';
  const disclaimers = (payload.disclaimers || []).map((d) => `<li>${esc(d)}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SimpleBeacon Trust Verification</title>
  <style>
    :root { color-scheme: dark; }
    body { font-family: Inter, Segoe UI, -apple-system, sans-serif; background: #0d1117; color: #e6edf3; margin: 0; line-height: 1.5; }
    .wrap { max-width: 900px; margin: 0 auto; padding: 28px 24px 48px; }
    h1 { font-size: 1.75rem; margin: 0 0 10px; font-weight: 700; }
    h2 { font-size: 1.05rem; margin: 0; font-weight: 600; }
    .muted { color: #8b949e; font-size: 0.875rem; }
    .hero { margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #30363d; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
    .pill { font-size: 0.7rem; font-weight: 700; padding: 5px 12px; border-radius: 999px; letter-spacing: 0.03em; text-transform: uppercase; }
    .pill.pass { background: #238636; color: #fff; }
    .pill.review { background: #9e6a03; color: #fff; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 14px; padding: 20px; margin-bottom: 18px; }
    .card h2 { margin-bottom: 6px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; margin: 14px 0 0; }
    .metrics div { background: #0d1117; border-radius: 10px; padding: 12px; border: 1px solid #21262d; }
    .metrics dt { font-size: 0.7rem; color: #8b949e; margin: 0; text-transform: uppercase; letter-spacing: 0.04em; }
    .metrics dd { font-size: 1.15rem; font-weight: 700; margin: 6px 0 0; }
    ul { margin: 10px 0 0; padding-left: 1.2rem; color: #c9d1d9; font-size: 0.9rem; }
    li { margin-bottom: 6px; }
    code { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 0.85em; background: #21262d; padding: 2px 6px; border-radius: 4px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #30363d; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; font-size: 0.85rem; font-weight: 500; text-decoration: none; cursor: pointer; border: none; transition: opacity 0.15s; }
    .btn:hover { opacity: 0.85; }
    .btn-primary { background: #1f6feb; color: #fff; }
    .btn-secondary { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; }
    .btn svg { width: 16px; height: 16px; }
    a { color: #58a6ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .badge-row { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .badge { font-size: 0.75rem; padding: 3px 10px; border-radius: 999px; background: #21262d; color: #8b949e; border: 1px solid #30363d; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div class="row">
        <h1>SimpleBeacon Trust Verification</h1>
        <span class="pill ${gate}">${gateLabel}</span>
      </div>
      <div class="badge-row">
        <span class="badge">ID <code>${esc(payload.verificationId)}</code></span>
        <span class="badge">Source <code>${esc(payload.headlineSource || 'n/a')}</code></span>
        <span class="badge">${esc((headline.lastScan || '').replace('T', ' ').slice(0, 19))}</span>
      </div>
      <p class="muted">${esc(payload.headlineReason || 'Scoped scan results — not marketing claims.')}</p>
      <dl class="metrics">
        <div><dt>Quality</dt><dd>${esc(headline.qualityScore)}%</dd></div>
        <div><dt>Issues</dt><dd>${esc(headline.issueCount)}</dd></div>
        <div><dt>Schema</dt><dd>${esc(headline.schemaCompliance)}%</dd></div>
        <div><dt>Repo files</dt><dd>${esc(headline.repositoryFilesTotal)}</dd></div>
        <div><dt>Gate checked</dt><dd>${esc(headline.ruleScopedFilesAnalyzed)}</dd></div>
        <div><dt>Consistency</dt><dd>${esc(headline.consistencyScore ?? '—')}%</dd></div>
      </dl>
    </div>
    ${renderSnapshotRow('Platform gate (ai-platform)', payload.platform)}
    ${renderSnapshotRow('Monorepo root', payload.monorepo)}
    ${
      payload.fictionScope
        ? `
    <section class="card">
      <h2>Fiction / KPI scope</h2>
      <p class="muted">Walk root <code>${esc(payload.fictionScope.walkRoot)}</code> · mode <code>${esc(payload.fictionScope.mode)}</code></p>
      <dl class="metrics">
        <div><dt>JSON scanned</dt><dd>${esc(payload.fictionScope.fictionJsonFilesScanned)}</dd></div>
        <div><dt>Mock JSON</dt><dd>${esc(payload.fictionScope.fictionSampleFilesScanned)}</dd></div>
      </dl>
    </section>`
        : ''
    }
    ${
      (payload.methodology || []).length
        ? `
    <section class="card">
      <h2>Methodology</h2>
      <ul>${(payload.methodology || []).map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
    </section>`
        : ''
    }
    <section class="card">
      <h2>Disclaimers</h2>
      <ul>${disclaimers}</ul>
    </section>
    <div class="actions">
      <a class="btn btn-primary" href="/api/trust/verify?format=json" download="trust-verification.json">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download JSON
      </a>
      <a class="btn btn-secondary" href="/app#/trust">Full dashboard</a>
      <a class="btn btn-secondary" href="/api/trust/badge.svg" target="_blank">Badge SVG</a>
      <a class="btn btn-secondary" href="/api/trust/verification">Full payload</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Build trust verify compact.
 * @param {any} payload
 * @returns {any}
 */
function buildTrustVerifyCompact(payload) {
  const headline = payload.headline || {};
  return {
    verified: Boolean(payload.platform || payload.monorepo),
    verificationId: payload.verificationId,
    headlineSource: payload.headlineSource || null,
    headlineReason: payload.headlineReason || null,
    qualityScore: headline.qualityScore,
    lastScan: headline.lastScan,
    issues: headline.issueCount,
    schemaCompliance: headline.schemaCompliance,
    gatePass: headline.gatePass,
    repositoryFilesTotal: headline.repositoryFilesTotal,
    ruleScopedFilesAnalyzed: headline.ruleScopedFilesAnalyzed,
    disclaimers: payload.disclaimers,
  };
}

module.exports = {
  buildTrustVerificationPayload,
  publishTrustVerification,
  buildTrustBadgeSvg,
  buildReportSnapshot,
  buildTrustMethodology,
  buildFictionScopeNote,
  buildFictionScopeBlock,
  buildTrustVerifyHtml,
  buildTrustVerifyCompact,
  buildTrustBadgeHtml,
  readJsonIfExists,
};
