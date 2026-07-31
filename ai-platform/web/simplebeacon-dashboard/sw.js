'use strict';

const SW_VERSION = 'v1.0.0';
const STATIC_CACHE = `sb-static-${SW_VERSION}`;
const RUNTIME_CACHE = `sb-runtime-${SW_VERSION}`;
const HTML_CACHE = `sb-html-${SW_VERSION}`;

const STATIC_ASSET_PATTERNS = [
  /\/dashboard\/assets\/.*\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/,
  /\/dashboard\/js\/.*\.js$/,
  /\/dashboard\/css\/.*\.css$/,
  /\/dashboard\/images\/.*\.(svg|png|jpg|jpeg|gif|webp|ico)$/,
  /\/dashboard\/fonts\/.*\.(woff2?|ttf|eot)$/,
];

const CDN_PATTERNS = [
  /cdn\.jsdelivr\.net/,
  /cdnjs\.cloudflare\.com/,
];

const API_PATTERNS = [
  /\/api\//,
];

const PRECACHE_URLS = [
  '/dashboard/assets/main.js',
  '/dashboard/assets/main.css',
  '/dashboard/assets/vendor-radix.js',
  '/dashboard/assets/vendor-lucide.js',
  '/dashboard/assets/authService.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE, HTML_CACHE].includes(key))
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin && !CDN_PATTERNS.some((p) => p.test(url.href))) return;

  if (CDN_PATTERNS.some((p) => p.test(url.href))) {
    event.respondWith(cacheFirst(req, STATIC_CACHE, 30 * 24 * 60 * 60));
    return;
  }

  if (STATIC_ASSET_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  if (url.pathname === '/dashboard' || url.pathname === '/dashboard/' || url.pathname.startsWith('/dashboard/')) {
    if (req.mode === 'navigate' || req.destination === 'document') {
      event.respondWith(networkFirst(req, HTML_CACHE));
      return;
    }
  }

  if (API_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      return cached || fetch(req).catch(() => cached);
    })
  );
});

async function cacheFirst(req, cacheName, maxAgeSec) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) {
    if (maxAgeSec) {
      const dateHeader = cached.headers.get('date');
      if (dateHeader) {
        const age = (Date.now() - new Date(dateHeader).getTime()) / 1000;
        if (age > maxAgeSec) {
          fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); }).catch(() => {});
        }
      }
    }
    return cached;
  }
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(req);
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
