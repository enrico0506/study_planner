/* Study Planner service worker: app-shell caching + offline navigation fallback. */
(() => {
  const VERSION = "v12";
  const SHELL_CACHE = `study-planner-shell-${VERSION}`;
  const RUNTIME_CACHE = `study-planner-runtime-${VERSION}`;

  const PRECACHE_URLS = [
    "/",
    "/index.html",
    "/calendar.html",
    "/stundenplan.html",
    "/karteikarten.html",
    "/quiz.html",
    "/account.html",
    "/study-confidence-table.html",
    "/offline.html",
    "/manifest.webmanifest",
    "/pwa.js",

    "/icons/app-icon.svg",
    "/icons/logo.jpeg",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/icon-192-maskable.png",
    "/icons/icon-512-maskable.png",
    "/icons/apple-touch-icon.png",

    "/vendor/jszip.min.js",

    "/src/storage.js",
    "/src/sync.js",
    "/src/page-menu.js",
    "/src/a11y-utils.js",
    "/src/data-tools.js",
    "/src/notes.js",
    "/src/assignments.js",
    "/src/assignments-ui.js",
    "/src/autoplan.js",
    "/src/time-budget.js",
    "/src/review-engine.js",
    "/src/exam-mode.js",
    "/src/notes-to-flashcards.js",
    "/src/notifications.js",
    "/src/session-journal.js",
    "/src/insights.js",
    "/src/calendar.js",
    "/src/stundenplan.js",
    "/src/karteikarten.js",
    "/src/quiz.js",
    "/src/account.js",
    "/src/shared/sessionHeader.js",
    "/src/index/index.part1.js",
    "/src/index/index.part2.js",
    "/src/index/index.part3.js",
    "/src/index/index.part4.js",
    "/src/phone/phone-nav.js",

    "/src/styles/main.css",
    "/src/styles/mobile.css",
    "/src/styles/phone.css",
    "/src/styles/phone-pages.css",
    "/src/styles/phone-bottom-nav.css",
    "/src/styles/phone-menu.css",
    "/src/styles/phone-modals.css",
    "/src/styles/a11y.css",
    "/src/styles/enhancements.css",
    "/src/styles/calendar-extras.css",
    "/src/styles/notes.css",
    "/src/styles/exam-mode.css",
    "/src/styles/insights.css",
    "/src/styles/karteikarten.css",
    "/src/styles/quiz.css",
    "/assets/quiz-template.csv",
    "/src/styles/stundenplan.css"
  ];

  function isSameOrigin(url) {
    return url.origin === self.location.origin;
  }

  function isBypassRequest(req, url) {
    if (req.method !== "GET") return true;
    if (!isSameOrigin(url)) return true;
    if (url.pathname === "/sw.js") return true;
    if (url.pathname.startsWith("/api/")) return true;
    if (req.headers.get("authorization")) return true;
    return false;
  }

  function isStaticAsset(url) {
    return (
      url.pathname.startsWith("/src/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname.startsWith("/vendor/") ||
      url.pathname === "/manifest.webmanifest" ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".svg")
    );
  }

  self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
      void self.skipWaiting();
    }
  });

  self.addEventListener("install", (event) => {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        await cache.addAll(PRECACHE_URLS);
        await self.skipWaiting();
      })()
    );
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(
          keys.map((k) => {
            if (k === SHELL_CACHE || k === RUNTIME_CACHE) return null;
            if (k.startsWith("study-planner-shell-") || k.startsWith("study-planner-runtime-")) {
              return caches.delete(k);
            }
            return null;
          })
        );
        await self.clients.claim();
      })()
    );
  });

  self.addEventListener("fetch", (event) => {
    const req = event.request;
    const url = new URL(req.url);
    if (isBypassRequest(req, url)) return;

    if (req.mode === "navigate") {
      event.respondWith(
        (async () => {
          try {
            const res = await fetch(req);
            const runtime = await caches.open(RUNTIME_CACHE);
            if (res && res.ok) runtime.put(req, res.clone());
            return res;
          } catch {
            return (
              (await caches.match(req)) ||
              (await caches.match("/index.html")) ||
              (await caches.match("/offline.html"))
            );
          }
        })()
      );
      return;
    }

    if (isStaticAsset(url)) {
      event.respondWith(
        (async () => {
          const cache = await caches.open(RUNTIME_CACHE);
          const cached = await cache.match(req);
          const fetchPromise = fetch(req)
            .then((res) => {
              if (res && res.ok) cache.put(req, res.clone());
              return res;
            })
            .catch(() => null);

          if (cached) {
            event.waitUntil(fetchPromise);
            return cached;
          }

          const res = await fetchPromise;
          if (res) return res;
          return cached || Response.error();
        })()
      );
    }
  });
})();
