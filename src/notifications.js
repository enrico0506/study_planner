(() => {
  const existing = window.StudyPlanner && typeof window.StudyPlanner === "object" ? window.StudyPlanner : {};
  const StudyPlanner = (window.StudyPlanner = existing);
  const Storage = StudyPlanner.Storage || null;

  const SETTINGS_KEY = "studyNotificationSettings_v1";
  const STATE_KEY = "studyNotificationState_v1";

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

  function isSecureContextForNotifications() {
    const loc = window.location;
    if (!loc) return false;
    if (loc.protocol === "https:") return true;
    if (loc.hostname === "localhost" || loc.hostname === "127.0.0.1") return true;
    return false;
  }

  function normalizeSettings(raw) {
    const s = raw && typeof raw === "object" ? raw : {};
    return {
      enableToasts: s.enableToasts !== false,
      enableSystem: !!s.enableSystem,
      leadMinutes: Math.max(1, Math.round(Number(s.leadMinutes) || 10)),
      quietStart: s.quietStart || "22:00",
      quietEnd: s.quietEnd || "07:00",
      categories: {
        timer: s.categories ? s.categories.timer !== false : true,
        assignments: s.categories ? s.categories.assignments !== false : true,
        studyBlocks: s.categories ? s.categories.studyBlocks !== false : true,
        review: s.categories ? s.categories.review !== false : true,
        budget: s.categories ? s.categories.budget !== false : true
      }
    };
  }

  function loadSettings() {
    return normalizeSettings(getJSON(SETTINGS_KEY, {}));
  }

  async function maybeRequestPermission(enableSystem) {
    if (!enableSystem) return;
    if (!("Notification" in window)) return;
    if (!isSecureContextForNotifications()) return;
    if (Notification.permission === "granted") return;
    if (Notification.permission === "denied") return;
    try {
      await Notification.requestPermission();
    } catch {}
  }

  function saveSettings(next) {
    const cur = loadSettings();
    const n = next && typeof next === "object" ? next : {};
    const out = normalizeSettings({
      ...cur,
      ...n,
      categories: { ...(cur.categories || {}), ...(n.categories || {}) }
    });
    setJSON(SETTINGS_KEY, out, { debounceMs: 0 });
    try {
      window.dispatchEvent(new CustomEvent("study:notifications-changed"));
    } catch {}
    maybeRequestPermission(out.enableSystem);
    return out;
  }

  function loadState() {
    const s = getJSON(STATE_KEY, {});
    return s && typeof s === "object" ? s : {};
  }

  function saveState(next) {
    setJSON(STATE_KEY, next && typeof next === "object" ? next : {}, { debounceMs: 0 });
  }

  function inQuietHours(settings, now = new Date()) {
    const toMin = (t) => {
      const m = String(t || "").match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return null;
      return Number(m[1]) * 60 + Number(m[2]);
    };
    const start = toMin(settings.quietStart);
    const end = toMin(settings.quietEnd);
    if (start == null || end == null) return false;
    const cur = now.getHours() * 60 + now.getMinutes();
    if (start === end) return false;
    if (start < end) return cur >= start && cur < end;
    return cur >= start || cur < end;
  }

  function toast(message, tone = "info") {
    const settings = loadSettings();
    if (!settings.enableToasts) return;
    if (typeof window.showToast === "function") {
      window.showToast(message, tone);
      return;
    }
    // minimal fallback
    try {
      const containerId = "toastContainer";
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        container.className = "toast-container";
        document.body.appendChild(container);
      }
      const t = document.createElement("div");
      t.className = "toast toast-" + tone;
      t.textContent = message;
      container.appendChild(t);
      requestAnimationFrame(() => t.classList.add("toast-visible"));
      setTimeout(() => {
        t.classList.remove("toast-visible");
        setTimeout(() => t.remove(), 200);
      }, 2200);
    } catch {}
  }

  function systemNotify(title, body) {
    const settings = loadSettings();
    if (!settings.enableSystem) return;
    if (!("Notification" in window)) return;
    if (!isSecureContextForNotifications()) return;
    if (Notification.permission !== "granted") return;
    try {
      new Notification(title, { body: String(body || ""), silent: true });
    } catch {}
  }

  function notify({ title, body, tone = "info" }) {
    const settings = loadSettings();
    if (inQuietHours(settings)) return;
    toast(body || title, tone);
    systemNotify(title, body);
  }

  function loadAssignments() {
    const list = getJSON("studyAssignments", []);
    return Array.isArray(list) ? list : [];
  }

  function loadCalendar() {
    const list = getJSON("studyCalendarEvents_v1", []);
    return Array.isArray(list) ? list : [];
  }

  function loadSessions() {
    const list = getJSON("studySessions_v1", []);
    return Array.isArray(list) ? list : [];
  }

  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function checkReviewNag(now) {
    const settings = loadSettings();
    if (!settings.categories.review) return;
    const state = loadState();
    const today = dateKey(now);
    if (state.lastReviewNagDate === today) return;
    const engine = StudyPlanner.ReviewEngine;
    if (!engine || typeof engine.getQueue !== "function") return;
    const items = engine.getQueue({ limit: 1 }) || [];
    if (!items.length) return;
    state.lastReviewNagDate = today;
    saveState(state);
    notify({ title: "Review due", body: "You have items due for review today.", tone: "info" });
  }

  function checkAssignmentDue(now) {
    const settings = loadSettings();
    if (!settings.categories.assignments) return;
    const state = loadState();
    const list = loadAssignments().filter((a) => a && a.status !== "done" && a.dueAt);
    const ts = now.getTime();
    list.forEach((a) => {
      const due = new Date(a.dueAt).getTime();
      if (!due || Number.isNaN(due)) return;
      const diffMin = Math.round((due - ts) / 60000);
      const key24 = `due24_${a.id}`;
      const key2 = `due2_${a.id}`;
      if (diffMin <= 24 * 60 && diffMin > 22 * 60 && !state[key24]) {
        state[key24] = now.toISOString();
        notify({ title: "Due soon", body: `${a.title} is due in ~24 hours.`, tone: "warn" });
      }
      if (diffMin <= 120 && diffMin > 105 && !state[key2]) {
        state[key2] = now.toISOString();
        notify({ title: "Due soon", body: `${a.title} is due in ~2 hours.`, tone: "warn" });
      }
    });
    saveState(state);
  }

  function checkStudyBlockLead(now) {
    const settings = loadSettings();
    if (!settings.categories.studyBlocks) return;
    const lead = settings.leadMinutes || 10;
    const state = loadState();
    const today = dateKey(now);
    const list = loadCalendar().filter((e) => e && e.type === "study" && e.date === today && e.time);
    const ts = now.getTime();
    list.forEach((e) => {
      const m = String(e.time).match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return;
      const start = new Date(now);
      start.setHours(Number(m[1]), Number(m[2]), 0, 0);
      const diffMin = Math.round((start.getTime() - ts) / 60000);
      const k = `block_${e.id}_${lead}`;
      if (diffMin <= lead && diffMin >= lead - 2 && !state[k]) {
        state[k] = now.toISOString();
        notify({ title: "Upcoming study block", body: `Starts in ~${lead} min: ${e.title}`, tone: "info" });
      }
    });
    saveState(state);
  }

  function checkBudget(now) {
    const settings = loadSettings();
    if (!settings.categories.budget) return;
    const TB = StudyPlanner.TimeBudget;
    if (!TB || !TB.load || !TB.computeUsage) return;
    const budget = TB.load();
    if (!budget.dailyMaxMinutes && !budget.weeklyMaxMinutes) return;
    const sessions = loadSessions();
    const usage = TB.computeUsage(sessions, now.getTime());
    const state = loadState();
    const today = dateKey(now);
    const k = `budget_${today}`;
    if (state[k]) return;
    const overDaily = budget.dailyMaxMinutes && usage.dayMin >= budget.dailyMaxMinutes;
    const overWeekly = budget.weeklyMaxMinutes && usage.weekMin >= budget.weeklyMaxMinutes;
    if (!overDaily && !overWeekly) return;
    state[k] = now.toISOString();
    saveState(state);
    notify({
      title: "Time budget",
      body: overDaily ? "You reached your daily time budget." : "You reached your weekly time budget.",
      tone: "warn"
    });
  }

  function tick() {
    const now = new Date();
    checkReviewNag(now);
    checkAssignmentDue(now);
    checkStudyBlockLead(now);
    checkBudget(now);
  }

  function init() {
    // Run once on load and then every minute while open.
    tick();
    setInterval(tick, 60000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) tick();
    });
  }

  StudyPlanner.Notifications = Object.assign(StudyPlanner.Notifications || {}, {
    SETTINGS_KEY,
    STATE_KEY,
    loadSettings,
    saveSettings,
    toast,
    notify,
    tick
  });

  init();
})();

