(() => {
  const existing = window.StudyPlanner && typeof window.StudyPlanner === "object" ? window.StudyPlanner : {};
  const StudyPlanner = (window.StudyPlanner = existing);
  const Storage = StudyPlanner.Storage || null;

  const ASSIGNMENTS_KEY = "studyAssignments";
  const SETTINGS_KEY = "studyAssignmentsSettings";

  function nowIso() {
    return new Date().toISOString();
  }

  function safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function loadRaw(key, fallback) {
    if (Storage) return Storage.getRaw(key, fallback);
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value, { debounceMs = 150 } = {}) {
    if (Storage) return Storage.setJSON(key, value, { debounceMs });
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function normalizeMinutes(val, fallback = 0) {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.round(n));
  }

  function normalizeItem(raw) {
    const item = raw && typeof raw === "object" ? { ...raw } : {};
    if (!item.id) item.id = `as_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    item.type = item.type === "exam" ? "exam" : "assignment";
    item.title = String(item.title || "").trim();
    item.subjectId = item.subjectId || null;
    item.fileId = item.fileId || null;
    item.dueAt = item.dueAt ? String(item.dueAt) : "";
    item.estimateMinutes = item.estimateMinutes == null ? null : normalizeMinutes(item.estimateMinutes, 0);
    item.spentMinutes = normalizeMinutes(item.spentMinutes, 0);
    item.status = item.status === "done" ? "done" : item.status === "in_progress" ? "in_progress" : "todo";
    item.priority = item.priority === "high" ? "high" : item.priority === "low" ? "low" : "normal";
    item.notesMd = item.notesMd ? String(item.notesMd) : "";
    item.createdAt = item.createdAt ? String(item.createdAt) : nowIso();
    item.updatedAt = item.updatedAt ? String(item.updatedAt) : item.createdAt;
    return item;
  }

  function loadAll() {
    const raw = loadRaw(ASSIGNMENTS_KEY, "");
    if (!raw) return [];
    const parsed = safeJsonParse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeItem).filter((i) => i.title);
  }

  function saveAll(list, { debounceMs = 150 } = {}) {
    const normalized = (Array.isArray(list) ? list : []).map(normalizeItem);
    saveJson(ASSIGNMENTS_KEY, normalized, { debounceMs });
    try {
      window.dispatchEvent(new CustomEvent("study:assignments-changed"));
    } catch {}
    return normalized;
  }

  function getById(id) {
    if (!id) return null;
    const list = loadAll();
    return list.find((i) => i.id === id) || null;
  }

  function upsert(item) {
    const list = loadAll();
    const normalized = normalizeItem(item);
    const idx = list.findIndex((i) => i.id === normalized.id);
    normalized.updatedAt = nowIso();
    if (idx >= 0) list[idx] = { ...list[idx], ...normalized };
    else list.push(normalized);
    saveAll(list);
    return normalized;
  }

  function remove(id) {
    const list = loadAll();
    const next = list.filter((i) => i.id !== id);
    if (next.length === list.length) return false;
    saveAll(next);
    return true;
  }

  function duplicate(id) {
    const item = getById(id);
    if (!item) return null;
    const copy = {
      ...item,
      id: `as_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      status: "todo",
      spentMinutes: 0,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    return upsert(copy);
  }

  function addSpentMinutes(id, minutesToAdd) {
    const add = normalizeMinutes(minutesToAdd, 0);
    if (!id || add <= 0) return null;
    const list = loadAll();
    const idx = list.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    const item = normalizeItem(list[idx]);
    item.spentMinutes = normalizeMinutes(item.spentMinutes + add, 0);
    if (item.status === "todo") item.status = "in_progress";
    item.updatedAt = nowIso();
    list[idx] = item;
    saveAll(list);
    return item;
  }

  function loadSettings() {
    const raw = loadRaw(SETTINGS_KEY, "");
    const parsed = raw ? safeJsonParse(raw) : null;
    if (!parsed || typeof parsed !== "object") {
      return { defaultEstimateMinutes: 60, upcomingDays: 14, hideDone: false };
    }
    return {
      defaultEstimateMinutes: normalizeMinutes(parsed.defaultEstimateMinutes, 60) || 60,
      upcomingDays: normalizeMinutes(parsed.upcomingDays, 14) || 14,
      hideDone: !!parsed.hideDone
    };
  }

  function saveSettings(settings) {
    const s = settings && typeof settings === "object" ? settings : {};
    const next = loadSettings();
    if (s.defaultEstimateMinutes != null) next.defaultEstimateMinutes = normalizeMinutes(s.defaultEstimateMinutes, next.defaultEstimateMinutes);
    if (s.upcomingDays != null) next.upcomingDays = normalizeMinutes(s.upcomingDays, next.upcomingDays);
    if (s.hideDone != null) next.hideDone = !!s.hideDone;
    saveJson(SETTINGS_KEY, next, { debounceMs: 0 });
    return next;
  }

  StudyPlanner.Assignments = Object.assign(StudyPlanner.Assignments || {}, {
    ASSIGNMENTS_KEY,
    SETTINGS_KEY,
    loadAll,
    saveAll,
    getById,
    upsert,
    remove,
    duplicate,
    addSpentMinutes,
    loadSettings,
    saveSettings
  });
})();

