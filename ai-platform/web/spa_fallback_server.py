"""
Small static server with SPA fallback for /dashboard/* paths.
Usage: python spa_fallback_server.py [port]

Environment variables:
  API_SERVER_PORT - Port of the Node.js API server (default: 58000)
  API_SERVER_HOST - Host of the Node.js API server (default: localhost)
"""
import http.server
import json
import socketserver
import socket
import sys
import os
import re
import urllib.request
import urllib.error
import logging

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8003
WEBROOT = os.path.dirname(__file__)
INDEX = os.path.join(WEBROOT, 'dashboard', 'index.html')

API_SERVER_HOST = os.environ.get('API_SERVER_HOST', 'localhost')
API_SERVER_PORT = os.environ.get('API_SERVER_PORT', '58000')
API_BASE_URL = os.environ.get('DASHBOARD_BASE_URL', f'http://{API_SERVER_HOST}:{API_SERVER_PORT}')

# Pre-read and patch index.html with runtime config so the dashboard's apiBaseUrl()
# resolves API calls to the real Node.js server instead of this static-only port.
_index_html_cache = None
_index_html_mtime = 0

def _get_index_html():
    global _index_html_cache, _index_html_mtime
    try:
        mtime = os.path.getmtime(INDEX)
        if _index_html_cache and mtime == _index_html_mtime:
            return _index_html_cache
        with open(INDEX, 'r', encoding='utf-8') as f:
            html = f.read()
        # Prefer same-origin API during local development when the API server
        # is configured as localhost so client calls hit our stubs instead
        # of contacting another local port which may not implement all routes.
        api_base_for_inject = API_BASE_URL
        try:
            host_lower = API_SERVER_HOST.lower() if isinstance(API_SERVER_HOST, str) else ''
        except Exception:
            host_lower = ''
        if host_lower in (socket.gethostbyname('localhost'), 'localhost'):
            api_base_for_inject = '/'
        else:
            try:
                probe_url = f"{API_BASE_URL.rstrip('/')}/api/platform/status"
                urllib.request.urlopen(probe_url, timeout=1)
            except Exception:
                api_base_for_inject = '/'
        runtime_config = json.dumps({
            'DASHBOARD_BASE_URL': api_base_for_inject,
            'OLLAMA_DEFAULT_URL': os.environ.get('OLLAMA_DEFAULT_URL', f"http://{os.environ.get('OLLAMA_HOST','localhost')}:{os.environ.get('OLLAMA_PORT','11434')}")
        })
        # Inject a meta tag so client `apiBaseUrl()` picks up the correct base,
        # and also expose the runtime config to scripts as a fallback.
        meta_tag = f'<meta name="api-base-url" content="{api_base_for_inject}">' 
        inject_script = f'<script>window.__SIMPLEBEACON_ENV__={runtime_config};</script>'
        # Inject right after <head> (or after <base> if present)
        html = re.sub(r'(<head>(?:\s*<base[^>]*>)?)', r'\1' + meta_tag + inject_script, html, count=1)
        _index_html_cache = html
        _index_html_mtime = mtime
        return html
    except Exception:
        return None


DEMO_JSON_PATH = os.path.join(WEBROOT, 'demo', 'simplebeacon-demo-report.json')

def _load_demo_json():
    try:
        with open(DEMO_JSON_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None

class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    # Lightweight API stubs to support local dashboard validation
    def _json_response(self, code, obj):
        data = bytes((json.dumps(obj)), 'utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _serve_index_html(self):
        html = _get_index_html()
        if html is None:
            self.send_error(404, 'index.html not found')
            return
        # If the incoming request includes IDE/embed query params, inject
        # lightweight HTML attributes so static HTML-based checks (curl)
        # and server-side renderings can hide the URL bar and sidebar.
        try:
            from urllib.parse import urlsplit, parse_qs
            qs = parse_qs(urlsplit(self.path).query or '')
            sb_parent = qs.get('sb_parent_urlbar', ['0'])[0] == '1'
            sb_website = qs.get('sb_website_mode', ['0'])[0] == '1'
            # Force a fresh read of index.html when embed params are present
            # to avoid serving a cached variant that lacks injected attributes.
            if sb_parent or sb_website:
                try:
                    global _index_html_cache, _index_html_mtime
                    _index_html_cache = None
                    html = _get_index_html()
                    if html is None:
                        self.send_error(404, 'index.html not found')
                        return
                except Exception:
                    pass
            if sb_parent or sb_website:
                # Inject attributes into <html ...> tag while preserving existing attributes
                try:
                    if 'data-parent-urlbar' not in html:
                        html = re.sub(r'<html\b([^>]*)>', r'<html\1 data-parent-urlbar="1" data-ide-embed="1">', html, count=1)
                    # Also inject a small inline script to set runtime flags so that
                    # client-side rendering immediately hides chrome for IDE previews.
                    inject_runtime_flag = '<script>try{document.documentElement.setAttribute("data-parent-urlbar","1");document.documentElement.setAttribute("data-ide-embed","1");window.__SB_PARENT_URL_BAR__=true;window.__SB_IDE_EMBED__=true;}catch(e){};</script>'
                    # Place runtime flag script after opening <head>
                    html = re.sub(r'(<head[^>]*>)', r"\1" + inject_runtime_flag, html, count=1)
                except Exception:
                    pass
        except Exception:
            pass
        data = html.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, no-transform')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        # Serve patched index.html for dashboard SPA routes
        from urllib.parse import urlsplit
        clean_path = urlsplit(self.path).path
        if clean_path.startswith('/dashboard'):
            rel = clean_path[len('/dashboard'):]
            if rel == '' or rel == '/':
                return self._serve_index_html()
            # try file under dashboard first
            candidate = os.path.join(WEBROOT, 'dashboard', rel.lstrip('/'))
            if os.path.exists(candidate) and os.path.isfile(candidate):
                return super().do_GET()
            # SPA fallback to index.html for client-side routes
            return self._serve_index_html()
        # API requests: stub a few for local dev, proxy the rest to Node server
        if self.path.startswith('/api/'):
            # If demo explicitly requested via query param, serve demo JSON
            try:
                from urllib.parse import urlsplit, parse_qs
                qs = parse_qs(urlsplit(self.path).query or '')
                sb_demo = qs.get('sb_demo', ['0'])[0] == '1'
            except Exception:
                sb_demo = False
            if sb_demo:
                demo = _load_demo_json()
                if demo is not None:
                    return self._json_response(200, demo)
            # Local stub for theme so dev pages don't spam 404s when no API server is running
            if self.path.startswith('/api/theme'):
                return self._json_response(200, {"theme": "dark"})
            # Beacon-style notify used by image-based fallback
            if self.path.startswith('/api/notify/beacon'):
                # Accept beacon GETs, respond success (200 OK)
                return self._json_response(200, {"ok": True})
            if self.path.startswith('/api/platform/status'):
                return self._json_response(200, {"status": "ok", "version": "dev"})
            if self.path.startswith('/api/simplebeacon/ci/telemetry/summary'):
                return self._json_response(200, {"summary": {"totalRuns": 0, "successRate": 0, "recentRuns": []}})
            if self.path.startswith('/api/auth/me'):
                user = {"id": "user-emergency", "email": "admin@simplebeacon.ai", "name": "Emergency Admin"}
                return self._json_response(200, {"user": user})
            # If path is an analyze/report-ish endpoint and API is unavailable,
            # we'll try proxying, but on upstream failure we'll return demo JSON.
            return self._proxy_to_api('GET')
        # Favicon — return 204 to avoid 404 noise
        if clean_path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
            return
        # SPA routes outside /dashboard (e.g. /audit, /roadmap, /pricing, /signin)
        # — serve index.html so client-side router can handle them.
        SPA_ROUTES = ('/audit', '/roadmap', '/pricing', '/signin', '/register',
                       '/security', '/quality', '/tools', '/platform', '/analyze',
                       '/results', '/help', '/features', '/settings', '/about',
                       '/trust', '/repository-health', '/chatbot', '/upload',
                       '/remediation', '/profile', '/admin', '/getting-started')
        if clean_path in SPA_ROUTES or clean_path.startswith('/dashboard/'):
            return self._serve_index_html()
        # Try static file from webroot
        candidate = os.path.join(WEBROOT, clean_path.lstrip('/'))
        if os.path.exists(candidate) and os.path.isfile(candidate):
            return super().do_GET()
        # Final SPA fallback for any other non-file path
        if '.' not in os.path.basename(clean_path):
            return self._serve_index_html()
        return super().do_GET()

    def _proxy_to_api(self, method):
        """Proxy /api/* requests to the Node.js API server."""
        url = f'{API_BASE_URL}{self.path}'
        length = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(length) if length else b''
        headers = {k: v for k, v in self.headers.items() if k.lower() not in ('host', 'content-length')}
        req = urllib.request.Request(url, data=body if body else None, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                for k, v in resp.getheaders():
                    if k.lower() not in ('transfer-encoding', 'connection'):
                        self.send_header(k, v)
                self.send_header('Content-Length', str(len(resp_body)))
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as e:
            resp_body = e.read()
            # If the upstream API returns 404 for the notify bridge, treat it
            # as a local-notify-missing case and return a harmless success so
            # the browser doesn't keep spamming 404s.
            if e.code == 404 and self.path.startswith('/api/notify'):
                return self._json_response(200, {"ok": True})
            self.send_response(e.code)
            self.send_header('Content-Type', e.headers.get('Content-Type', 'application/json'))
            self.send_header('Content-Length', str(len(resp_body)))
            self.end_headers()
            self.wfile.write(resp_body)
        except Exception as e:
            # Node API server unreachable — if this is a report/analyze path,
            # serve a local demo fixture; otherwise return a harmless JSON.
            try:
                path = self.path or ''
                if any(path.startswith(p) for p in ('/api/analyze', '/api/simplebeacon', '/api/scan', '/api/reports', '/api/coverage', '/api/report')):
                    demo = _load_demo_json()
                    if demo is not None:
                        return self._json_response(200, demo)
            except Exception:
                pass
            self._json_response(200, {"ok": False, "message": "API server unavailable"})

    def do_POST(self):
        if self.path.startswith('/api/'):
            length = int(self.headers.get('Content-Length') or 0)
            body = self.rfile.read(length) if length else b''
            try:
                payload = json.loads(body.decode('utf-8')) if body else {}
            except Exception:
                payload = {}
            if self.path.startswith('/api/auth/login'):
                token = 'dev-local-token'
                user = {"id": "user-emergency", "email": payload.get('email', 'admin@simplebeacon.ai'), "name": "Emergency Admin"}
                return self._json_response(200, {"token": token, "user": user})
            if self.path.startswith('/api/auth/logout'):
                return self._json_response(200, {"ok": True})
            # Local stub for notify bridge so POSTs succeed during local dev
            if self.path.startswith('/api/notify'):
                # Accept notify POSTs and return minimal success response
                return self._json_response(200, {"ok": True})
            return self._proxy_to_api('POST')
        return super().do_POST()

    def log_message(self, format, *args):
        logging.info(format % args)

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    os.chdir(WEBROOT)
    handler = SPARequestHandler
    BIND_HOST = os.environ.get('BIND_HOST', 'localhost')
    with socketserver.TCPServer((BIND_HOST, PORT), handler) as httpd:
        logging.info(f"Serving {WEBROOT} on http://{BIND_HOST}:{PORT}/ with SPA fallback")
        logging.info(f"API base URL: {API_BASE_URL} (set API_SERVER_PORT or DASHBOARD_BASE_URL to change)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            logging.info('Shutting down')
            httpd.server_close()
