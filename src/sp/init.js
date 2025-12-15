(() => {
  function init() {
    try {
      window.StudyPlanner?.Topbar?.mount?.();
    } catch {}
    try {
      window.StudyPlanner?.PWA?.register?.();
    } catch {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

