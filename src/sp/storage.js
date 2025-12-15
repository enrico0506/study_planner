(() => {
  const StudyPlanner = (window.StudyPlanner = window.StudyPlanner || {});

  const SCHEMA_VERSION = Number(StudyPlanner.config?.schemaVersion || 1) || 1;
  const SNAPSHOT_KEY = "studyPlannerSnapshots_v1";

  const DEBOUNCE_DEFAULT_MS = 250;
  const timers = new Map();

  function safeParseJson(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function listKeys({ includeSyncMeta = true } = {}) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("study")) keys.push(key);
      else if (includeSyncMeta && key === "sync_cloud_updated_ms_v1") keys.push(key);
    }
    keys.sort();
    return keys;
  }

  function getRaw(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }

  function setRaw(key, value, { debounceMs = DEBOUNCE_DEFAULT_MS } = {}) {
    const write = () => {
      timers.delete(key);
      try {
        if (value === null || value === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, String(value));
      } catch {}
    };

    const wait = Number(debounceMs) || 0;
    if (wait <= 0) {
      write();
      return;
    }
    if (timers.has(key)) clearTimeout(timers.get(key));
    timers.set(key, setTimeout(write, wait));
  }

  function getJSON(key, fallback = null) {
    const raw = getRaw(key, null);
    if (!raw) return fallback;
    const parsed = safeParseJson(raw);
    return parsed == null ? fallback : parsed;
  }

  function setJSON(key, obj, { debounceMs = DEBOUNCE_DEFAULT_MS } = {}) {
    setRaw(key, JSON.stringify(obj), { debounceMs });
  }

  function snapshotNow({ label = "Snapshot" } = {}) {
    const keys = listKeys({ includeSyncMeta: true });
    const data = {};
    for (const key of keys) data[key] = getRaw(key, null);
    const entry = {
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      label: String(label || "Snapshot"),
      data
    };
    const list = getJSON(SNAPSHOT_KEY, []);
    const next = Array.isArray(list) ? list : [];
    next.unshift(entry);
    while (next.length > 12) next.pop();
    setJSON(SNAPSHOT_KEY, next, { debounceMs: 0 });
    return entry;
  }

  function listSnapshots() {
    const list = getJSON(SNAPSHOT_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function restoreSnapshot(snapshotId, { mode = "replace" } = {}) {
    const snaps = listSnapshots();
    const snap = snaps.find((s) => s && s.id === snapshotId);
    if (!snap || !snap.data || typeof snap.data !== "object") return false;

    snapshotNow({ label: "Auto: pre-restore" });

    const incoming = snap.data;
    if (mode === "replace") {
      const existing = listKeys({ includeSyncMeta: true });
      const keep = new Set(Object.keys(incoming));
      for (const key of existing) {
        if (!keep.has(key)) {
          try {
            localStorage.removeItem(key);
          } catch {}
        }
      }
    }
    for (const [key, value] of Object.entries(incoming)) {
      try {
        if (value === null || value === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, String(value));
      } catch {}
    }

    try {
      window.dispatchEvent(new CustomEvent("study:state-replaced", { detail: { source: "snapshot" } }));
    } catch {}
    return true;
  }

  function normalizeBackupJson(obj) {
    if (!obj || typeof obj !== "object") return null;

    // Legacy export: plain map of keys -> values.
    if (!("data" in obj) && Object.keys(obj).some((k) => k.startsWith("study"))) {
      return {
        app: "StudyPlanner",
        schemaVersion: 1,
        exportedAt: null,
        data: obj
      };
    }

    if (!obj.data || typeof obj.data !== "object") return null;
    const schemaVersion = Number(obj.schemaVersion || 1) || 1;
    return {
      app: String(obj.app || "StudyPlanner"),
      schemaVersion,
      exportedAt: obj.exportedAt || null,
      data: obj.data
    };
  }

  function validateBackup(backup) {
    const b = normalizeBackupJson(backup);
    if (!b) return { ok: false, error: "Invalid backup format." };
    if (!b.data || typeof b.data !== "object") return { ok: false, error: "Backup has no data section." };
    const keys = Object.keys(b.data);
    if (!keys.length) return { ok: false, error: "Backup is empty." };
    for (const k of keys) {
      const v = b.data[k];
      if (typeof v !== "string" && v !== null) {
        return { ok: false, error: `Backup key ${k} must be a string or null.` };
      }
    }
    return { ok: true, backup: b };
  }

  const migrations = new Map();
  function migrateBackup(backup) {
    let b = backup;
    let v = Number(b.schemaVersion || 1) || 1;
    while (v < SCHEMA_VERSION) {
      const fn = migrations.get(v);
      if (!fn) break;
      b = fn(b);
      v = Number(b.schemaVersion || v + 1) || v + 1;
    }
    if (!b.schemaVersion) b.schemaVersion = v;
    return b;
  }

  function exportAll() {
    const keys = listKeys({ includeSyncMeta: true });
    const data = {};
    for (const key of keys) data[key] = getRaw(key, null);
    return {
      app: "StudyPlanner",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data
    };
  }

  function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }

  function applyBackup(backup, { mode = "merge" } = {}) {
    const validation = validateBackup(backup);
    if (!validation.ok) return { ok: false, error: validation.error };
    const migrated = migrateBackup(validation.backup);

    snapshotNow({ label: "Auto: pre-import" });

    const incoming = migrated.data;
    if (mode === "replace") {
      const existing = listKeys({ includeSyncMeta: true });
      const keep = new Set(Object.keys(incoming));
      for (const key of existing) {
        if (!keep.has(key)) {
          try {
            localStorage.removeItem(key);
          } catch {}
        }
      }
    }
    for (const [key, value] of Object.entries(incoming)) {
      try {
        if (value === null || value === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, String(value));
      } catch {}
    }

    try {
      window.dispatchEvent(new CustomEvent("study:state-replaced", { detail: { source: "import" } }));
    } catch {}

    return { ok: true, schemaVersion: migrated.schemaVersion, keys: Object.keys(incoming).length };
  }

  StudyPlanner.Storage = Object.assign(StudyPlanner.Storage || {}, {
    SCHEMA_VERSION,
    SNAPSHOT_KEY,
    listKeys,
    getRaw,
    setRaw,
    getJSON,
    setJSON,
    exportAll,
    downloadJson,
    validateBackup,
    applyBackup,
    snapshotNow,
    listSnapshots,
    restoreSnapshot
  });
})();

