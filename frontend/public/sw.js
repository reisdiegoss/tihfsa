// TIHFSA Service Worker - PWA Support
const CACHE_NAME = "tihfsa-cache-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass-through padrão para garantir comunicação direta com a API
  // Mantém os requisitos de PWA instalável do navegador
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
