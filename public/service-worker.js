const CACHE_NAME = "zarratai-static-shell-v1";
const STATIC_FILE = /\.(?:css|js|mjs|woff2?|ttf|otf|png|jpe?g|webp|svg|ico)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        await cache.add(new Request(new URL("./", self.registration.scope), { cache: "reload" }));
      } catch {
        // The first navigation will populate the cache if the host does not
        // expose the site root during service-worker installation.
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("zarratai-static-shell-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const response = await fetch(request);
          if (response.ok) await cache.put(request, response.clone());
          return response;
        } catch {
          const exactPage = await cache.match(request);
          if (exactPage) return exactPage;
          const rootPage = await cache.match(new URL("./", self.registration.scope).toString());
          return rootPage ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.includes("/_next/static/") || STATIC_FILE.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      })(),
    );
  }
});
