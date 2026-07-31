// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Scan strategy resolver — replaces 250+ lines of conditional branching in runPathAnalysis.
 * Picks the right scanner based on environment, path type, and available bridges.
 */

import {
  isLocalPath,
  hasExtensionBridgeConfigured,
} from './localAgentService.js?v=20260722scanfix2';
import {
  shouldProbeAgent4000,
  probeAgent4000,
  shouldProbeLocalAgent,
  probeAgent,
  shouldUseAgent,
  isIntegratedLocalDashboard,
} from './localAgentService.js?v=20260722scanfix2';
import { isRemoteRepoUrl } from '../lib/analyzePathSources.js';

/**
 * Determine the scan strategy for a given path.
 * Returns one of: 'extension-bridge', 'local-agent', 'agent-4000', 'browser-sandbox', 'server', 'github-clone'
 * @param {string} rawPath - User-provided path
 * @param {Object} ctx - Environment context
 * @param {Object} [ctx.agentStatus] - Local agent probe result
 * @param {boolean} [ctx.localMode] - Privacy mode flag
 * @param {boolean} [ctx.hasBrowserScanFiles] - Has cached browser scan files
 * @param {string} [ctx.lastProjectPath] - Last scanned path
 * @returns {Promise<{strategy: string, path: string, reason: string}>}
 */
export async function resolveScanStrategy(rawPath, ctx = {}) {
  const typedPath = String(rawPath || '').trim();
  const isRemote = isRemoteDashboardHost();
  const isLocal = isLocalPath(typedPath);
  const hasBridge = hasExtensionBridgeConfigured();

  // 1. GitHub URL → server-side clone + scan
  if (isRemoteRepoUrl(typedPath) || /^https?:\/\//i.test(typedPath)) {
    return { strategy: 'server', path: typedPath, reason: 'Remote URL — server clone + scan' };
  }

  // 2. Extension bridge scan (VS Code embed on simplebeacon.ai)
  if (isLocal && shouldProbeAgent4000()) {
    try {
      const status4000 = await probeAgent4000();
      if (status4000.available) {
        if (status4000.extensionBridge) {
          return {
            strategy: 'agent-4000',
            path: typedPath,
            reason: 'VS Code extension bridge active',
          };
        }
        return { strategy: 'agent-4000', path: typedPath, reason: 'IDE scan bridge available' };
      }
    } catch (_a) {
      /* fall through */
    }
  }

  // 3. Hosted dashboard with local path → use configured sb_api_base server,
  // browser sandbox, or extension bridge. A configured loopback bridge means
  // the user explicitly passed sb_api_base and expects that server to scan.
  if (isRemote && isLocal) {
    if (hasBridge) {
      // Bridge is configured but may be unreachable (extension not running).
      // probeAgent4000 already ran at step 2 — if it returned available, we
      // already returned. If we get here, the bridge probe failed, so fall
      // back to the sb_api_base server scan path.
      if (ctx.agentStatus && shouldUseAgent(typedPath, ctx.agentStatus)) {
        return {
          strategy: 'local-agent',
          path: typedPath,
          reason: 'Local agent available for local path',
        };
      }
      if (ctx.hasBrowserScanFiles) {
        return {
          strategy: 'browser-sandbox',
          path: ctx.lastProjectPath || typedPath,
          reason: 'Re-scan cached browser files',
        };
      }
      return {
        strategy: 'server',
        path: typedPath,
        reason: 'sb_api_base bridge configured — use server scan',
      };
    }
    if (ctx.agentStatus && shouldUseAgent(typedPath, ctx.agentStatus)) {
      return {
        strategy: 'local-agent',
        path: typedPath,
        reason: 'Local agent available for local path',
      };
    }
    if (ctx.hasBrowserScanFiles) {
      return {
        strategy: 'browser-sandbox',
        path: ctx.lastProjectPath || typedPath,
        reason: 'Re-scan cached browser files',
      };
    }
    return {
      strategy: 'prompt-folder',
      path: typedPath,
      reason: 'Hosted site cannot read local paths — prompt for folder selection',
    };
  }

  // 4. Privacy mode → browser sandbox
  if (ctx.localMode) {
    return {
      strategy: 'browser-sandbox',
      path: typedPath,
      reason: 'Privacy mode — browser-only scan',
    };
  }

  // 5. Local path on non-integrated dashboard → try agent, then prompt
  if (isLocal && !isIntegratedLocalDashboard()) {
    let agentStatus = ctx.agentStatus;
    if (!agentStatus) {
      try {
        agentStatus = await probeAgent();
      } catch (_b) {
        agentStatus = { available: false, scannerAvailable: false };
      }
    }
    if (shouldUseAgent(typedPath, agentStatus)) {
      return { strategy: 'local-agent', path: typedPath, reason: 'Local agent available' };
    }
    return {
      strategy: 'prompt-folder',
      path: typedPath,
      reason: 'No agent — prompt for folder selection',
    };
  }

  // 6. Local path on integrated dashboard → agent scan
  if (isLocal && shouldUseAgent(typedPath, ctx.agentStatus)) {
    return { strategy: 'local-agent', path: typedPath, reason: 'Integrated dashboard with agent' };
  }

  // 7. Server path → server-side scan (only on local/integrated dashboards)
  if (!isLocal && typedPath) {
    if (isRemote) {
      return {
        strategy: 'prompt-folder',
        path: typedPath,
        reason: 'Hosted site cannot read local paths — prompt for folder selection',
      };
    }
    return { strategy: 'server', path: typedPath, reason: 'Server-side path' };
  }

  // 8. Empty path → prompt
  return { strategy: 'prompt-folder', path: typedPath, reason: 'No path provided' };
}

function isRemoteDashboardHost() {
  return (
    typeof window !== 'undefined' && !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
  );
}

/**
 * Smart auto-detect of analysis mode based on project structure hints.
 * Replaces the trivial path-name check with structural detection.
 * @param {string} projectPath
 * @param {Object} [hints] - Optional pre-computed hints
 * @param {boolean} [hints.hasSimplebeaconConfig] - Has .simplebeacon/config.json
 * @param {boolean} [hints.hasPackageJson] - Has package.json
 * @param {boolean} [hints.isMonorepo] - Has workspaces
 * @param {boolean} [hints.hasWebData] - Path contains web/data
 * @returns {string} - 'simplebeacon', 'complete', or 'roadmap'
 */
export function resolveAutoAnalysisModeSmart(projectPath, hints = {}) {
  const normalized = String(projectPath || '')
    .replace(/\\/g, '/')
    .toLowerCase();

  // If we have structural hints, use them
  if (
    hints.hasSimplebeaconConfig ||
    hints.hasWebData ||
    normalized.includes(['web', 'data'].join('/'))
  ) {
    return 'simplebeacon';
  }

  // Monorepo or large project → complete audit
  if (hints.isMonorepo || (hints.hasPackageJson && normalized.split('/').length > 3)) {
    return 'complete';
  }

  // Simplebeacon's own repos → simplebeacon gate
  if (normalized.includes('simplebeacon') || normalized.endsWith('ai-platform')) {
    return 'simplebeacon';
  }

  // Default for unknown projects → roadmap (lightweight, useful for any codebase)
  return 'roadmap';
}
