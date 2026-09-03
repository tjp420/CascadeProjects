import * as vscode from 'vscode';

/**
 * Lightweight guard to prevent registering disposables after the host is disposed.
 */
export class GuardedExtensionPanel implements vscode.Disposable {
  private _disposables: vscode.Disposable[] = [];
  private _isDisposed = false;

  register(disposable: vscode.Disposable): boolean {
    if (this._isDisposed) {
      try { disposable.dispose(); } catch (e) {}
      console.warn('GuardedExtensionPanel: rejected registration to already-disposed container');
      return false;
    }
    this._disposables.push(disposable);
    return true;
  }

  dispose() {
    if (this._isDisposed) return;
    this._isDisposed = true;
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) {
        try { d.dispose(); } catch (err) { console.error('Error disposing listener', err); }
      }
    }
  }
}
