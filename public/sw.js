// Service Worker for Push Notifications and Image Caching

const CACHE_NAME = 'triptrac-images-v1';
const IMAGE_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// Image URL patterns to cache
const IMAGE_PATTERNS = [
  /supabase\.co\/storage\/v1\/object\/public\//,
  /images\.unsplash\.com/,
];

// Check if URL should be cached
function shouldCacheImage(url) {
  return IMAGE_PATTERNS.some(pattern => pattern.test(url));
}

// Fetch event - intercept image requests
self.addEventListener('fetch', function(event) {
  const url = event.request.url;
  
  // Only handle image requests
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
  }
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
  event.waitUntil(self.clients.claim());
});
