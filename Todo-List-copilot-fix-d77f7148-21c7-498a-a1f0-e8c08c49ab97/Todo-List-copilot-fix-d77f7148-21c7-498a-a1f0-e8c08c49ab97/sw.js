const APP_VERSION = '1.0.1'; // Increment when deploying new static assets
const CACHE_PREFIX = 'todo-pwa';
const CACHE_NAME = `${CACHE_PREFIX}-static-${APP_VERSION}`;
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles/main.css',
  '/styles/themes.css',
  '/js/app.js',
  '/js/task.js',
  '/js/storage.js',
  '/js/ui.js',
  '/js/search.js',
  '/js/stats.js',
  '/js/graph.js',
  '/js/tour.js',
  '/js/notifications.js',
  '/js/themes.js',
  '/js/import-export.js',
  '/js/undo-redo.js'
];

// Install event: pre-cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Fetch event: stale-while-revalidate for same-origin GET requests
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
    return; // Let browser handle
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request)
        .then(response => {
          // Only cache successful basic (same-origin) responses
            if (response && response.status === 200 && response.type === 'basic') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
            }
            return response;
        })
        .catch(() => cached); // Fallback to cache if offline

      // Return cached immediately if available, else network
      return cached || fetchPromise;
    })
  );
});

// Activate event: clean old versioned caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names
        .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map(oldName => caches.delete(oldName))
    )).then(() => self.clients.claim())
  );
});

// Background sync for offline task creation
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Handle any offline actions when back online
  console.log('Background sync triggered');
}