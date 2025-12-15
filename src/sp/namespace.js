(() => {
  const existing = window.StudyPlanner && typeof window.StudyPlanner === "object" ? window.StudyPlanner : {};

  window.StudyPlanner = Object.assign(existing, {
    version: "0.0.0",
    ready: existing.ready || false,
    config: Object.assign(
      {
        storagePrefix: "study",
        schemaVersion: 1
      },
      existing.config || {}
    )
  });
})();

