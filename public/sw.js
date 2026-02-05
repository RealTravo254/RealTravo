// 1. VERSIONING: Incremented to force an app-wide update
const STATIC_CACHE = 'realtravo-static-v11';
const IMAGE_CACHE = 'realtravo-images-v11';
const DATA_CACHE = 'realtravo-data-v11';

// 2. PRECACHE LIST: The App Shell + All Routes
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/fulllogo.png',
  '/favicon.ico',

  // Local Images (WebP for better performance)
  '/images/category-campsite.webp',
  '/images/category-hotels.webp',
  '/images/category-trips.webp',
  '/images/category-events.webp',
  '/images/hero-background.webp',

  // Audio
  '/audio/notification.mp3',

  // Routes
  '/auth',
  '/about',
  '/contact',
  '/saved',
  '/bookings',
  '/install',
  '/terms-of-service',
  '/privacy-policy',
  '/qr-scanner',
  '/profile',
  '/profile/edit',
  '/account',
  '/my-referrals',
  '/payment',
  '/payment-history',
  '/reset-password',
  '/verify-email',
  '/forgot-password',
  '/become-host',
  '/creator-dashboard',
  '/my-listing',
  '/host-verification',
  '/verification-status',
  '/create-trip',
  '/create-hotel',
  '/create-adventure',
  '/create-attraction',
  '/host/trips',
  '/host/hotels',
  '/host/experiences',
  '/host-bookings',
  '/admin',
  '/admin/pending',
  '/admin/approved',
  '/admin/rejected',
  '/admin/bookings',
  '/admin/all-bookings',
  '/admin/verification',
  '/admin/payment-verification',
  '/admin/referral-settings'
];

const IMAGE_PATTERNS = [
  /supabase\.co\/storage\/v1\/object\/public\//,
  /images\.unsplash\.com/,
];

// --- INSTALL: Download assets ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('Realtravo: Precaching Assets...');
      // Use cache.addAll but catch individual failures to prevent install crash
      return cache.addAll(PRECACHE_ASSETS).catch(err => console.warn("Precache failed for some assets", err));
    })
  );
  self.skipWaiting();
});

// --- ACTIVATE: Cleanup old caches ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (![STATIC_CACHE, IMAGE_CACHE, DATA_CACHE].includes(key)) {
            console.log('Realtravo: Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// --- FETCH: Safe SPA handling + caching ---
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests (like POST for database updates)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // IMPORTANT: For SPA navigations, always go to network first.
  // This prevents serving a stale cached HTML shell that can reference mismatched JS chunks
  // (which can cause React hook dispatcher errors and a blank white screen).
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put('/index.html', responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For JS/CSS, use NetworkFirst to avoid mixing old/new builds.
  if (
    event.request.destination === 'script' ||
    event.request.destination === 'style' ||
    event.request.destination === 'worker'
  ) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // Only cache valid responses
          if (networkResponse && networkResponse.status === 200) {
            const isImage =
              IMAGE_PATTERNS.some((p) => p.test(url.href)) ||
              event.request.destination === 'image';

            let cacheName = STATIC_CACHE;
            if (isImage) {
              cacheName = IMAGE_CACHE;
            } else if (url.pathname.includes('/rest/v1/')) {
              cacheName = DATA_CACHE;
            }

            const responseClone = networkResponse.clone();
            caches.open(cacheName).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// --- PUSH NOTIFICATIONS ---
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body || 'New update from Realtravo',
    icon: '/fulllogo.png',
    badge: '/favicon.ico',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(data.title || 'Realtravo', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const url = event.notification.data.url;
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});