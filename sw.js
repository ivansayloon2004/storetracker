const CACHE_NAME = "tindahan-tracker-shell-20260329m";
const APP_SHELL_ASSETS = [
  "/",
  "/index.html",
  "/styles.css?v=20260329m",
  "/script.js?v=20260329m",
  "/manifest.webmanifest?v=20260329m",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(cacheNames.filter((cacheName) => cacheName !== CACHE_NAME).map((cacheName) => caches.delete(cacheName)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", responseCopy));
          }
          return response;
        })
        .catch(async () => {
          return (await caches.match(request)) || (await caches.match("/index.html"));
        })
    );
    return;
  }

  const isAppShellRequest =
    requestUrl.pathname === "/" ||
    requestUrl.pathname === "/index.html" ||
    requestUrl.pathname === "/styles.css" ||
    requestUrl.pathname === "/script.js" ||
    requestUrl.pathname === "/manifest.webmanifest" ||
    requestUrl.pathname.startsWith("/icons/");

  if (!isAppShellRequest) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          const responseCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
        }
        return networkResponse;
      })
      .catch(async () => {
        return (await caches.match(request)) || (await caches.match("/index.html"));
      })
  );
});
