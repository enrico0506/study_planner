/* Study Planner service worker: offline-first for static assets. */
(() => {
  const CACHE_VERSION = "v1";
  const STATIC_CACHE = `studyplanner-static-${CACHE_VERSION}`;

  const PRECACHE_URLS = [
    "./",
    "./index.html",
    "./calendar.html",
    "./stundenplan.html",
    "./karteikarten.html",
    "./account.html",
    "./study-confidence-table.html",
    "./manifest.webmanifest",
    "./src/page-menu.js",
    "./src/index/index.part1.js",
    "./src/index/index.part2.js",
    "./src/index/index.part3.js",
    "./src/index/index.part4.js",
    "./src/calendar.js",
    "./src/stundenplan.js",
    "./src/karteikarten.js",
    "./src/account.js",
    "./src/sync.js",
    "./src/sp/namespace.js",
    "./src/sp/dom.js",
    "./src/sp/a11y.js",
    "./src/sp/storage.js",
    "./src/sp/modals.js",
    "./src/sp/topbar.js",
    "./src/sp/pwa.js",
    "./src/sp/init.js",
    "./src/styles/main.css",
    "./src/styles/mobile.css",
    "./src/styles/phone.css",
    "./src/styles/phone-menu.css",
    "./src/styles/phone-modals.css",
    "./src/styles/phone-pages.css",
    "./public/icons/app-icon.svg",
    "./public/icons/app-icon-maskable.svg"
  ];

  self.addEventListener("install", (event) => {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        await cache.addAll(PRECACHE_URLS);
        self.skipWaiting();
      })()
    );
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => (k.startsWith("studyplanner-static-") && k !== STATIC_CACHE ? caches.delete(k) : null)));
        self.clients.claim();
      })()
    );
  });

  self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SP_SW_SKIP_WAITING") self.skipWaiting();
  });

  self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          // Offline fallback: use app shell for navigations.
          if (req.mode === "navigate") return (await cache.match("./index.html")) || (await cache.match("./"));
          throw new Error("offline");
        }
      })()
    );
  });
})();
