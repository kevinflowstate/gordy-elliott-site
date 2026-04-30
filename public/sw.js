const CACHE_NAME = "shift-gordy-portal-v10";
const STATIC_CACHE_ALLOWLIST = [
  "/shift-icon-192x192.png",
  "/shift-icon-512x512.png",
  "/shift-apple-touch-icon.png",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Never cache API calls, documents, or Next build assets. Installed PWAs need
  // these to refresh on deploy without users deleting/reinstalling the app.
  if (url.pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }
  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  const shouldCache = STATIC_CACHE_ALLOWLIST.includes(url.pathname) || ["image", "font", "style"].includes(event.request.destination);

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && shouldCache) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification handler
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Blueprint Portal";
  const options = {
    body: data.body || "",
    icon: "/shift-icon-192x192.png",
    badge: "/shift-icon-192x192.png",
    tag: data.tag || "default",
    data: { url: data.url || "/portal" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/portal";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
