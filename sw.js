/**
 * Service Worker for Todo List App
 * Provides offline functionality and caching strategies
 */

const CACHE_NAME = 'todo-list-v1.0.0';
const DATA_CACHE_NAME = 'todo-list-data-v1.0.0';

// Files to cache for offline functionality
const FILES_TO_CACHE = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/css/themes.css',
    '/css/responsive.css',
    '/js/utils.js',
    '/js/storage.js',
    '/js/notifications.js',
    '/js/ui.js',
    '/js/app.js',
    '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app shell');
                return cache.addAll(FILES_TO_CACHE);
            })
            .then(() => {
                // Skip waiting to activate immediately
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Error during install:', error);
            })
    );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker');
    
    event.waitUntil(
        caches.keys()
            .then((keyList) => {
                return Promise.all(keyList.map((key) => {
                    if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
                        console.log('[SW] Removing old cache', key);
                        return caches.delete(key);
                    }
                }));
            })
            .then(() => {
                // Take control of all clients
                return self.clients.claim();
            })
            .catch((error) => {
                console.error('[SW] Error during activate:', error);
            })
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http(s) schemes
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Handle app shell requests
    if (FILES_TO_CACHE.includes(url.pathname) || url.pathname === '/') {
        event.respondWith(
            caches.open(CACHE_NAME)
                .then((cache) => {
                    return cache.match(request)
                        .then((response) => {
                            if (response) {
                                console.log('[SW] Serving from cache:', url.pathname);
                                return response;
                            }
                            
                            // Fallback to network
                            console.log('[SW] Fetching from network:', url.pathname);
                            return fetch(request)
                                .then((fetchResponse) => {
                                    // Cache the new response
                                    cache.put(request, fetchResponse.clone());
                                    return fetchResponse;
                                })
                                .catch(() => {
                                    // If network fails, serve index.html for SPA routing
                                    if (url.pathname === '/' || url.pathname.includes('.html')) {
                                        return cache.match('/index.html');
                                    }
                                    throw new Error('Network failed and no cache available');
                                });
                        });
                })
        );
        return;
    }

    // Handle API-like requests (future enhancement)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            handleApiRequest(event)
        );
        return;
    }

    // Handle other requests with network-first strategy
    event.respondWith(
        fetch(request)
            .then((response) => {
                // Only cache successful responses
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(request, responseClone);
                        });
                }
                return response;
            })
            .catch(() => {
                // Fallback to cache
                return caches.match(request);
            })
    );
});

/**
 * Handle API requests with cache-first strategy for data
 */
async function handleApiRequest(event) {
    const { request } = event;
    
    try {
        // Try cache first for data requests
        const cache = await caches.open(DATA_CACHE_NAME);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('[SW] Serving API data from cache:', request.url);
            
            // Serve from cache and update in background
            fetch(request)
                .then((response) => {
                    if (response.status === 200) {
                        cache.put(request, response.clone());
                    }
                })
                .catch(() => {
                    // Network update failed, but we have cache
                });
                
            return cachedResponse;
        }
        
        // No cache, fetch from network
        const response = await fetch(request);
        
        if (response.status === 200) {
            // Cache the response
            cache.put(request, response.clone());
        }
        
        return response;
        
    } catch (error) {
        console.error('[SW] API request failed:', error);
        
        // Return a meaningful offline response
        return new Response(
            JSON.stringify({ 
                error: 'Offline', 
                message: 'This feature requires an internet connection' 
            }),
            { 
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// Handle messages from the app
self.addEventListener('message', (event) => {
    const { type, payload } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'GET_VERSION':
            event.ports[0].postMessage({ version: CACHE_NAME });
            break;
            
        case 'CLEAR_CACHE':
            clearAllCaches()
                .then(() => {
                    event.ports[0].postMessage({ success: true });
                })
                .catch((error) => {
                    event.ports[0].postMessage({ success: false, error: error.message });
                });
            break;
            
        case 'SYNC_DATA':
            // Handle background sync (future enhancement)
            handleBackgroundSync(payload);
            break;
            
        default:
            console.log('[SW] Unknown message type:', type);
    }
});

/**
 * Clear all caches
 */
async function clearAllCaches() {
    const cacheNames = await caches.keys();
    const deletePromises = cacheNames.map(cacheName => caches.delete(cacheName));
    return Promise.all(deletePromises);
}

/**
 * Handle background sync (future enhancement for cloud sync)
 */
function handleBackgroundSync(payload) {
    console.log('[SW] Background sync requested:', payload);
    
    // This would handle syncing data with a cloud service
    // For now, we just log the request
    
    // Example implementation:
    // - Queue sync requests when offline
    // - Process queue when online
    // - Notify app of sync status
}

// Background sync event (future enhancement)
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync event:', event.tag);
    
    if (event.tag === 'todo-sync') {
        event.waitUntil(
            syncTodoData()
        );
    }
});

/**
 * Sync todo data in background (future enhancement)
 */
async function syncTodoData() {
    try {
        // This would sync local changes with cloud storage
        console.log('[SW] Syncing todo data in background');
        
        // Example:
        // 1. Get pending changes from IndexedDB
        // 2. Send to cloud API
        // 3. Update local data with server response
        // 4. Notify app of sync completion
        
        // For now, just simulate success
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Notify all clients about sync completion
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                payload: { success: true }
            });
        });
        
    } catch (error) {
        console.error('[SW] Background sync failed:', error);
        
        // Notify clients about sync failure
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_FAILED',
                payload: { error: error.message }
            });
        });
    }
}

// Push notification event (future enhancement)
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received:', event);
    
    const options = {
        body: 'You have pending tasks to review!',
        icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%232563eb'%3E%3Cpath d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'/%3E%3C/svg%3E",
        badge: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%232563eb'%3E%3Cpath d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'/%3E%3C/svg%3E",
        tag: 'todo-reminder',
        requireInteraction: false,
        data: {
            url: '/',
            timestamp: Date.now()
        },
        actions: [
            {
                action: 'view',
                title: 'View Tasks'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };
    
    if (event.data) {
        try {
            const data = event.data.json();
            options.title = data.title || 'Todo List Reminder';
            options.body = data.body || options.body;
            options.data = { ...options.data, ...data };
        } catch (e) {
            options.title = 'Todo List Reminder';
        }
    } else {
        options.title = 'Todo List Reminder';
    }
    
    event.waitUntil(
        self.registration.showNotification(options.title, options)
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);
    
    event.notification.close();
    
    const action = event.action;
    const data = event.notification.data || {};
    
    if (action === 'dismiss') {
        return;
    }
    
    // Default action or 'view' action
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        })
        .then((clientList) => {
            // Try to focus existing window
            for (const client of clientList) {
                if (client.url.includes(self.location.origin)) {
                    return client.focus();
                }
            }
            
            // Open new window
            return clients.openWindow(data.url || '/');
        })
    );
});

// Error event
self.addEventListener('error', (event) => {
    console.error('[SW] Service worker error:', event);
});

// Unhandled rejection event
self.addEventListener('unhandledrejection', (event) => {
    console.error('[SW] Unhandled promise rejection:', event.reason);
});

console.log('[SW] Service worker script loaded');