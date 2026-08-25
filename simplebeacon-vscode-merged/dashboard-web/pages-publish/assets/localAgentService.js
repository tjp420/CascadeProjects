import { g as ke, E as ve, c as P, p as Se, V as Ae } from './main.js';
function Ee(e) {
  return String(e || '').replace(/\\/g, '/');
}
function ue(e) {
  const t = String(e || '');
  return /^([A-Za-z]:[\\/]|\\\\|\/)/.test(t);
}
function de(e, t) {
  let n = String(e || '').trim();
  if (!n) return '';
  if (ue(n)) return n;
  const r = String(t || '')
    .trim()
    .replace(/[\\/]+$/, '');
  if (!r) return n;
  try {
    const s = r.split(/[\\/]/).pop();
    s &&
      (n === s || n.indexOf(s + '/') === 0 || n.indexOf(s + '\\') === 0) &&
      (n = n.slice(s.length).replace(/^[/\\]+/, ''));
  } catch {}
  const a = r.includes('\\') ? '\\' : '/',
    o = n.replace(/^[/\\]+/, '').replace(/\//g, a);
  return `${r}${a}${o}`;
}
function $e(e, t = 1, n = {}) {
  const r = de(e, n.projectRoot);
  if (!r || !ue(r)) return null;
  const a = n.scheme || (typeof navigator < 'u' && /Cursor/i.test(navigator.userAgent || '') ? 'cursor' : 'vscode'),
    o = Ee(r),
    s = Math.max(1, Number(t) || 1);
  return /^\/\//.test(o) || /^[A-Za-z]:\//.test(o) ? `${a}://file/${o}:${s}` : `${a}://file/${o}:${s}`;
}
function ie(e, t = 1, n = {}) {
  const r = de(e, n.projectRoot);
  if (!r) return !1;
  const a = Math.max(1, Number(t) || 1),
    o = { command: 'openFile', file: r, path: r, line: a },
    s = ke();
  if (s)
    try {
      return (s.postMessage(o), !0);
    } catch {}
  if (typeof window < 'u' && window.parent && window.parent !== window)
    try {
      return (window.parent.postMessage(o, '*'), !0);
    } catch {}
  const c = $e(r, a, n);
  if (c)
    try {
      const l = document.createElement('a');
      return ((l.href = c), (l.rel = 'noopener'), l.click(), !0);
    } catch {}
  return !1;
}
const z = 'http://127.0.0.1:55432',
  Q = 'http://127.0.0.1:4000',
  ce = 'sb_api_base',
  re = 3e3,
  le = {
    windows: '/downloads/simplebeacon-scanner.exe',
    linux: '/downloads/simplebeacon-local-agent-portable.zip',
    macos: '/downloads/simplebeacon-local-agent-portable.zip',
    unknown: '/downloads/simplebeacon-local-agent-portable.zip',
  };
let A = null,
  D = 0;
const Ce = 3e4,
  _e = 12e4;
function pe(e, t) {
  const n = t && t.available ? Ce : _e;
  return e + n > Date.now();
}
let R = null,
  E = null,
  F = 0,
  O = null;
function $() {
  if (typeof window > 'u') return !1;
  const e = window.location.hostname.toLowerCase();
  return e !== 'localhost' && e !== '127.0.0.1' && e !== '[::1]' ? !1 : window.location.protocol === 'http:';
}
function Y(e) {
  if (!e) return !1;
  try {
    return new URL(String(e)).port === '4000';
  } catch {
    return String(e).includes(':4000');
  }
}
function Ve() {
  if (!$()) return !1;
  const e = G();
  let t = !1;
  if (e)
    try {
      Y(new URL(String(e).replace(/\/api\/?$/, '')).origin) && (P({ updateUrl: !0 }), (t = !0));
    } catch {}
  if (typeof window < 'u' && window.__SB_BRIDGE_HOST__ && Y(window.__SB_BRIDGE_HOST__)) {
    try {
      delete window.__SB_BRIDGE_HOST__;
    } catch {}
    t = !0;
  }
  return t;
}
function g() {
  return typeof window < 'u' && !!window.simplebeaconAgentBridge;
}
function Be() {
  return g() && typeof window.simplebeaconAgentBridge.fetch == 'function'
    ? window.simplebeaconAgentBridge.fetch.bind(window.simplebeaconAgentBridge)
    : fetch;
}
function fe() {
  if (typeof window > 'u' || !M()) return !1;
  try {
    return !!(window.parent && window.parent !== window);
  } catch {
    return !1;
  }
}
function xe(e, t = {}, n = 4e3) {
  return new Promise((r, a) => {
    if (!fe()) {
      a(new Error('Parent bridge unavailable'));
      return;
    }
    const o = `pbf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    let s = !1;
    const c = () => {
        ((s = !0), clearTimeout(l), window.removeEventListener('message', i));
      },
      l = setTimeout(() => {
        s || (c(), a(new Error('Parent bridge fetch timeout')));
      }, n),
      i = (p) => {
        const f = p == null ? void 0 : p.data;
        if (!(!f || f.command !== 'bridgeFetchResponse' || f.requestId !== o)) {
          if ((c(), f.error)) {
            a(new Error(String(f.error)));
            return;
          }
          r(
            new Response(f.body ?? '', {
              status: f.status || 200,
              headers: { 'Content-Type': f.contentType || 'application/json' },
            })
          );
        }
      };
    window.addEventListener('message', i);
    try {
      window.parent.postMessage(
        {
          command: 'bridgeFetch',
          requestId: o,
          url: e,
          init: { method: t.method || 'GET', headers: t.headers || void 0, body: t.body || void 0 },
        },
        '*'
      );
    } catch (p) {
      (c(), a(p));
    }
  });
}
function he() {
  return g()
    ? Be()
    : fe()
      ? async (e, t) => {
          try {
            return await xe(e, t);
          } catch (n) {
            const r = String((n == null ? void 0 : n.message) || n);
            if (r.includes('Parent bridge fetch timeout') || r.includes('Parent bridge unavailable'))
              return fetch(e, t);
            throw n;
          }
        }
      : fetch;
}
function G() {
  if (typeof window > 'u') return null;
  try {
    const e = new URLSearchParams(window.location.search),
      t = e.get(ce) || e.get('sb_notify_base');
    if (t) return t;
  } catch {}
  if (typeof sessionStorage < 'u')
    try {
      return sessionStorage.getItem(ce) || sessionStorage.getItem('sb_notify_base');
    } catch {}
  return null;
}
function b() {
  const e = G();
  if (!e) return null;
  try {
    const t = e.replace(/\/api\/?$/, ''),
      n = new URL(t),
      r = n.hostname.toLowerCase();
    return (r !== '127.0.0.1' && r !== 'localhost') || ($() && Y(n.origin)) ? null : n.origin;
  } catch {
    return null;
  }
}
function ee() {
  const e = b();
  return e || ($() ? null : Q);
}
function me(e) {
  const t = b();
  return !!t && t === e;
}
function M() {
  return !!b();
}
function C() {
  return he();
}
const y = 'http://127.0.0.1:11434',
  be = [54358, 54697, 58681];
function He() {
  return Ae;
}
function We(e = 'chatbot') {
  if (typeof window > 'u') return '';
  const t = /Cursor/i.test(navigator.userAgent || '') ? 'cursor' : 'vscode',
    n =
      String(e || 'chatbot')
        .replace(/^\//, '')
        .replace(/^dashboard\/?/, '') || 'chatbot';
  return `${t}://${ve}/connect?route=${encodeURIComponent(n)}`;
}
function T() {
  if (typeof window > 'u') return !1;
  const e = window.location.hostname;
  return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(e) && window.location.protocol === 'http:';
}
function ge(e) {
  const t = String(e || '')
    .trim()
    .replace(/\/+$/, '');
  return t ? (t.endsWith('/api') ? t : `${t}/api`) : null;
}
async function te(e = be, t = {}) {
  if (typeof window > 'u' || !T()) return null;
  const n = C();
  for (const r of e) {
    const a = `http://127.0.0.1:${r}`;
    if (!(I(a) && !g()))
      try {
        const o = await n(`${a}/api/ping`, { signal: AbortSignal.timeout(2200) });
        if (!o.ok) continue;
        const s = await o.json().catch(() => ({}));
        if (s && (s.online === !0 || s.status === 'ok')) return `${a}/api`;
      } catch {}
  }
  return null;
}
async function qe(e = {}) {
  const t = G(),
    n = t ? ge(t) : null;
  if (M() && n) {
    if (!T())
      return e.userInitiated && (await V()).ok
        ? { ok: !0, source: 'probe', apiBase: n }
        : j()
          ? { ok: !0, source: 'existing', apiBase: n, unverified: !0 }
          : (P({ updateUrl: !0 }), { ok: !1, source: 'stale' });
    let o = be;
    try {
      const c = Number(new URL(String(t).replace(/\/api\/?$/, '')).port);
      c && (o = [c]);
    } catch {}
    const s = await te(o);
    return s
      ? { ok: !0, source: 'existing', apiBase: s }
      : j()
        ? { ok: !0, source: 'existing', apiBase: n, unverified: !0 }
        : (P({ updateUrl: !0 }), { ok: !1, source: 'stale' });
  }
  if (!T()) return { ok: !1, source: k() ? 'hosted-https' : 'none', needsDeepLink: k() };
  const r = await te();
  return r
    ? Se(r, { websiteMode: !0, updateUrl: !0 })
      ? { ok: !0, source: 'probe', apiBase: r }
      : { ok: !1, source: 'denied' }
    : { ok: !1, source: 'none' };
}
async function Je() {
  if (typeof window > 'u') return { ok: !1 };
  const e = G();
  if (!e) return { ok: !1, source: 'none' };
  const t = ge(e);
  if (!T())
    return j()
      ? { ok: !0, apiBase: t, source: 'existing', unverified: !0 }
      : (P({ updateUrl: !0 }), { ok: !1, source: 'stale' });
  let n = 54358;
  try {
    n = Number(new URL(e.replace(/\/api\/?$/, '')).port) || 54358;
  } catch {}
  const r = await te([n]);
  return r
    ? { ok: !0, apiBase: r }
    : j()
      ? { ok: !0, apiBase: t, source: 'existing', unverified: !0 }
      : (P({ updateUrl: !0 }), { ok: !1, source: 'stale' });
}
function j() {
  if (typeof location > 'u') return !1;
  try {
    const e = new URLSearchParams(location.search);
    if (e.get('sb_api_base') || e.get('sb_notify_base')) return !0;
  } catch {}
  try {
    if (
      typeof sessionStorage < 'u' &&
      (sessionStorage.getItem('sb_api_base') || sessionStorage.getItem('sb_notify_base'))
    )
      return !0;
  } catch {}
  return !1;
}
function Le(e, t = y) {
  const n = String(t || y).replace(/\/+$/, ''),
    r = String(e || '').startsWith('/') ? String(e) : `/${e || ''}`,
    a = b();
  if (a) {
    const o = `baseUrl=${encodeURIComponent(n)}`;
    return r === '/api/tags'
      ? `${a}/api/simplebeacon/ollama/models?${o}`
      : r === '/api/chat'
        ? `${a}/api/simplebeacon/ollama/chat?${o}`
        : `${a}/api/simplebeacon/ollama/proxy?${o}&path=${encodeURIComponent(r)}`;
  }
  return `${n}${r}`;
}
async function ne(e) {
  if (!e.ok) return { ok: !1, corsBlocked: e.status === 403, status: e.status };
  try {
    const t = await e.json();
    if (t && t.source === 'ollama-proxy')
      return t.error && !(Array.isArray(t.models) && t.models.length)
        ? { ok: !1, corsBlocked: !1, status: e.status, error: t.error, bridgeReachable: !0 }
        : { ok: !0, corsBlocked: !1, status: e.status, bridgeReachable: !0 };
    if (t && Array.isArray(t.models)) return { ok: !0, corsBlocked: !1, status: e.status };
  } catch {}
  return { ok: !0, corsBlocked: !1, status: e.status };
}
function Ne(e = y) {
  const t = String(e || y).replace(/\/+$/, ''),
    n = b();
  if (!n) return [`${t}/api/tags`];
  const r = `baseUrl=${encodeURIComponent(t)}`;
  return [
    `${n}/api/simplebeacon/ollama/models?${r}`,
    `${n}/api/tags?${r}`,
    `${n}/api/simplebeacon/ollama/proxy?${r}&path=${encodeURIComponent('/api/tags')}`,
  ];
}
function Xe(e = y) {
  const t = String(e || y).replace(/\/+$/, ''),
    n = b();
  if (!n) return [`${t}/api/chat`];
  const r = `baseUrl=${encodeURIComponent(t)}`;
  return [
    `${n}/api/simplebeacon/ollama/chat?${r}`,
    `${n}/api/simplebeacon/ollama/proxy?${r}&path=${encodeURIComponent('/api/chat')}`,
  ];
}
async function V() {
  const e = b();
  if (!e) return { ok: !1, reason: 'no-bridge' };
  const t = C();
  try {
    const n = await t(`${e}/api/ping`, { signal: AbortSignal.timeout(2500) });
    if (!n.ok) return { ok: !1, reason: 'ping-failed', status: n.status };
    const r = await n.json().catch(() => ({}));
    return { ok: (r == null ? void 0 : r.online) !== !1, reason: 'ping-ok' };
  } catch (n) {
    return { ok: !1, reason: 'unreachable', error: String((n == null ? void 0 : n.message) || n) };
  }
}
async function Ze(e = y) {
  if (typeof window > 'u') return !1;
  const t = String(e || y).replace(/\/$/, '');
  if (k()) return !1;
  const n = C(),
    r = Le('/api/tags', t);
  if (k() && I(r) && !g()) return !1;
  try {
    const a = await n(r, { signal: AbortSignal.timeout(2500) });
    return (await ne(a)).ok;
  } catch {
    return !1;
  }
}
async function Ke(e = y) {
  if (typeof window > 'u') return { ok: !1, corsBlocked: !1, status: 0 };
  const t = String(e || y).replace(/\/$/, ''),
    n = typeof window < 'u' ? window.location.origin : 'https://simplebeacon.ai',
    r = C(),
    a = M(),
    o = a ? await V() : { ok: !1 },
    s = Ne(t);
  let c = { ok: !1, corsBlocked: !1, status: 0, error: '' };
  for (const l of s)
    try {
      const i = await r(l, { signal: AbortSignal.timeout(4e3) }),
        p = await ne(i);
      if (((c = { ...p, status: p.status || i.status }), p.ok)) return { ok: !0, corsBlocked: !1, status: p.status };
      if (i.status !== 404) break;
    } catch (i) {
      const p = String((i == null ? void 0 : i.message) || i).toLowerCase();
      if (
        ((c = {
          ok: !1,
          corsBlocked:
            p.includes('local network access') ||
            p.includes('private network access') ||
            p.includes('permission required'),
          status: 0,
          error: String((i == null ? void 0 : i.message) || i),
        }),
        !a)
      )
        break;
    }
  if (a)
    return o.ok && c.status === 404
      ? {
          ok: !1,
          corsBlocked: !1,
          status: 404,
          error:
            'Extension data server is running but Ollama proxy routes returned 404. Install the latest SimpleBeacon VSIX, reload VS Code, then run ollama serve locally.',
        }
      : o.ok && c.bridgeReachable && c.error
        ? { ok: !1, corsBlocked: !1, status: c.status || 502, error: `Extension bridge connected. ${c.error}` }
        : o.ok
          ? {
              ok: !1,
              corsBlocked: !1,
              status: c.status,
              error: c.error || 'Extension bridge could not reach Ollama. Run ollama serve locally.',
            }
          : {
              ok: !1,
              corsBlocked: c.corsBlocked,
              status: c.status,
              error: c.corsBlocked
                ? `Browser blocked access to the VS Code extension data server. Grant Local Network Access for ${n}, or open this page from the SimpleBeacon sidebar in VS Code.`
                : 'Extension data server unreachable. Reload the VS Code extension and try again.',
            };
  try {
    const l = await r(s[0], { signal: AbortSignal.timeout(4e3) }),
      i = await ne(l);
    return i.ok
      ? { ok: !0, corsBlocked: !1, status: i.status }
      : { ok: !1, corsBlocked: l.status === 403, status: l.status, error: i.error };
  } catch (l) {
    const i = String((l == null ? void 0 : l.message) || l).toLowerCase();
    return {
      ok: !1,
      corsBlocked:
        i.includes('local network access') ||
        i.includes('private network access') ||
        i.includes('permission required') ||
        i.includes('cors') ||
        i.includes('cross-origin') ||
        i.includes('networkerror') ||
        i.includes('failed to fetch'),
      status: 0,
    };
  }
}
async function Qe(e) {
  const t = b();
  if (!t || !(await V()).ok) return null;
  const r = C();
  try {
    const o = await (await r(`${t}/api/status`, { headers: { Accept: 'application/json' } })).json().catch(() => ({}));
    if (
      o.workspace &&
      (String(o.workspace).replace(/\\/g, '/').split('/').pop() || '').toLowerCase() === String(e).toLowerCase()
    )
      return String(o.workspace);
  } catch {}
  try {
    const a = await r(
        `${t}/api/find-folder`,
        {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderName: e }),
        },
        25e3
      ),
      o = await a.json().catch(() => ({}));
    if (!a.ok) return null;
    const s = Array.isArray(o.results) ? o.results : [];
    return s.length > 0 ? String(s[0]) : null;
  } catch {
    return null;
  }
}
async function Ye() {
  const e = b();
  if (!e || !(await V()).ok) return null;
  const n = C();
  try {
    const r = await n(
        `${e}/api/analyze/pick-folder`,
        { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{}' },
        re
      ),
      a = await r.json().catch(() => ({}));
    return !r.ok || a.success !== !0 ? null : String(a.path || '').trim() || null;
  } catch {
    return null;
  }
}
async function _(e, t = {}, n = 3e5) {
  const r = he(),
    a = new Promise((s, c) => {
      setTimeout(() => c(new Error('Local agent request timed out')), n);
    });
  return await Promise.race([r(e, t), a]);
}
function Re(e) {
  const t = String(e || '').trim();
  return !t || /^https?:\/\//i.test(t) || /^file:\/\//i.test(t)
    ? !1
    : typeof navigator < 'u' && /Win(dows|32|64)/i.test(navigator.userAgent || '')
      ? /^[A-Za-z]:[\\/]/.test(t) || /^\\\\/.test(t)
      : /^[A-Za-z]:[\\/]/.test(t) || /^\/[^/]/.test(t) || /^~[\\/]/.test(t) || /^\\\\/.test(t);
}
async function et(e = z) {
  return De()
    ? A && pe(D, A)
      ? A
      : R ||
        ((R = (async () => {
          if (!g() && I(e)) {
            const t = { available: !1, scannerAvailable: !1, likelyBlocked: !0 };
            return ((A = t), (D = Date.now()), t);
          }
          try {
            const t = await _(`${e}/health`, { method: 'GET', headers: { Accept: 'application/json' } }, re),
              n = await t.json().catch(() => ({})),
              r = {
                available: t.ok && n.success === !0,
                scannerAvailable: !!n.scannerAvailable,
                scannerLoadError: n.scannerLoadError || void 0,
                version: n.version || void 0,
              };
            return ((A = r), (D = Date.now()), r);
          } catch (t) {
            return (
              (A = { available: !1, scannerAvailable: !1, likelyBlocked: !g() && Oe(e, t) }),
              (D = Date.now()),
              A
            );
          } finally {
            R = null;
          }
        })()),
        R)
    : $()
      ? je
      : Fe;
}
function Oe(e, t) {
  if (I(e)) return !0;
  if (!e || !e.startsWith('http://') || typeof window > 'u' || window.location.protocol !== 'https:') return !1;
  const n = String((t == null ? void 0 : t.message) || '').toLowerCase();
  return (
    n.includes('mixed content') ||
    n.includes('insecure') ||
    n.includes('blocked') ||
    n.includes('failed to fetch') ||
    n.includes('ns_error')
  );
}
function I(e) {
  if (!e || !e.startsWith('http://') || typeof window > 'u' || window.location.protocol !== 'https:') return !1;
  try {
    var t = new URLSearchParams(window.location.search);
    if (
      t.get('sb_api_base') ||
      t.get('sb_notify_base') ||
      (typeof sessionStorage < 'u' &&
        (sessionStorage.getItem('sb_api_base') || sessionStorage.getItem('sb_notify_base')))
    )
      return !1;
  } catch {}
  return !0;
}
async function tt(e, t = {}, n = z) {
  const r = await _(`${n}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ projectPath: e, fullDirectoryScan: t.fullDirectoryScan }),
    }),
    a = await r.json().catch(() => ({}));
  if (!r.ok || !a.success) throw new Error(a.error || `Agent inventory failed (${r.status})`);
  return a.inventory;
}
async function nt(e, t = {}, n = z) {
  let r = n,
    a = t;
  typeof t == 'string' && ((r = t), (a = {}));
  const o = await _(
      `${r}/scan`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ projectPath: e, fullDirectoryScan: a.fullDirectoryScan === !0 }),
      },
      6e5
    ),
    s = await o.json().catch(() => ({}));
  if (!o.ok || !s.success) throw new Error(s.error || `Agent scan failed (${o.status})`);
  return s.report;
}
async function rt(e, t = z) {
  const n = new URLSearchParams({ projectPath: String(e || '') }),
    r = await _(`${t}/progress?${n}`, { headers: { Accept: 'application/json' } }, 15e3),
    a = await r.json().catch(() => ({}));
  return !r.ok || !a.success ? { active: !1 } : a.progress || { active: !1 };
}
async function at(e) {
  const t = b();
  if (!t) return { active: !1, endpointUnavailable: !0 };
  const n = new URLSearchParams({ projectPath: String(e || '') });
  try {
    const r = await _(`${t}/api/simplebeacon/scan/progress?${n}`, { headers: { Accept: 'application/json' } }, 15e3),
      a = await r.json().catch(() => ({}));
    return r.status === 404
      ? { active: !1, endpointUnavailable: !0 }
      : r.ok
        ? a.progress || { active: !1 }
        : { active: !1 };
  } catch {
    return { active: !1, endpointUnavailable: !0 };
  }
}
async function ot(e = ee()) {
  if (!Ue())
    return { available: !1, likelyBlocked: !1, extensionBridge: !1, origin: ee() || Q, integratedSkipped: $() };
  if (!e) return { available: !1, likelyBlocked: !1, extensionBridge: !1, origin: Q, integratedSkipped: !0 };
  const t = me(e);
  return k() && !t && !g()
    ? { available: !1, likelyBlocked: !1, extensionBridge: !1, origin: e, hostedSkipped: !0 }
    : E && E.origin === e && pe(F, E)
      ? E
      : O ||
        ((O = (async () => {
          if (!t && !g() && I(e)) {
            const n = { available: !1, likelyBlocked: !0, extensionBridge: t, origin: e };
            return ((E = n), (F = Date.now()), n);
          }
          try {
            const n = await _(`${e}/api/ping`, { method: 'GET', headers: { Accept: 'application/json' } }, re),
              r = await n.json().catch(() => ({})),
              a = { available: n.ok && r.online === !0, extensionBridge: t, origin: e };
            return ((E = a), (F = Date.now()), a);
          } catch {
            const r = { available: !1, extensionBridge: t, origin: e };
            return ((E = r), (F = Date.now()), r);
          } finally {
            O = null;
          }
        })()),
        O);
}
const Pe = 1500,
  Te = 300 * 1e3;
async function Ie(e, t, n) {
  const r = Date.now();
  let a = 0;
  for (; Date.now() - r < Te;) {
    await new Promise((o) => setTimeout(o, Pe));
    try {
      if (
        !(
          (
            await (
              await n(`${e}/api/simplebeacon/scan/progress?projectPath=${encodeURIComponent(t)}`)
            )
              .json()
              .catch(() => ({}))
          ).progress || {}
        ).active
      ) {
        if ((a++, a >= 3)) {
          const i = await (await n(`${e}/api/report`)).json().catch(() => ({}));
          if (i && Object.keys(i).length > 0) return i;
          throw new Error('Scan completed but no report is available');
        }
        continue;
      }
      a = 0;
    } catch (o) {
      throw new Error(`Scan polling failed: ${o.message || o}`);
    }
  }
  throw new Error('Scan timed out after 5 minutes');
}
async function st(e, t = ee()) {
  if (me(t)) {
    const a = C(),
      o = await a(`${t}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ path: e }),
      }),
      s = await o.json().catch(() => ({}));
    if (!o.ok || !s.success) throw new Error(s.error || s.warning || `Extension scan failed (${o.status})`);
    return s.scanning
      ? {
          success: !0,
          extensionBridge: !0,
          report: await Ie(t, e, a),
          path: e,
          scannedPath: s.scannedPath || e,
          metrics: null,
        }
      : {
          success: !0,
          extensionBridge: !0,
          report: s.report,
          path: e,
          scannedPath: s.scannedPath || e,
          metrics: s.metrics,
        };
  }
  const n = await _(`${t}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ path: e }),
    }),
    r = await n.json().catch(() => ({}));
  if (!n.ok || !r.success) throw new Error(r.error || `Agent scan failed (${n.status})`);
  return r;
}
function it(e, t) {
  if (!t) return;
  t.replaceChildren();
  const n = e && e.certificate;
  if (!n) return;
  const r = e.files || [],
    a = r.filter((d) => d.status && d.status !== 'Clean'),
    o = r.length - a.length,
    s = typeof e.discoveredFiles == 'number' ? e.discoveredFiles : r.length,
    c = typeof e.skippedFiles == 'number' ? e.skippedFiles : 0,
    l = e.verifiedAddress || e.path || '',
    i = document.createElement('div');
  ((i.className = 'sb-compliance-report'), i.style.setProperty('--sb-grade-color', n.badgeColor || '#6366f1'));
  const p = document.createElement('div');
  p.className = 'sb-compliance-hero';
  const f = document.createElement('div');
  f.className = 'sb-compliance-hero-main';
  const H = document.createElement('div');
  ((H.className = 'sb-compliance-eyebrow'), (H.textContent = 'Scan complete'));
  const W = document.createElement('h3');
  ((W.className = 'sb-compliance-title'), (W.textContent = 'Compliance summary'));
  const q = document.createElement('p');
  ((q.className = 'sb-compliance-status'),
    (q.textContent = n.complianceStatus || 'Review required'),
    f.appendChild(H),
    f.appendChild(W),
    f.appendChild(q));
  const U = document.createElement('div');
  ((U.className = 'sb-compliance-grade'),
    U.setAttribute('aria-label', `Grade ${n.letterGrade || '?'}`),
    (U.textContent = n.letterGrade || '?'),
    p.appendChild(f),
    p.appendChild(U),
    i.appendChild(p));
  const J = document.createElement('div');
  if (
    ((J.className = 'sb-compliance-metrics'),
    [
      { label: 'Files scanned', value: `${r.length} / ${s}` },
      { label: 'Heuristic score', value: `${n.score || 0}/100` },
      { label: 'Issues flagged', value: String(a.length) },
      { label: 'Risk liability', value: n.liabilityStr || '$0', danger: !0 },
      ...(c > 0 ? [{ label: 'Skipped', value: `${c} unreadable` }] : []),
    ].forEach((d) => {
      const m = document.createElement('div');
      m.className = 'sb-compliance-metric';
      const h = document.createElement('span');
      ((h.className = 'sb-compliance-metric-label'), (h.textContent = d.label));
      const v = document.createElement('strong');
      ((v.className = d.danger ? 'sb-compliance-metric-danger' : ''),
        (v.textContent = d.value),
        m.appendChild(h),
        m.appendChild(v),
        J.appendChild(m));
    }),
    i.appendChild(J),
    l)
  ) {
    const d = document.createElement('div');
    ((d.className = 'sb-compliance-path'), (d.textContent = l), i.appendChild(d));
  }
  const X = document.createElement('div');
  if (
    ((X.className = 'sb-compliance-actions'),
    [
      { label: 'View all findings', route: 'results' },
      { label: 'Remediation roadmap', route: 'roadmap' },
      { label: 'Export report', route: 'export' },
    ].forEach((d) => {
      const m = document.createElement('button');
      ((m.type = 'button'),
        (m.className = d.route === 'results' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'),
        (m.textContent = d.label),
        m.addEventListener('click', () => {
          const h = typeof window < 'u' ? window.simplebeaconApp : null;
          if (d.route === 'export') {
            h && h.scanService && typeof h.scanService.exportReport == 'function' && h.scanService.exportReport();
            return;
          }
          h && typeof h.navigate == 'function' && h.navigate(d.route);
        }),
        X.appendChild(m));
    }),
    i.appendChild(X),
    r.length)
  ) {
    const d = document.createElement('details');
    ((d.className = 'sb-compliance-files'), (d.open = a.length > 0 && a.length <= 12));
    const m = document.createElement('summary');
    ((m.textContent = `File inventory (${a.length} flagged · ${o} clean)`), d.appendChild(m));
    const h = document.createElement('div');
    h.className = 'sb-compliance-files-toolbar';
    let v = 'issues';
    const ye = [
        { id: 'issues', label: `Issues (${a.length})` },
        { id: 'all', label: `All (${r.length})` },
        { id: 'clean', label: `Clean (${o})` },
      ],
      L = document.createElement('div');
    L.className = 'sb-compliance-files-list';
    const oe = () => {
      L.replaceChildren();
      let S = r;
      v === 'issues' ? (S = a) : v === 'clean' && (S = r.filter((u) => !u.status || u.status === 'Clean'));
      const w = v === 'all' ? 80 : 120;
      if (
        (S.slice(0, w).forEach((u) => {
          const B = document.createElement('div'),
            se = !u.status || u.status === 'Clean';
          B.className = `sb-compliance-file-row${se ? ' is-clean' : ' is-issue'}`;
          const Z = document.createElement('span');
          ((Z.className = 'sb-compliance-file-badge'), (Z.textContent = se ? 'Clean' : String(u.status)));
          const x = document.createElement('span');
          ((x.className = 'sb-compliance-file-path'),
            (x.textContent = u.absolutePath || u.name || ''),
            (u.absolutePath || u.name) &&
              ((x.style.cursor = 'pointer'),
              (x.title = 'Open in editor'),
              x.addEventListener('click', () => {
                ie(u.absolutePath || u.name, u.line || 1, { projectRoot: l });
              })));
          const N = document.createElement('button');
          ((N.type = 'button'),
            (N.className = 'btn btn-ghost btn-xs'),
            (N.textContent = 'Open'),
            N.addEventListener('click', () => {
              ie(u.absolutePath || u.name, u.line || 1, { projectRoot: l });
            }));
          const K = document.createElement('span');
          ((K.className = 'sb-compliance-file-size'),
            (K.textContent = `${u.size || 0} B`),
            B.appendChild(Z),
            B.appendChild(x),
            B.appendChild(N),
            B.appendChild(K),
            L.appendChild(B));
        }),
        S.length > w)
      ) {
        const u = document.createElement('div');
        ((u.className = 'sb-compliance-files-more text-muted'),
          (u.textContent = `+ ${S.length - w} more files — run a full export for the complete inventory.`),
          L.appendChild(u));
      }
    };
    (ye.forEach((S) => {
      const w = document.createElement('button');
      ((w.type = 'button'),
        (w.className = `btn btn-ghost btn-xs sb-compliance-filter${S.id === v ? ' is-active' : ''}`),
        (w.textContent = S.label),
        w.addEventListener('click', () => {
          ((v = S.id),
            h.querySelectorAll('.sb-compliance-filter').forEach((u) => u.classList.remove('is-active')),
            w.classList.add('is-active'),
            oe());
        }),
        h.appendChild(w));
    }),
      d.appendChild(h),
      d.appendChild(L),
      oe(),
      i.appendChild(d));
  }
  t.appendChild(i);
  const ae = t.closest('#analyze-path-dropzone');
  ae && ae.classList.add('has-compliance-report');
}
function ct(e, t) {
  return !(t != null && t.available) || !(t != null && t.scannerAvailable) ? !1 : Re(e);
}
function k() {
  return typeof window > 'u' || /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
    ? !1
    : window.location.protocol === 'https:';
}
function Ue() {
  return g() || b() ? !0 : k() || $() ? !1 : T();
}
function De() {
  return k() ? g() || M() : !($() && !b() && !g());
}
const Fe = { available: !1, scannerAvailable: !1, hostedSkipped: !0 },
  je = { available: !1, scannerAvailable: !1, integratedSkipped: !0 };
function lt(e) {
  return !e || (k() && (!e.available || e.hostedSkipped))
    ? ''
    : e.available
      ? e.scannerAvailable
        ? `Local agent connected${e.version ? ` (v${e.version})` : ''}`
        : `Local agent connected, but scanner is not available${e.scannerLoadError ? `: ${e.scannerLoadError}` : ''}`
      : e.likelyBlocked && !k()
        ? 'Local agent blocked by HTTPS mixed-content policy — use Chrome/Edge or download the Local Scan Agent below'
        : 'Local agent offline — download the Local Scan Agent portable zip and run start-agent.bat';
}
function we() {
  if (typeof window > 'u' || !window.navigator) return 'unknown';
  const e = window.navigator.userAgent.toLowerCase();
  return e.includes('win')
    ? 'windows'
    : e.includes('mac') || e.includes('darwin')
      ? 'macos'
      : e.includes('linux')
        ? 'linux'
        : 'unknown';
}
function ut(e) {
  const t = e || we();
  return le[t] || le.unknown;
}
function dt(e) {
  var t, n, r;
  if (k() && (!(e != null && e.available) || (e != null && e.hostedSkipped)))
    return 'Use Select Folder above to scan your project privately in this browser. Typed PC paths cannot be read from the hosted dashboard.';
  if (!((t = e) === null || t === void 0) && t.likelyBlocked)
    return 'HTTPS blocks direct access to the Local Scan Agent. Install the Simplebeacon Browser Extension, open this page in Chrome/Edge, or run the local dashboard.';
  if (!(!((n = e) === null || n === void 0) && n.available))
    return 'Local Scan Agent is offline. Download and run it from the link below, then try again.';
  if (!(!((r = e) === null || r === void 0) && r.scannerAvailable)) {
    var a;
    return `Local Scan Agent is running but the scanner is not loaded.${!((a = e) === null || a === void 0) && a.scannerLoadError ? ` (${e.scannerLoadError})` : ''} Restart the agent or reinstall the portable package.`;
  }
  return 'Local Scan Agent is not ready.';
}
function pt(e) {
  const t = { windows: 'Windows', linux: 'Linux', macos: 'macOS', unknown: 'your platform' };
  return t[e] || t.unknown;
}
function ft(e) {
  const t = e || we();
  return t === 'windows'
    ? 'Run the downloaded .exe and follow the prompts. The installer will start the agent automatically.'
    : t === 'linux' || t === 'macos' || t === 'unknown'
      ? 'Extract the downloaded zip, open a terminal in the extracted folder, and run: ./install.sh'
      : '';
}
export {
  xe as bridgeFetchViaParent,
  Xe as buildBridgeOllamaChatUrls,
  Ne as buildBridgeOllamaProbeUrls,
  We as buildExtensionConnectDeepLink,
  fe as canUseParentBridgeFetch,
  Ve as clearStaleIntegratedBridgeParams,
  we as detectPlatform,
  qe as discoverAndApplyExtensionBridge,
  tt as fetchInventoryViaAgent,
  rt as fetchScanProgressViaAgent,
  at as fetchScanProgressViaExtensionBridge,
  Qe as findFolderViaBridge,
  lt as formatAgentStatus,
  ut as getAgentDownloadUrl,
  dt as getAgentFallbackMessage,
  he as getBridgeFetch,
  b as getExtensionBridgeOrigin,
  ft as getInstallInstructions,
  C as getLocalBridgeFetch,
  pt as getPlatformLabel,
  He as getVsixDownloadUrl,
  j as hasExplicitBridgeParam,
  M as hasExtensionBridgeConfigured,
  k as isHostedHttpsDashboard,
  $ as isIntegratedLocalDashboard,
  Re as isLocalPath,
  Ye as pickFolderViaExtensionBridge,
  et as probeAgent,
  ot as probeAgent4000,
  V as probeExtensionBridgeHealth,
  te as probeExtensionDataServer,
  Ze as probeLocalOllama,
  Ke as probeUserInitiatedOllama,
  it as renderAgentCertificate,
  Le as resolveOllamaProxyUrl,
  nt as scanViaAgent,
  st as scanViaAgent4000,
  Ue as shouldProbeAgent4000,
  De as shouldProbeLocalAgent,
  ct as shouldUseAgent,
  Je as validateExtensionBridgeOnLoad,
};
//# sourceMappingURL=localAgentService.js.map
