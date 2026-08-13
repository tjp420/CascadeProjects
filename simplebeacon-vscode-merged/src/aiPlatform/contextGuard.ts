/**
 * Context Guard — protects the engine API from oversized payloads and
 * keeps the developer informed when content exceeds safe limits.
 *
 * Modes:
 *   - 'off':    No guard. Full content always sent to the engine.
 *   - 'silent': Truncate content silently. No UI notification.
 *   - 'toast':  Show a toast notification but still send full content.
 *   - 'both':   Show toast AND truncate content (default, recommended).
 *
 * The guard runs before any engine API call in RealtimeMonitor.analyzeFile().
 * When content is truncated, the local regex scanner picks up the overflow
 * portion so diagnostics still cover the full file.
 */

import * as vscode from 'vscode';
import { getSbConfig } from '../utils/vscode';

export type ContextGuardMode = 'off' | 'silent' | 'toast' | 'both';

export interface ContextGuardResult {
  /** The content to actually send to the engine (may be truncated) */
  content: string;
  /** Whether the content was truncated */
  truncated: boolean;
  /** Original content length in characters */
  originalLength: number;
  /** Effective content length after truncation */
  effectiveLength: number;
  /** Maximum character threshold that was applied */
  maxChars: number;
  /** The guard mode that was active */
  mode: ContextGuardMode;
  /** Whether a toast notification was shown */
  toastShown: boolean;
}

/**
 * Get the configured context guard mode.
 */
export function getContextGuardMode(): ContextGuardMode {
  const config = getSbConfig();
  const mode = config.get<string>('contextGuardMode', 'both');
  if (mode === 'off' || mode === 'silent' || mode === 'toast' || mode === 'both') {
    return mode;
  }
  return 'both'; // Safe default
}

/**
 * Get the configured maximum character threshold.
 */
export function getContextGuardMaxChars(): number {
  const config = getSbConfig();
  const max = config.get<number>('contextGuardMaxChars', 4000);
  // Clamp to safe range even if the user sets an out-of-bounds value
  if (typeof max !== 'number' || max < 500) return 500;
  if (max > 100000) return 100000;
  return max;
}

/**
 * Show a toast notification informing the developer that content was
 * truncated or would exceed the threshold. Uses a deduplication window
 * so the toast doesn't fire on every keystroke during continuous editing.
 */
let lastToastTime = 0;
const TOAST_DEBOUNCE_MS = 10000; // At most one toast per 10 seconds

function showContextGuardToast(
  filename: string,
  originalLength: number,
  maxChars: number,
  truncated: boolean
): void {
  const now = Date.now();
  if (now - lastToastTime < TOAST_DEBOUNCE_MS) {
    return; // Debounce — don't spam toasts during rapid edits
  }
  lastToastTime = now;

  const overBy = originalLength - maxChars;
  if (truncated) {
    vscode.window.showInformationMessage(
      `SimpleBeacon: ${filename} exceeds ${maxChars.toLocaleString()} chars by ${overBy.toLocaleString()}. ` +
      `Engine scan truncated to first ${maxChars.toLocaleString()} chars. ` +
      `Local regex covers the full file. Raise simplebeacon.contextGuardMaxChars if needed.`,
    );
  } else {
    vscode.window.showInformationMessage(
      `SimpleBeacon: ${filename} is ${originalLength.toLocaleString()} chars ` +
      `(threshold: ${maxChars.toLocaleString()}). Engine scan may be slow. ` +
      `Enable simplebeacon.contextGuardMode "both" to truncate.`,
    );
  }
}

/**
 * Apply the context guard to content before sending it to the engine API.
 *
 * @param content The full editor buffer content
 * @param filename The filename for toast messaging
 * @returns ContextGuardResult with the (possibly truncated) content and metadata
 */
export function applyContextGuard(content: string, filename: string): ContextGuardResult {
  const mode = getContextGuardMode();
  const maxChars = getContextGuardMaxChars();
  const originalLength = content.length;

  // Mode 'off' — no guard, pass through
  if (mode === 'off') {
    return {
      content,
      truncated: false,
      originalLength,
      effectiveLength: originalLength,
      maxChars,
      mode,
      toastShown: false,
    };
  }

  const exceedsThreshold = originalLength > maxChars;

  // Content is within limits — no action needed
  if (!exceedsThreshold) {
    return {
      content,
      truncated: false,
      originalLength,
      effectiveLength: originalLength,
      maxChars,
      mode,
      toastShown: false,
    };
  }

  // Content exceeds threshold — apply mode-specific behavior
  let effectiveContent = content;
  let truncated = false;
  let toastShown = false;

  if (mode === 'silent') {
    // Truncate silently, no toast
    effectiveContent = content.slice(0, maxChars);
    truncated = true;
  } else if (mode === 'toast') {
    // Show toast but don't truncate
    showContextGuardToast(filename, originalLength, maxChars, false);
    toastShown = true;
  } else if (mode === 'both') {
    // Truncate and show toast
    effectiveContent = content.slice(0, maxChars);
    truncated = true;
    showContextGuardToast(filename, originalLength, maxChars, true);
    toastShown = true;
  }

  return {
    content: effectiveContent,
    truncated,
    originalLength,
    effectiveLength: effectiveContent.length,
    maxChars,
    mode,
    toastShown,
  };
}

/**
 * Reset the toast debounce timer. Useful for tests.
 */
export function resetToastDebounce(): void {
  lastToastTime = 0;
}
