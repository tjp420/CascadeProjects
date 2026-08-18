import * as fs from 'fs';
import * as path from 'path';

export function isMonorepoRoot(projectPath: string): boolean {
  try {
    const root = path.resolve(projectPath);
    const pkgPath = path.join(root, 'package.json');
    if (!fs.existsSync(pkgPath)) return false;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.workspaces) return true;
    let pkgCount = 0;
    for (const name of fs.readdirSync(root)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const sub = path.join(root, name);
      try {
        if (fs.statSync(sub).isDirectory() && fs.existsSync(path.join(sub, 'package.json'))) {
          pkgCount += 1;
        }
      } catch {
        /* ignore */
      }
    }
    return pkgCount >= 2;
  } catch {
    return false;
  }
}

/** Resolve effective scan mode — monorepos default to gate-only PDA scans. */
export function resolveEffectiveScanMode(
  projectPath: string,
  scanModeSetting: string,
  options?: { mode?: string; fullDirectory?: boolean }
): 'full' | 'gate' | 'quick' {
  if (options?.fullDirectory === true || options?.mode === 'full' || options?.mode === 'complete') {
    return 'full';
  }
  if (options?.mode === 'gate' || options?.mode === 'quick') {
    return options.mode as 'gate' | 'quick';
  }
  if (scanModeSetting === 'gate' || scanModeSetting === 'quick') {
    return scanModeSetting;
  }
  if (scanModeSetting === 'full' || scanModeSetting === 'security' || scanModeSetting === 'quality') {
    if (isMonorepoRoot(projectPath)) {
      return 'gate';
    }
    return 'full';
  }
  // workspace/custom target selectors — PDA default is gate
  if (scanModeSetting === 'workspace' || scanModeSetting === 'custom') {
    return 'gate';
  }
  return isMonorepoRoot(projectPath) ? 'gate' : 'gate';
}

export function writeScanProgressInactive(projectPath: string): void {
  try {
    const sbDir = path.join(path.resolve(projectPath), '.simplebeacon');
    if (!fs.existsSync(sbDir)) {
      fs.mkdirSync(sbDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(sbDir, 'scan-progress.json'),
      JSON.stringify({ active: false, phase: 'idle', label: 'Scan complete' }, null, 2),
      'utf8'
    );
  } catch {
    /* non-fatal */
  }
}
