const CACHE_NAME = 'ordina-cache-v2';
const OFFLINE_URL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        OFFLINE_URL,
        '/manifest.json',
        '/icon.svg'
      ]).catch((err) => {
        console.warn('[ServiceWorker] Cache pre-fill partial error:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    console.log('[ServiceWorker] Фоновая синхронизация запущена');
    event.waitUntil(Promise.resolve());
  }
});

// Push notification event (Web Push)
self.addEventListener('push', (event) => {
  let data = { title: 'Ордина: Мессенджер Свободы', body: 'Новое зашифрованное сообщение' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'Новое сообщение',
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    tag: data.tag || 'ordina-msg',
    renotify: true,
    data: data.data || { url: '/' },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'dismiss', title: 'Закрыть' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Ордина', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window client already exists, focus it
      for (const client of windowClients) {
        if ('focus' in client) {
          if (client.url && 'navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // If no window is open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Communication with app clients for triggering notifications from background/offline
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, {
        ...options,
        icon: options?.icon || '/icon.svg',
        badge: options?.badge || '/icon.svg'
      })
    );
  }
});
