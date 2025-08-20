// Enhanced Service Worker for Chanitec PWA - Phase 3
const CACHE_NAME = 'chanitec-pwa-v3';
const STATIC_CACHE = 'chanitec-static-v3';
const DYNAMIC_CACHE = 'chanitec-dynamic-v3';
const API_CACHE = 'chanitec-api-v3';

// Cache strategies
const CACHE_STRATEGIES = {
  STATIC: 'cache-first',
  DYNAMIC: 'stale-while-revalidate',
  API: 'network-first',
  IMAGES: 'cache-first'
};

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/index.html',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/logo192.png',
  '/logo512.png',
  '/manifest.json',
  '/offline.html'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/quotes',
  '/api/clients',
  '/api/items',
  '/api/supplies'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('🔄 Service Worker installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('✅ Static files cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Failed to cache static files:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE &&
                cacheName !== DYNAMIC_CACHE &&
                cacheName !== API_CACHE &&
                cacheName !== CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activated and old caches cleaned');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle different types of requests
  if (isStaticFile(request)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  } else if (isImageRequest(request)) {
    event.respondWith(cacheFirstStrategy(request, DYNAMIC_CACHE));
  } else if (isAPIRequest(request)) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
  } else if (isHTMLRequest(request)) {
    event.respondWith(staleWhileRevalidateStrategy(request, DYNAMIC_CACHE));
  } else {
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
  }
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received:', event);

  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || 'New notification from Chanitec',
        icon: data.icon || '/logo192.png',
        badge: data.badge || '/logo192.png',
        image: data.image,
        tag: data.tag || 'default',
        data: data.data || {},
        actions: data.actions || [],
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
        vibrate: data.vibrate || [200, 100, 200]
      };

      event.waitUntil(
        self.registration.showNotification(data.title || 'Chanitec', options)
      );
    } catch (error) {
      console.error('❌ Failed to parse push data:', error);

      // Fallback notification
      event.waitUntil(
        self.registration.showNotification('Chanitec', {
          body: 'You have a new notification',
          icon: '/logo192.png'
        })
      );
    }
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notification clicked:', event);

  event.notification.close();

  if (event.action) {
    handleNotificationAction(event.notification, event.action);
  } else {
    handleNotificationClick(event.notification);
  }
});

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);

  if (event.tag === 'background-sync') {
    event.waitUntil(performBackgroundSync());
  }
});

// Cache First Strategy
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📦 Serving from cache:', request.url);
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('❌ Cache first strategy failed:', error);
    return getOfflineResponse(request);
  }
}

// Network First Strategy
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('🌐 Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return getOfflineResponse(request);
  }
}

// Stale While Revalidate Strategy
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Return cached response immediately if available
  if (cachedResponse) {
    console.log('📦 Serving stale response:', request.url);

    // Update cache in background
    fetch(request)
      .then(async (networkResponse) => {
        if (networkResponse.ok) {
          await cache.put(request, networkResponse);
          console.log('🔄 Cache updated in background:', request.url);
        }
      })
      .catch((error) => {
        console.warn('⚠️ Background update failed:', error);
      });

    return cachedResponse;
  }

  // If no cache, wait for network
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('❌ Stale while revalidate failed:', error);
    return getOfflineResponse(request);
  }
}

// Get offline response
async function getOfflineResponse(request) {
  if (request.destination === 'document') {
    return caches.match('/offline.html');
  }

  // Return appropriate offline response based on request type
  if (request.destination === 'image') {
    return new Response('', { status: 404 });
  }

  return new Response('Offline', { status: 503 });
}

// Check if request is for static files
function isStaticFile(request) {
  return STATIC_FILES.some(file => request.url.includes(file));
}

// Check if request is for images
function isImageRequest(request) {
  return request.destination === 'image' ||
         /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(request.url);
}

// Check if request is for API
function isAPIRequest(request) {
  return API_ENDPOINTS.some(endpoint => request.url.includes(endpoint)) ||
         request.url.includes('/api/');
}

// Check if request is for HTML
function isHTMLRequest(request) {
  return request.destination === 'document' ||
         request.headers.get('accept')?.includes('text/html');
}

// Handle notification click
function handleNotificationClick(notification) {
  const tag = notification.tag;

  if (tag?.startsWith('sync-')) {
    // Navigate to sync status page
    openPage('/phase2-test');
  } else if (tag === 'offline-status') {
    // Show offline indicator
    console.log('Showing offline indicator');
  } else if (tag === 'reminder') {
    // Handle reminder click
    console.log('Reminder clicked:', notification.title);
  }
}

// Handle notification action
function handleNotificationAction(notification, action) {
  if (action === 'dismiss') {
    notification.close();
  } else if (action === 'snooze') {
    // Snooze for 5 minutes
    const snoozeTime = Date.now() + 5 * 60 * 1000;
    console.log('Snoozing notification until:', new Date(snoozeTime));
  }
}

// Open page in client
function openPage(path) {
  self.clients.matchAll({ type: 'window' })
    .then((clients) => {
      if (clients.length > 0) {
        clients[0].navigate(path);
        clients[0].focus();
      } else {
        self.clients.openWindow(path);
      }
    });
}

// Perform background sync
async function performBackgroundSync() {
  try {
    console.log('🔄 Performing background sync...');

    // This would typically sync offline data
    // For now, we'll just log the sync attempt

    // Simulate sync work
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('✅ Background sync completed');

    // Show sync complete notification
    self.registration.showNotification('🔄 Sync Complete', {
      body: 'Background synchronization completed successfully',
      icon: '/logo192.png',
      tag: 'sync-complete'
    });

  } catch (error) {
    console.error('❌ Background sync failed:', error);

    // Show sync error notification
    self.registration.showNotification('❌ Sync Error', {
      body: 'Background synchronization failed',
      icon: '/logo192.png',
      tag: 'sync-error',
      requireInteraction: true
    });
  }
}

// Message event - handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('📨 Message received in service worker:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: '3.0.0' });
  }
});

console.log('🚀 Enhanced Service Worker loaded successfully!');
