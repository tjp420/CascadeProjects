// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { getSbConfig } from './utils/vscode';

const execFileAsync = promisify(execFile);

export interface AgentStatus {
  available: boolean;
  scannerAvailable: boolean;
  version?: string;
  error?: string;
}

export interface AgentScanOptions {
  projectPath: string;
  fullDirectory?: boolean;
}

/**
 * Return the default install directory for the local agent.
 */
export function getLocalAgentInstallDir(): string {
  if (process.platform === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Local', 'SimpleBeaconLocalAgent');
  }
  return path.join(os.homedir(), '.local', 'share', 'simplebeacon-local-agent');
}

/**
 * Return the configured agent port (default 55432).
 */
export function getAgentPort(): number {
  const config = getSbConfig();
  return config.get<number>('localAgent.port', 55432);
}

/**
 * Resolve the download URL for the agent zip.
 * Falls back to the public Render deployment if no URL is configured.
 */
export function getAgentDownloadUrl(): string {
  const config = getSbConfig();
  const configured = config.get<string>('localAgent.downloadUrl', '');
  if (configured) { return configured; }
  const apiUrl = config.get<string>('apiServerUrl', '') || config.get<string>('apiUrl', '');
  if (apiUrl) {
    const base = apiUrl.replace(/\/$/, '');
    return `${base}/downloads/simplebeacon-local-agent-portable.zip`;
  }
  return 'https://cascadeprojects-yzzd.onrender.com/downloads/simplebeacon-local-agent-portable.zip';
}

/**
 * Probe the local agent health endpoint.
 */
export async function probeLocalAgent(port?: number): Promise<AgentStatus> {
  const agentPort = port ?? getAgentPort();
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${agentPort}/health`, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            available: true,
            scannerAvailable: Boolean(json.scannerAvailable),
            version: json.version
          });
        } catch {
          resolve({ available: true, scannerAvailable: false });
        }
      });
    });
    req.on('error', (err) => {
      resolve({ available: false, scannerAvailable: false, error: err.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ available: false, scannerAvailable: false, error: 'timeout' });
    });
  });
}

/**
 * Start the local agent from its install directory.
 */
export function startLocalAgent(installDir?: string, port?: number): void {
  const dir = installDir ?? getLocalAgentInstallDir();
  const agentPort = port ?? getAgentPort();
  const env = { ...process.env, SIMPLEBEACON_AGENT_PORT: String(agentPort) };
  if (process.platform === 'win32') {
    const bat = path.join(dir, 'start-agent.bat');
    if (fs.existsSync(bat)) {
      spawn('cmd.exe', ['/c', bat], { cwd: dir, env, detached: true, windowsHide: false });
    } else {
      throw new Error(`start-agent.bat not found in ${dir}`);
    }
  } else {
    const sh = path.join(dir, 'start-agent.sh');
    if (fs.existsSync(sh)) {
      spawn('sh', [sh], { cwd: dir, env, detached: true, stdio: 'ignore' }).unref();
    } else {
      throw new Error(`start-agent.sh not found in ${dir}`);
    }
  }
}

/**
 * Check whether the agent is installed locally.
 */
export function isLocalAgentInstalled(installDir?: string): boolean {
  const dir = installDir ?? getLocalAgentInstallDir();
  return fs.existsSync(path.join(dir, 'agent.cjs'));
}

/**
 * Download the agent zip to a temp file.
 */
export async function downloadAgentZip(url: string, progress?: vscode.Progress<{ increment?: number; message?: string }>): Promise<string> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simplebeacon-agent-'));
  const zipPath = path.join(tempDir, 'simplebeacon-local-agent-portable.zip');
  const uri = new URL(url);
  const client = uri.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.get(url, { timeout: 120000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        resolve(downloadAgentZip(redirectUrl, progress));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const out = fs.createWriteStream(zipPath);
      res.pipe(out);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total > 0 && progress) {
          progress.report({ increment: (chunk.length / total) * 100, message: `Downloaded ${Math.round((downloaded / total) * 100)}%` });
        }
      });
      out.on('finish', () => resolve(zipPath));
      out.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Download timed out'));
    });
  });
}

/**
 * Extract the agent zip to the install directory.
 */
export async function extractAgentZip(zipPath: string, installDir: string, progress?: vscode.Progress<{ increment?: number; message?: string }>): Promise<void> {
  fs.mkdirSync(installDir, { recursive: true });
  if (process.platform === 'win32') {
    const psCmd = `Expand-Archive -Path '${zipPath}' -DestinationPath '${installDir}' -Force`;
    await execFileAsync('powershell.exe', ['-Command', psCmd]);
  } else {
    await execFileAsync('unzip', ['-o', zipPath, '-d', installDir]);
  }
  if (progress) { progress.report({ message: 'Extraction complete' }); }
}

/**
 * Run the bundled installer (creates shortcuts and starts the agent on Windows).
 */
export async function runBundledInstaller(installDir: string): Promise<void> {
  if (process.platform === 'win32') {
    const installer = path.join(installDir, 'install-windows.bat');
    if (fs.existsSync(installer)) {
      await execFileAsync('cmd.exe', ['/c', installer], { cwd: installDir });
    }
  } else {
    const installer = path.join(installDir, 'install.sh');
    if (fs.existsSync(installer)) {
      await execFileAsync('sh', [installer], { cwd: installDir });
    }
  }
}

/**
 * Install the local agent: download, extract, run installer, start agent.
 */
export async function installLocalAgent(): Promise<void> {
  const installDir = getLocalAgentInstallDir();
  const url = getAgentDownloadUrl();
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Installing SimpleBeacon Local Agent',
    cancellable: false
  }, async (progress) => {
    progress.report({ message: `Downloading from ${url}` });
    const zipPath = await downloadAgentZip(url, progress);
    progress.report({ message: `Extracting to ${installDir}` });
    await extractAgentZip(zipPath, installDir, progress);
    progress.report({ message: 'Running installer' });
    await runBundledInstaller(installDir);
    progress.report({ message: 'Starting agent' });
    startLocalAgent(installDir);
  });
}

/**
 * Scan a local path via the agent's /scan endpoint.
 */
export async function scanViaLocalAgent(options: AgentScanOptions, port?: number): Promise<any> {
  const agentPort = port ?? getAgentPort();
  const projectPath = options.projectPath;
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ projectPath, fullDirectoryScan: Boolean(options.fullDirectory) });
    const req = http.request({
      hostname: '127.0.0.1',
      port: agentPort,
      path: '/scan',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 600000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.success) {
            reject(new Error(json.error || 'Agent scan failed'));
          } else {
            resolve(json.report);
          }
        } catch {
          reject(new Error(`Invalid JSON response from agent: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Agent scan timed out'));
    });
    req.write(payload);
    req.end();
  });
}
