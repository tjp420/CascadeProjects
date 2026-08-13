/**
 * Engine API Client — connects the VS Code extension to the local SimpleBeacon
 * engine running on localhost:3000. This gives the extension access to the full
 * 38+ scanner engine suite (secrets, CVEs, dead code, ReDoS, weak crypto, PII,
 * hallucinated imports, OWASP LLM, EU AI Act, etc.) via a single HTTP call.
 *
 * Privacy: All communication is over localhost HTTP. No content leaves the
 * machine. The engine processes content in-memory and does not persist it.
 *
 * Fallback: If the engine is unavailable, the extension falls back to its
 * built-in 35-pattern local regex catalog.
 */

import * as http from 'http';
import * as vscode from 'vscode';

export interface EngineFinding {
  id: string;
  severity: string;
  type: string;
  filePath: string;
  line: number;
  column: number;
  description: string;
  recommendedAction: string;
  pattern: string;
  engine: string;
}

export interface EngineScanResult {
  success: boolean;
  filename: string;
  language: string;
  engineUsed: string;
  findingCount: number;
  findings: EngineFinding[];
  scannedAt: string;
}

export class EngineApiClient {
  private baseUrl: string;
  private timeoutMs: number;
  private lastHealthCheck: number = 0;
  private lastHealthStatus: boolean = false;
  private healthCheckIntervalMs: number = 30000; // Cache health for 30s

  constructor(baseUrl: string = 'http://localhost:3000', timeoutMs: number = 15000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  /**
   * Check if the local engine is running and healthy.
   * Results are cached for 30 seconds to avoid excessive health checks.
   */
  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckIntervalMs) {
      return this.lastHealthStatus;
    }

    this.lastHealthCheck = now;
    try {
      const result = await this.request('GET', '/health', undefined, 3000);
      this.lastHealthStatus = result.status === 'ok';
    } catch {
      this.lastHealthStatus = false;
    }
    return this.lastHealthStatus;
  }

  /**
   * Force a fresh health check (bypasses the cache).
   */
  async checkHealth(): Promise<boolean> {
    this.lastHealthCheck = Date.now();
    try {
      const result = await this.request('GET', '/health', undefined, 3000);
      this.lastHealthStatus = result.status === 'ok';
    } catch {
      this.lastHealthStatus = false;
    }
    return this.lastHealthStatus;
  }

  /**
   * Scan file content using the engine's full CLI scanner suite.
   * The content is sent to POST /api/realtime/scan-content on localhost.
   *
   * @param content The file buffer content to scan
   * @param filename The filename (used for language detection and path-based rules)
   * @returns The scan result with findings, or null if the engine is unavailable
   */
  async scanContent(content: string, filename: string): Promise<EngineScanResult | null> {
    const available = await this.isAvailable();
    if (!available) {
      return null;
    }

    try {
      const body = JSON.stringify({ content, filename });
      const result = await this.request('POST', '/api/realtime/scan-content', body, this.timeoutMs);
      return result as EngineScanResult;
    } catch (err) {
      // Mark as unavailable so we don't retry immediately
      this.lastHealthStatus = false;
      throw new Error(`Engine scan failed: ${(err as Error).message}`);
    }
  }

  /**
   * Low-level HTTP request helper. Uses Node's http module (no external deps).
   */
  private request(method: string, pathStr: string, body?: string, timeoutMs?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + pathStr);
      const options: http.RequestOptions = {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          'Accept': 'application/json',
        } as Record<string, string | number>,
        timeout: timeoutMs || this.timeoutMs,
      };

      if (body) {
        (options.headers as Record<string, string | number>)['Content-Type'] = 'application/json';
        (options.headers as Record<string, string | number>)['Content-Length'] = Buffer.byteLength(body);
      }

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error(`Invalid JSON response from engine (status ${res.statusCode})`));
            }
          } else {
            reject(new Error(`Engine returned status ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Connection failed: ${err.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  /**
   * Update the base URL (e.g., when the user changes the engine port setting).
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    // Reset health cache so the next check uses the new URL
    this.lastHealthCheck = 0;
    this.lastHealthStatus = false;
  }

  /**
   * Get the current base URL.
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

/**
 * Get the engine API client singleton, configured from VS Code settings.
 */
let engineClientInstance: EngineApiClient | null = null;

export function getEngineClient(): EngineApiClient {
  if (!engineClientInstance) {
    const config = vscode.workspace.getConfiguration('simplebeacon');
    const engineUrl = config.get<string>('engineUrl', 'http://localhost:3000');
    const timeout = config.get<number>('engineTimeoutMs', 15000);
    engineClientInstance = new EngineApiClient(engineUrl, timeout);
  }
  return engineClientInstance;
}

/**
 * Reset the engine client singleton (used when settings change).
 */
export function resetEngineClient(): void {
  engineClientInstance = null;
}
