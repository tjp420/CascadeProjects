import { AuthManager } from './authManager';

/**
 * SimpleBeacon API client for authenticated server calls.
 * Uses the AuthManager token for Authorization headers.
 */
export class ApiClient {
  private authManager: AuthManager;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
  }

  /**
   * Make an authenticated fetch to the SimpleBeacon API.
   */
  async fetch(path: string, options: RequestInit = {}): Promise<Response> {
    const baseUrl = this.authManager.getServerUrl();
    if (!baseUrl) {
      throw new Error('SimpleBeacon server URL not configured. Run "Set API Server URL" command or set simplebeacon.apiServerUrl in settings.');
    }
    const headers = await this.authManager.getAuthHeaders();
    const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

    return fetch(url, {
      ...options,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  }

  /**
   * GET helper.
   */
  async get(path: string): Promise<any> {
    const response = await this.fetch(path, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`API GET ${path} failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * POST helper.
   */
  async post(path: string, body: unknown): Promise<any> {
    const response = await this.fetch(path, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(`API POST ${path} failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Check server health / auth status.
   */
  async checkAuth(): Promise<{ authenticated: boolean; tier?: string; features?: string[] }> {
    try {
      const data = await this.get('/api/auth/status');
      return {
        authenticated: data?.authenticated === true,
        tier: data?.tier,
        features: data?.features || []
      };
    } catch (error: unknown) {
      return { authenticated: false };
    }
  }

  /**
   * Trigger a server-side scan.
   */
  async scanWorkspace(projectPath: string): Promise<any> {
    return this.post('/api/simplebeacon/scan', { path: projectPath });
  }

  /**
   * Fetch scan history from server.
   */
  async getScanHistory(): Promise<any[]> {
    return this.get('/api/simplebeacon/history');
  }
}
