import * as vscode from 'vscode';
import { AuthManager } from './authManager';

let _authManager: AuthManager | undefined;

/**
 * Initialize the shared AuthManager singleton.
 * Must be called once during extension activation.
 */
export function initAuthManager(context: vscode.ExtensionContext): AuthManager {
  _authManager = new AuthManager(context);
  return _authManager;
}

/**
 * Get the shared AuthManager instance.
 * Throws if initAuthManager has not been called.
 */
export function getAuthManager(): AuthManager {
  if (!_authManager) {
    throw new Error('AuthManager not initialized. Call initAuthManager(context) during extension activation.');
  }
  return _authManager;
}
