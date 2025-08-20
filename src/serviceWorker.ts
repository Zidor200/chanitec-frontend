// Service Worker Registration for Chanitec PWA
export function register() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/sw.js`;

      registerValidSW(swUrl);
    });
  }
}

function registerValidSW(swUrl: string) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      console.log('Service Worker registered successfully:', registration);

      // Handle service worker updates
      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New content is available and the previous service worker can still serve the old content
              console.log('New content is available; please refresh.');

              // Show update notification to user
              showUpdateNotification();
            } else {
              // Everything is precached, it's the first time
              console.log('Content is cached for offline use.');
            }
          }
        });
      });

      // Handle service worker errors
      registration.addEventListener('error', (error) => {
        console.error('Service Worker registration error:', error);
      });

      // Handle service worker message events
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Message from Service Worker:', event.data);

        // Handle different message types
        switch (event.data.type) {
          case 'CACHE_UPDATED':
            console.log('Cache updated:', event.data.payload);
            break;
          case 'OFFLINE_MODE':
            console.log('App is now offline');
            break;
          case 'ONLINE_MODE':
            console.log('App is now online');
            break;
          default:
            console.log('Unknown message type:', event.data.type);
        }
      });

    })
    .catch((error) => {
      console.error('Error during service worker registration:', error);
    });
}

function showUpdateNotification() {
  // Check if the browser supports notifications
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('Chanitec - Mise à jour disponible', {
      body: 'Une nouvelle version est disponible. Cliquez pour actualiser.',
      icon: '/logo192.png',
      badge: '/favicon-32x32.png',
      tag: 'update-available',
      requireInteraction: true
    });

    notification.addEventListener('click', () => {
      window.location.reload();
      notification.close();
    });
  } else {
    // Fallback: show a simple alert
    if (window.confirm('Une nouvelle version est disponible. Voulez-vous actualiser maintenant ?')) {
      window.location.reload();
    }
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}

// Check if service worker is supported
export function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator;
}

// Get service worker registration
export function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    return Promise.resolve(null);
  }

  return navigator.serviceWorker.getRegistration().then(registration => registration || null);
}

// Send message to service worker
export function sendMessageToServiceWorker(message: any): void {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
  } else {
    console.warn('Service Worker controller not available');
  }
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    throw new Error('Notifications not supported');
  }

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
}

// Check if app is installed
export function isAppInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
}

// Listen for beforeinstallprompt event
export function listenForInstallPrompt(): Promise<Event> {
  return new Promise((resolve) => {
    const handler = (event: Event) => {
      window.removeEventListener('beforeinstallprompt', handler);
      resolve(event);
    };

    window.addEventListener('beforeinstallprompt', handler);
  });
}
