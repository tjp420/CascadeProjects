import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as child_process from 'child_process';
import { ScanReport } from './scanProvider';

export interface ServerState {
  currentReport: ScanReport | null;
  scanStatus: string;
  scanMessage: string;
  lastScanTime: number;
  workspaceName: string;
  workspacePath: string;
  extensionVersion: string;
  lastTrustData: any;
  scanProgressProcessed?: number;
  scanProgressTotal?: number;
  scanProgressFile?: string;
}

export function getWindowsDrives(): string[] {
  try {
    const out = child_process.execSync('wmic logicaldisk get name', { encoding: 'utf8' });
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^[A-Za-z]:$/.test(line));
  } catch {
    return [];
  }
}

function normalizeDirPath(input: string): string {
  if (!input) {
    return '';
  }
  return input.replace(/\//g, '\\').replace(/\\+$/, '');
}

function parentDirPath(dirPath: string): string {
  if (!dirPath) {
    return '';
  }
  const normalized = dirPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  if (parts.length === 1 && /^[A-Za-z]:$/.test(parts[0])) {
    return '';
  }
  parts.pop();
  const parent = parts.join('/');
  const withSlash = normalized.startsWith('/') ? '/' + parent : parent;
  if (/^[A-Za-z]:$/.test(parts[parts.length - 1] || '')) {
    return withSlash + '\\';
  }
  return withSlash;
}

export function listDirectories(dirPath: string): {
  success: boolean;
  current?: string;
  parent?: string;
  directories?: { name: string; path: string }[];
  error?: string;
} {
  try {
    const current = normalizeDirPath(dirPath);
    if (!current) {
      if (os.platform() === 'win32') {
        const drives = getWindowsDrives();
        return {
          success: true,
          current: '',
          parent: '',
          directories: drives.map((d) => ({ name: d + '\\', path: d + '\\' })),
        };
      }
      const root = '/';
      const entries = fs.readdirSync(root, { withFileTypes: true });
      return {
        success: true,
        current: root,
        parent: '',
        directories: entries
          .filter((e) => e.isDirectory())
          .map((e) => ({
            name: e.name,
            path: path.join(root, e.name),
          })),
      };
    }
    const resolved = path.resolve(current);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return { success: false, error: 'Not a directory' };
    }
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    return {
      success: true,
      current: resolved,
      parent: parentDirPath(resolved),
      directories: entries
        .filter((e) => e.isDirectory())
        .map((e) => ({
          name: e.name,
          path: path.join(resolved, e.name),
        })),
    };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to list directories' };
  }
}
