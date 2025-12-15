(() => {
  function isLocalhost() {
    return (
      window.location &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    );
  }

  async function register() {
    try {
      if (!("serviceWorker" in navigator)) return;
      const protocol = window.location && window.location.protocol;
      if (protocol !== "https:" && !isLocalhost()) return;
      await navigator.serviceWorker.register("./sw.js");
    } catch {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", register, { once: true });
  } else {
    register();
  }
})();

