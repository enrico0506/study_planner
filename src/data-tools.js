(() => {
  const Storage = window.StudyPlanner && window.StudyPlanner.Storage ? window.StudyPlanner.Storage : null;
  if (!Storage) return;

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(message, tone = "") {
    const el = $("settingsDataStatus");
    if (!el) return;
    el.classList.toggle("settings-data-status-ok", tone === "ok");
    el.classList.toggle("settings-data-status-warn", tone === "warn");
    el.textContent = message || "";
  }

  function formatTs(ts) {
    try {
      return new Date(Number(ts) || Date.now()).toLocaleString();
    } catch {
      return "";
    }
  }

  function renderSnapshots() {
    const listEl = $("settingsSnapshotList");
    if (!listEl) return;
    listEl.innerHTML = "";

    const snaps = Storage.listSnapshots();
    if (!snaps.length) {
      const empty = document.createElement("div");
      empty.className = "settings-data-empty";
      empty.textContent = "No local snapshots yet. Exports and imports create them automatically.";
      listEl.appendChild(empty);
      return;
    }

    snaps.forEach((s) => {
      const row = document.createElement("div");
      row.className = "settings-data-snapshot-row";

      const meta = document.createElement("div");
      meta.className = "settings-data-snapshot-meta";

      const title = document.createElement("div");
      title.className = "settings-data-snapshot-title";
      title.textContent = s.label || "Snapshot";

      const subtitle = document.createElement("div");
      subtitle.className = "settings-data-snapshot-subtitle";
      subtitle.textContent = formatTs(s.ts);

      meta.appendChild(title);
      meta.appendChild(subtitle);

      const btn = document.createElement("button");
      btn.className = "btn btn-secondary";
      btn.type = "button";
      btn.textContent = "Restore";
      btn.setAttribute("data-snap", s.id);
      btn.setAttribute("aria-label", `Restore snapshot from ${subtitle.textContent}`);

      row.appendChild(meta);
      row.appendChild(btn);
      listEl.appendChild(row);
    });
  }

  async function handleImport() {
    const input = $("settingsImportFile");
    const modeSel = $("settingsImportMode");
    if (!input || !modeSel) return;

    const file = input.files && input.files[0];
    if (!file) {
      setStatus("Choose a JSON file first.", "warn");
      return;
    }

    let text = "";
    try {
      text = await file.text();
    } catch {
      setStatus("Could not read the selected file.", "warn");
      return;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      setStatus("Invalid JSON file.", "warn");
      return;
    }

    const validation = Storage.validateBackup(parsed);
    if (!validation.ok) {
      setStatus(validation.error || "Invalid backup file.", "warn");
      return;
    }

    const keyCount = Object.keys(validation.backup.data || {}).length;
    const mode = modeSel.value === "replace" ? "replace" : "merge";
    const ok = window.confirm(
      `Import ${keyCount} keys from “${file.name}”?\\n\\nThis will overwrite keys present in the backup. A pre-import snapshot will be created automatically.`
    );
    if (!ok) return;

    const res = Storage.applyBackup(validation.backup, { mode });
    if (!res.ok) {
      setStatus(res.error || "Import failed.", "warn");
      return;
    }

    renderSnapshots();
    setStatus("Import complete. Pages should update automatically.", "ok");
  }

  function handleExport() {
    const backup = Storage.exportAll();
    Storage.snapshotNow({ label: "Auto: export" });
    const stamp = new Date().toISOString().replaceAll(":", "-");
    Storage.downloadJson(`study-planner-backup_${stamp}.json`, backup);
    renderSnapshots();
    setStatus("Exported backup (and saved a local snapshot).", "ok");
  }

  function init() {
    const exportBtn = $("settingsExportBtn");
    const importBtn = $("settingsImportBtn");
    const snapshotBtn = $("settingsSnapshotNowBtn");
    const listEl = $("settingsSnapshotList");

    exportBtn?.addEventListener("click", handleExport);
    importBtn?.addEventListener("click", () => handleImport());
    snapshotBtn?.addEventListener("click", () => {
      Storage.snapshotNow({ label: "Manual snapshot" });
      renderSnapshots();
      setStatus("Snapshot created.", "ok");
    });

    listEl?.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-snap]");
      if (!btn) return;
      const snapId = btn.getAttribute("data-snap");
      const ok = window.confirm(
        "Restore this snapshot? This will overwrite your current local state (a pre-restore snapshot will be created)."
      );
      if (!ok) return;
      const restored = Storage.restoreSnapshot(snapId, { mode: "replace" });
      if (!restored) setStatus("Could not restore snapshot.", "warn");
      else {
        renderSnapshots();
        setStatus("Snapshot restored. Pages should update automatically.", "ok");
      }
    });

    renderSnapshots();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

