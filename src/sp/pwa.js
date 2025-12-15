(() => {
  const StudyPlanner = (window.StudyPlanner = window.StudyPlanner || {});

  function canUseServiceWorker() {
    try {
      if (!("serviceWorker" in navigator)) return false;
      const p = window.location && window.location.protocol;
      return p === "https:" || p === "http:" || p === "localhost:"; // localhost handled below
    } catch {
      return false;
    }
  }

  async function register() {
    try {
      if (!("serviceWorker" in navigator)) return;
      const protocol = window.location && window.location.protocol;
      const isLocalhost = window.location && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      if (protocol !== "https:" && !isLocalhost) return;
      await navigator.serviceWorker.register("./sw.js");
    } catch {}
  }

  StudyPlanner.PWA = Object.assign(StudyPlanner.PWA || {}, { register, canUseServiceWorker });
})();

