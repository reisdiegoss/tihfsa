// TIHFSA Service Worker - PWA Standalone Support
const CACHE_NAME = "tihfsa-cache-v3";
const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[SW] Cache inicial silencioso:", err);
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Ignora chamadas para a API REST para garantir tempo real
  if (event.request.url.includes("/api/")) {
    return;
  }

  // Apenas requisições GET devem ser interceptadas pelo cache do Service Worker
  if (event.request.method !== "GET") {
    return;
  }

  // Para navegações de página (SPA), se a rede falhar ou for abortada, faz fallback para o shell "/" (index.html)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cachedRoot = await caches.match("/");
        if (cachedRoot) {
          return cachedRoot;
        }
        return new Response("Offline", {
          status: 503,
          statusText: "Offline",
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      })
    );
    return;
  }

  // Para recursos estáticos (scripts, styles, imagens, fontes)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) {
          return cached;
        }
        // NUNCA retorne undefined para o respondWith: evita TypeError: Failed to convert value to 'Response'
        return new Response("", { status: 404, statusText: "Not Found in Cache" });
      })
  );
});
