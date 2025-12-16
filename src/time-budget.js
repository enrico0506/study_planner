(() => {
  const existing = window.StudyPlanner && typeof window.StudyPlanner === "object" ? window.StudyPlanner : {};
  const StudyPlanner = (window.StudyPlanner = existing);
  const Storage = StudyPlanner.Storage || null;

  const KEY = "studyTimeBudgetSettings_v1";

  function safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function getJSON(key, fallback) {
    if (Storage) return Storage.getJSON(key, fallback);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = safeJsonParse(raw);
      return parsed == null ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  function setJSON(key, value, { debounceMs = 150 } = {}) {
    if (Storage) return Storage.setJSON(key, value, { debounceMs });
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function normalize(settings) {
    const s = settings && typeof settings === "object" ? settings : {};
    const dailyMaxMinutes = Math.max(0, Math.round(Number(s.dailyMaxMinutes) || 0));
    const weeklyMaxMinutes = Math.max(0, Math.round(Number(s.weeklyMaxMinutes) || 0));
    const minBreakMinutesBetweenSessions = Math.max(0, Math.round(Number(s.minBreakMinutesBetweenSessions) || 0));
    const mode = s.mode === "hard" ? "hard" : "warn";
    return { dailyMaxMinutes, weeklyMaxMinutes, minBreakMinutesBetweenSessions, mode };
  }

  function load() {
    return normalize(getJSON(KEY, {}));
  }

  function save(next) {
    const normalized = normalize(next);
    setJSON(KEY, normalized, { debounceMs: 0 });
    try {
      window.dispatchEvent(new CustomEvent("study:budget-changed"));
    } catch {}
    return normalized;
  }

  function inWeekRange(ts, now) {
    const d = new Date(now);
    const weekday = (d.getDay() + 6) % 7;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - weekday);
    const start = d.getTime();
    const end = start + 7 * 86400000;
    return ts >= start && ts < end;
  }

  function inDayRange(ts, now) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    const start = d.getTime();
    const end = start + 86400000;
    return ts >= start && ts < end;
  }

  function computeUsage(sessions, now = Date.now()) {
    const list = Array.isArray(sessions) ? sessions : [];
    let dayMin = 0;
    let weekMin = 0;
    list.forEach((s) => {
      const endedAt = s && s.endedAt ? new Date(s.endedAt).getTime() : null;
      if (!endedAt || Number.isNaN(endedAt)) return;
      const minutes = Math.max(0, Math.round(Number(s.durationMinutes) || 0));
      if (inDayRange(endedAt, now)) dayMin += minutes;
      if (inWeekRange(endedAt, now)) weekMin += minutes;
    });
    return { dayMin, weekMin };
  }

  function canStartSession({ sessions, now = Date.now() } = {}) {
    const settings = load();
    const usage = computeUsage(sessions, now);
    if (settings.mode !== "hard") return { ok: true, settings, usage };
    if (settings.dailyMaxMinutes && usage.dayMin >= settings.dailyMaxMinutes) {
      return { ok: false, reason: "daily", settings, usage };
    }
    if (settings.weeklyMaxMinutes && usage.weekMin >= settings.weeklyMaxMinutes) {
      return { ok: false, reason: "weekly", settings, usage };
    }
    return { ok: true, settings, usage };
  }

  StudyPlanner.TimeBudget = Object.assign(StudyPlanner.TimeBudget || {}, {
    KEY,
    load,
    save,
    computeUsage,
    canStartSession
  });
})();

