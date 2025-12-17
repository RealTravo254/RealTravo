// Service Worker for Push Notifications, Image Caching, and Offline Support

const CACHE_NAME = 'triptrac-images-v1';
const STATIC_CACHE_NAME = 'triptrac-static-v1';
const IMAGE_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// Image URL patterns to cache
const IMAGE_PATTERNS = [
  /supabase\.co\/storage\/v1\/object\/public\//,
  /images\.unsplash\.com/,
];

// Static assets to pre-cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
];

// Pages to cache for offline access
const OFFLINE_PAGES = [
  '/bookings',
  '/host-bookings',
  '/qr-scanner',
];

// Check if URL should be cached
function shouldCacheImage(url) {
  return IMAGE_PATTERNS.some(pattern => pattern.test(url));
}

// Install event - cache static assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Fetch event - intercept requests
self.addEventListener('fetch', function(event) {
  const url = event.request.url;
  const requestUrl = new URL(url);
  
  // Handle image requests
  if (event.request.destination === 'image' || shouldCacheImage(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(cachedResponse) {
          if (cachedResponse) {
            // Return cached response and update cache in background
            event.waitUntil(
              fetch(event.request).then(function(networkResponse) {
                if (networkResponse.ok) {
                  cache.put(event.request, networkResponse.clone());
                }
              }).catch(function() {
                // Network failed, cached response is still valid
              })
            );
            return cachedResponse;
          }
          
          // Not in cache, fetch from network
          return fetch(event.request).then(function(networkResponse) {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(function() {
            // Return placeholder if offline and no cache
            return new Response('', { status: 503 });
          });
        });
      })
    );
    return;
  }

  // Handle navigation requests for offline pages
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function() {
        // Return cached index.html for offline navigation
        return caches.match('/index.html').then(function(response) {
          return response || new Response('Offline', { status: 503 });
        });
      })
    );
    return;
  }

  // Handle API requests - network first, fallback to cache
  if (requestUrl.pathname.includes('/rest/v1/') || requestUrl.pathname.includes('/functions/v1/')) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        // Cache successful GET requests
        if (response.ok && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(function() {
        // Return cached API response if offline
        return caches.match(event.request).then(function(cachedResponse) {
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        });
      })
    );
    return;
  }

  // Default fetch behavior
  event.respondWith(
    fetch(event.request).catch(function() {
      return caches.match(event.request);
    })
  );
});

// Push notification handler
self.addEventListener('push', function(event) {
  if (!event.data) {
    return;
  }

  const data = event.data.json();
  
  const options = {
    body: data.body || data.message || 'You have a new notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: data.id || '1',
      url: data.url || '/'
    },
    actions: [
      {
        action: 'explore',
        title: 'View'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ],
    tag: data.tag || 'notification',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'TripTrac', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if there's already a window open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle service worker activation
self.addEventListener('activate', function(event) {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          return cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME;
        }).map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Handle background sync for offline scans
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-offline-scans') {
    event.waitUntil(syncOfflineScans());
  }
});

async function syncOfflineScans() {
  // This will be handled by the app when it comes back online
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_OFFLINE_SCANS' });
  });
}
