const CACHE_NAME = 'ordina-cache-v1';
const OFFLINE_URL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        OFFLINE_URL,
        '/manifest.json'
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
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
    // Логика переотправки кэша сообщений при появлении сети
    event.waitUntil(Promise.resolve());
  }
});
