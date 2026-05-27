/**
 * Service Worker for AI Coding Intelligence Dashboard
 * Implements caching strategies for improved performance and offline support
 */

const CACHE_NAME = 'ai-dashboard-v2';
const STATIC_CACHE = 'static-v2';
const API_CACHE = 'api-v1';
const DASHBOARD_CACHE = 'dashboard-v2';

// URLs to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/dashboard_components/api-client.js',
    '/dashboard_components/dashboard-core.js'
];

// Cache sizes
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log('[Service Worker] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    
    self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== STATIC_CACHE && 
                        cacheName !== API_CACHE && 
                        cacheName !== DASHBOARD_CACHE) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    self.clients.claim();
});

/**
 * Fetch event - implement caching strategies
 */
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Cache-first strategy for static assets
    if (url.pathname.startsWith('/static') || 
        url.pathname.endsWith('.css') || 
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.jpeg') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.woff') ||
        url.pathname.endsWith('.woff2')) {
        event.respondWith(cacheFirst(event.request));
        return;
    }
    
    // Network-first strategy for API calls
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(event.request));
        return;
    }
    
    // Stale-while-revalidate for dashboard data
    if (url.pathname === '/' || url.pathname === '/index.html') {
        event.respondWith(staleWhileRevalidate(event.request));
        return;
    }
    
    // Default to network-first
    event.respondWith(networkFirst(event.request));
});

/**
 * Cache-first strategy - serve from cache, fallback to network
 */
async function cacheFirst(request) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    
    if (cached) {
        console.log('[Service Worker] Serving from cache:', request.url);
        return cached;
    }
    
    console.log('[Service Worker] Cache miss, fetching from network:', request.url);
    const response = await fetch(request);
    
    // Cache the response
    if (response.ok) {
        await cache.put(request, response.clone());
    }
    
    return response;
}

/**
 * Network-first strategy - try network, fallback to cache
 */
async function networkFirst(request) {
    const cache = await caches.open(API_CACHE);
    
    try {
        console.log('[Service Worker] Fetching from network:', request.url);
        const response = await fetch(request);
        
        // Cache the response
        if (response.ok) {
            await cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        console.log('[Service Worker] Network failed, serving from cache:', request.url);
        const cached = await cache.match(request);
        
        if (cached) {
            return cached;
        }
        
        // Return offline fallback
        return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * Stale-while-revalidate - serve from cache, update in background
 */
async function staleWhileRevalidate(request) {
    const cache = await caches.open(DASHBOARD_CACHE);
    const cached = await cache.match(request);
    
    // Fetch in background to update cache
    const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    }).catch(() => {
        // If fetch fails, just return cached
        return null;
    });
    
    // Return cached version immediately
    if (cached) {
        console.log('[Service Worker] Serving stale content:', request.url);
        return cached;
    }
    
    // If no cache, wait for network
    return fetchPromise;
}

/**
 * Clean up old cache entries to prevent storage quota issues
 */
async function cleanCache(cacheName) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    // Delete oldest entries if cache is too large
    if (keys.length > 100) {
        for (let i = 0; i < 20; i++) {
            await cache.delete(keys[i]);
        }
    }
}

/**
 * Handle message events from clients
 */
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data === 'CLEAR_CACHE') {
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => caches.delete(cacheName))
            );
        }).then(() => {
            event.ports[0].postMessage({ success: true });
        });
    }
});
