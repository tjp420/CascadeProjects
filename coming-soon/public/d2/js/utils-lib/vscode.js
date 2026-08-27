/**
 * @module vscode
 */

/**
 * Check whether the code is running inside a VS Code: webview.
 * @returns {boolean}
 */
export function isVSCodeWebview() {
  return (
    typeof window !== "undefined" &&
    typeof window.acquireVsCodeApi === "function"
  );
}

/**
 * Check whether the code is running outside a VS Code: webview (standalone browser).
 * @returns {boolean}
 */
export function isStandalone() {
  return !isVSCodeWebview();
}

/**
 * Safely acquire the VS Code: API object, or null if unavailable.
 * @returns {any|null}
 */
export function getVSCodeApi() {
  if (
    typeof window !== "undefined" &&
    typeof window.acquireVsCodeApi === "function"
  ) {
    try {
      return window.acquireVsCodeApi();
    } catch {
      return null;
    }
  }
  return null;
}
