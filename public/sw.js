// Dynasty Database service worker.
//
// Deliberately minimal. This exists to satisfy PWA installability
// (Chrome/Android requires an active service worker before
// `beforeinstallprompt` will fire) — it is NOT an offline-support
// layer. This site's whole value is live, frequently-changing data
// (scores, ranks, tiers), so the one thing this must never do is
// serve a stale cached response for a page or API call. Only
// same-origin, content-hashed Next.js build assets (immutable by
// construction — the filename itself changes when the content does)
// are cached. Everything else — every page navigation, every /api/
// call — passes straight through to the network, untouched.
const CACHE_NAME = "dd-static-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function isImmutableStaticAsset(url) {
  // Next.js build output under /_next/static/ is content-hashed —
  // the URL itself changes whenever the content does, so caching it
  // indefinitely is safe by construction, not just convenient.
  return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isImmutableStaticAsset(url)) return; // let the browser handle everything else normally

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
  );
});
