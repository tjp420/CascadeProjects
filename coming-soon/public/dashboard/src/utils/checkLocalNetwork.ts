export async function checkLocalNetworkAccess(apiBase: string, timeoutMs = 2000): Promise<boolean> {
    if (!apiBase) return false;
    try {
        const url = `${apiBase.replace(/\/+$/, '')}/api/health`;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            signal: controller.signal
        });
        clearTimeout(id);
        return res.ok || res.status === 401 || res.status === 403 || res.status === 404;
    } catch {
        return false;
    }
}

export function isLoopbackHost(apiBase: string): boolean {
    try {
        const u = new URL(apiBase);
        return /^(127\.0\.0\.1|localhost|\[::1\])$/.test(u.hostname);
    } catch {
        return false;
    }
}
