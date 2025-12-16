(() => {
  const existing = window.StudyPlanner && typeof window.StudyPlanner === "object" ? window.StudyPlanner : {};
  const StudyPlanner = (window.StudyPlanner = existing);

  const APP_SCHEMA_VERSION = 2;
  const SCHEMA_KEY = "study_schema_version";
  const SNAPSHOT_KEY = "studyLocalSnapshots_v1";
  const SNAPSHOT_LIMIT = 12;

  const DEBOUNCE_DEFAULT_MS = 250;
  const writeTimers = new Map();

  function safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function listStudyKeys({ includeSyncMeta = true } = {}) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("study")) keys.push(key);
      if (includeSyncMeta && key === "sync_cloud_updated_ms_v1") keys.push(key);
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
      writeTimers.delete(key);
      try {
        if (value === null || value === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, String(value));
      } catch {}
    };

    const wait = Number(debounceMs) || 0;
    if (wait <= 0) return write();
    if (writeTimers.has(key)) clearTimeout(writeTimers.get(key));
    writeTimers.set(key, setTimeout(write, wait));
  }

  function getJSON(key, fallback = null) {
    const raw = getRaw(key, null);
    if (!raw) return fallback;
    const parsed = safeJsonParse(raw);
    return parsed == null ? fallback : parsed;
  }

  function setJSON(key, value, { debounceMs = DEBOUNCE_DEFAULT_MS } = {}) {
    setRaw(key, JSON.stringify(value), { debounceMs });
  }

  function compactSnapshots() {
    const raw = getRaw(SNAPSHOT_KEY, null);
    if (raw == null) return;

    const MAX_BYTES = 1_000_000;
    if (String(raw).length > MAX_BYTES) {
      setJSON(SNAPSHOT_KEY, [], { debounceMs: 0 });
      return;
    }

    const parsed = safeJsonParse(raw);
    if (!Array.isArray(parsed)) {
      setJSON(SNAPSHOT_KEY, [], { debounceMs: 0 });
      return;
    }

    const cleaned = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const next = { ...entry };
      if (next.data && typeof next.data === "object") {
        const data = { ...next.data };
        delete data[SNAPSHOT_KEY];
        delete data.sync_cloud_updated_ms_v1;
        next.data = data;
      }
      cleaned.push(next);
      if (cleaned.length >= SNAPSHOT_LIMIT) break;
    }

    setJSON(SNAPSHOT_KEY, cleaned, { debounceMs: 0 });
  }

  function snapshotNow({ label = "Snapshot" } = {}) {
    const data = {};
    const keys = listStudyKeys({ includeSyncMeta: true }).filter((k) => k !== SNAPSHOT_KEY);
    for (const k of keys) data[k] = getRaw(k, null);

    const entry = {
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      label: String(label || "Snapshot"),
      data
    };

    const list = getJSON(SNAPSHOT_KEY, []);
    const next = Array.isArray(list) ? list : [];
    next.unshift(entry);
    while (next.length > SNAPSHOT_LIMIT) next.pop();
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
    applyKeySnapshot(snap.data, { mode });
    return true;
  }

  function applyKeySnapshot(data, { mode = "merge" } = {}) {
    const incoming = data && typeof data === "object" ? data : {};
    if (mode === "replace") {
      const existing = listStudyKeys({ includeSyncMeta: true });
      const keep = new Set(Object.keys(incoming));
      for (const k of existing) {
        if (!keep.has(k)) {
          try {
            localStorage.removeItem(k);
          } catch {}
        }
      }
    }
    for (const [k, v] of Object.entries(incoming)) {
      try {
        if (v === null || v === undefined) localStorage.removeItem(k);
        else localStorage.setItem(k, String(v));
      } catch {}
    }
    try {
      window.dispatchEvent(new CustomEvent("study:state-replaced", { detail: { source: "data-tools" } }));
    } catch {}
  }

  function exportAll() {
    const data = {};
    const keys = listStudyKeys({ includeSyncMeta: true });
    for (const k of keys) data[k] = getRaw(k, null);
    return {
      app: "StudyPlanner",
      schemaVersion: APP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data
    };
  }

  function normalizeBackupJson(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (obj.data && typeof obj.data === "object") {
      return {
        app: String(obj.app || "StudyPlanner"),
        schemaVersion: Number(obj.schemaVersion || 1) || 1,
        exportedAt: obj.exportedAt || null,
        data: obj.data
      };
    }
    // Legacy export: plain object of keys -> values.
    const keys = Object.keys(obj);
    if (keys.some((k) => k.startsWith("study"))) {
      return { app: "StudyPlanner", schemaVersion: 1, exportedAt: null, data: obj };
    }
    return null;
  }

  function validateBackup(obj) {
    const b = normalizeBackupJson(obj);
    if (!b) return { ok: false, error: "Invalid backup format." };
    if (!b.data || typeof b.data !== "object") return { ok: false, error: "Backup is missing data." };
    const keys = Object.keys(b.data);
    if (!keys.length) return { ok: false, error: "Backup contains no keys." };
    for (const k of keys) {
      const v = b.data[k];
      if (typeof v !== "string" && v !== null) return { ok: false, error: `Key ${k} must be a string or null.` };
    }
    return { ok: true, backup: b };
  }

  const migrations = new Map();
  function registerMigration(fromVersion, fn) {
    migrations.set(Number(fromVersion) || 0, fn);
  }

  function migrateNotesFromSubjectsRaw(subjectsRaw, notesRaw) {
    const subjects = safeJsonParse(subjectsRaw);
    const notes = safeJsonParse(notesRaw);
    const notesMap = notes && typeof notes === "object" && !Array.isArray(notes) ? { ...notes } : {};
    if (!Array.isArray(subjects)) return notesMap;
    const nowIso = new Date().toISOString();
    subjects.forEach((subj) => {
      if (!subj || typeof subj !== "object") return;
      const sid = subj.id;
      const files = Array.isArray(subj.files) ? subj.files : [];
      files.forEach((file) => {
        if (!file || typeof file !== "object") return;
        if (!sid || !file.id) return;
        const plain = String(file.notes || "").trim();
        if (!plain) return;
        const scopeId = `${sid}:${file.id}`;
        const key = `file:${scopeId}`;
        if (notesMap[key] && typeof notesMap[key] === "object") return;
        notesMap[key] = { scope: "file", scopeId, contentMd: plain, updatedAt: nowIso };
      });
    });
    return notesMap;
  }

  // v1 -> v2: Introduce `studyNotes_v1` and migrate file.notes into Markdown notes (additive; preserves original).
  registerMigration(1, (backup) => {
    if (backup && backup.data && typeof backup.data === "object") {
      const subjectsRaw = backup.data.studySubjects_v1 || "";
      const notesRaw = backup.data.studyNotes_v1 || "";
      const nextNotes = migrateNotesFromSubjectsRaw(subjectsRaw, notesRaw);
      return {
        ...backup,
        schemaVersion: 2,
        data: {
          ...backup.data,
          studyNotes_v1: JSON.stringify(nextNotes)
        }
      };
    }
    try {
      const subjectsRaw = getRaw("studySubjects_v1", "");
      const notesRaw = getRaw("studyNotes_v1", "");
      const nextNotes = migrateNotesFromSubjectsRaw(subjectsRaw, notesRaw);
      setJSON("studyNotes_v1", nextNotes, { debounceMs: 0 });
    } catch {}
  });

  function migrateLocal() {
    let current = 0;
    let hadSchemaKey = true;
    try {
      const raw = localStorage.getItem(SCHEMA_KEY);
      if (raw == null || raw === "") {
        hadSchemaKey = false;
        current = 1; // assume legacy v1 and run forward migrations (safe no-ops for fresh installs)
      } else {
        current = Number(raw) || 0;
      }
    } catch {
      hadSchemaKey = false;
      current = 1;
    }
    let v = current || 1;
    while (v < APP_SCHEMA_VERSION) {
      const fn = migrations.get(v);
      if (!fn) break;
      try {
        fn();
      } catch {}
      v += 1;
      setRaw(SCHEMA_KEY, String(v), { debounceMs: 0 });
    }
    if (!hadSchemaKey) {
      setRaw(SCHEMA_KEY, String(APP_SCHEMA_VERSION), { debounceMs: 0 });
    }
  }

  function migrateBackup(backup) {
    let b = backup;
    let v = Number(b.schemaVersion || 1) || 1;
    while (v < APP_SCHEMA_VERSION) {
      const fn = migrations.get(v);
      if (!fn) break;
      b = fn(b);
      v = Number(b.schemaVersion || v + 1) || v + 1;
    }
    if (!b.schemaVersion) b.schemaVersion = v;
    return b;
  }

  function applyBackup(backup, { mode = "merge" } = {}) {
    const validation = validateBackup(backup);
    if (!validation.ok) return { ok: false, error: validation.error };
    const migrated = migrateBackup(validation.backup);
    snapshotNow({ label: "Auto: pre-import" });
    applyKeySnapshot(migrated.data, { mode });
    return { ok: true, keys: Object.keys(migrated.data || {}).length, schemaVersion: migrated.schemaVersion };
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

  function estimateLocalStorageBytes() {
    const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
    const entries = [];
    let totalBytes = 0;

    const measure = (str) => {
      const text = String(str ?? "");
      return encoder ? encoder.encode(text).length : text.length * 2;
    };

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = getRaw(key, "");
      const bytes = measure(key) + measure(value);
      entries.push({ key, bytes });
      totalBytes += bytes;
    }

    entries.sort((a, b) => b.bytes - a.bytes);
    return { totalBytes, entries };
  }

  StudyPlanner.Storage = Object.assign(StudyPlanner.Storage || {}, {
    APP_SCHEMA_VERSION,
    SCHEMA_KEY,
    SNAPSHOT_KEY,
    listStudyKeys,
    getRaw,
    setRaw,
    getJSON,
    setJSON,
    registerMigration,
    migrateLocal,
    exportAll,
    validateBackup,
    applyBackup,
    snapshotNow,
    listSnapshots,
    restoreSnapshot,
    downloadJson,
    compactSnapshots,
    estimateLocalStorageBytes
  });

  compactSnapshots();
  migrateLocal();
})();
