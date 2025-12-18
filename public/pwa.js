(() => {
  function isLocalhost() {
    const host = window.location?.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  }

  function canRegister() {
    if (!("serviceWorker" in navigator)) return false;
    const protocol = window.location?.protocol;
    return protocol === "https:" || isLocalhost();
  }

  function promptForUpdate(registration) {
    const ok = window.confirm("A new version is available. Reload now?");
    if (!ok) return;
    registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
  }

  async function register() {
    if (!canRegister()) return;

    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      console.log("[PWA] Service worker registered:", registration.scope);

      if (registration.waiting) promptForUpdate(registration);

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            promptForUpdate(registration);
          }
        });
      });

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("[PWA] Service worker controller changed, reloading.");
        window.location.reload();
      });
    } catch (err) {
      console.warn("[PWA] Service worker registration failed:", err);
    }
  }

  window.addEventListener("load", () => {
    void register();
  });
})();

