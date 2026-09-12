const CACHE = "edwins-admin-shell-v2";
const SHELL = [
  "/admin/offline.html",
  "/style.css",
  "/admin/admin.css",
  "/admin/management.css",
  "/images/app-icon-192.png",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("edwins-admin-shell-") && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
// Only public shell assets are cached. Customer data, authenticated responses,
// downloads, and mutations always go directly to the server.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (event.request.mode === "navigate" && url.pathname.startsWith("/admin/")) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/admin/offline.html")),
    );
  } else if (SHELL.includes(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches
                .open(CACHE)
                .then((cache) => cache.put(event.request, copy)),
            );
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
  }
});
