(() => {
  const StudyPlanner = window.StudyPlanner || {};
  const Storage = StudyPlanner.Storage || null;
  const TimeBudget = StudyPlanner.TimeBudget || null;

  const SESSIONS_KEY = "studySessions_v1";
  const SUBJECTS_KEY = "studySubjects_v1";
  const CALENDAR_KEY = "studyCalendarEvents_v1";

  const ui = {
    openBtn: document.getElementById("openInsightsBtn"),
    backdrop: document.getElementById("insightsBackdrop"),
    closeBtn: document.getElementById("insightsCloseBtn"),
    closeBtn2: document.getElementById("insightsCloseBtn2"),
    body: document.getElementById("insightsBody"),
  };

  if (!ui.openBtn || !ui.backdrop || !ui.body) return;

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

  function startOfDayMs(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function daysAgoMs(days) {
    const now = new Date();
    const start = startOfDayMs(now);
    return start - days * 86400000;
  }

  function minutes(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n));
  }

  function fmtMin(min) {
    const m = minutes(min);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  }

  function loadSessions() {
    const list = getJSON(SESSIONS_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function loadSubjects() {
    const list = getJSON(SUBJECTS_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function loadCalendar() {
    const list = getJSON(CALENDAR_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function subjectNameById(subjects, id) {
    const s = subjects.find((x) => x && x.id === id);
    return (s && s.name) || "Unknown";
  }

  function sumMinutesInRange(sessions, startMs) {
    let sum = 0;
    sessions.forEach((s) => {
      const ended = s && s.endedAt ? new Date(s.endedAt).getTime() : null;
      if (!ended || Number.isNaN(ended)) return;
      if (ended < startMs) return;
      sum += minutes(Number(s.durationMinutes) || 0);
    });
    return sum;
  }

  function dayKeysStudied(sessions, days) {
    const keys = new Set();
    const cutoff = daysAgoMs(days - 1);
    sessions.forEach((s) => {
      const ended = s && s.endedAt ? new Date(s.endedAt) : null;
      if (!ended || Number.isNaN(ended.getTime())) return;
      if (ended.getTime() < cutoff) return;
      const k = ended.getFullYear() + "-" + String(ended.getMonth() + 1).padStart(2, "0") + "-" + String(ended.getDate()).padStart(2, "0");
      keys.add(k);
    });
    return Array.from(keys);
  }

  function computeStreak(sessions) {
    const byDay = new Set(dayKeysStudied(sessions, 3650));
    let streak = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (streak < 3650) {
      const k = cursor.getFullYear() + "-" + String(cursor.getMonth() + 1).padStart(2, "0") + "-" + String(cursor.getDate()).padStart(2, "0");
      if (!byDay.has(k)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function perSubjectMinutes(sessions) {
    const map = new Map();
    sessions.forEach((s) => {
      const sid = s && s.subjectId ? s.subjectId : null;
      if (!sid) return;
      map.set(sid, (map.get(sid) || 0) + minutes(Number(s.durationMinutes) || 0));
    });
    return map;
  }

  function plannedMinutesRange(events, startMs) {
    let sum = 0;
    events.forEach((e) => {
      if (!e || e.type !== "study") return;
      const d = e.date ? new Date(e.date) : null;
      if (!d || Number.isNaN(d.getTime())) return;
      const day = startOfDayMs(d);
      if (day < startMs) return;
      const dur = minutes(Number(e.durationMinutes) || 0) || 50;
      sum += dur;
    });
    return sum;
  }

  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = String(text);
    return n;
  }

  function kpi(label, value) {
    const box = el("div", "insight-kpi");
    box.appendChild(el("div", "insight-kpi-label", label));
    box.appendChild(el("div", "insight-kpi-value", value));
    return box;
  }

  function barRow(label, value, max) {
    const row = el("div", "bar-row");
    const left = el("div", "", label);
    const right = el("div", "calendar-event-meta", fmtMin(value));
    const track = el("div", "bar-track");
    const fill = el("div", "bar-fill");
    const pct = max ? Math.max(2, Math.round((value * 100) / max)) : 0;
    fill.style.width = `${Math.min(100, pct)}%`;
    track.appendChild(fill);
    left.appendChild(track);
    row.appendChild(left);
    row.appendChild(right);
    return row;
  }

  function render() {
    const sessions = loadSessions();
    const subjects = loadSubjects();
    const calendar = loadCalendar();
    const start7 = daysAgoMs(6);
    const start14 = daysAgoMs(13);
    const start30 = daysAgoMs(29);

    ui.body.replaceChildren();

    const kpis = el("div", "insights-grid");
    const total7 = sumMinutesInRange(sessions, start7);
    const total14 = sumMinutesInRange(sessions, start14);
    const total30 = sumMinutesInRange(sessions, start30);
    kpis.appendChild(kpi("Last 7 days", fmtMin(total7)));
    kpis.appendChild(kpi("Last 14 days", fmtMin(total14)));
    kpis.appendChild(kpi("Last 30 days", fmtMin(total30)));
    ui.body.appendChild(kpis);

    const secA = el("div", "insights-section");
    secA.appendChild(el("div", "insights-title", "Consistency"));
    const days14 = dayKeysStudied(sessions, 14).length;
    const streak = computeStreak(sessions);
    secA.appendChild(el("div", "calendar-event-meta", `${days14} / 14 days studied · Current streak: ${streak} day${streak === 1 ? "" : "s"}`));
    ui.body.appendChild(secA);

    const secB = el("div", "insights-section");
    secB.appendChild(el("div", "insights-title", "By subject (last 30 days)"));
    const perSubj = new Map();
    sessions.forEach((s) => {
      const ended = s && s.endedAt ? new Date(s.endedAt).getTime() : null;
      if (!ended || Number.isNaN(ended)) return;
      if (ended < start30) return;
      const sid = s.subjectId;
      if (!sid) return;
      perSubj.set(sid, (perSubj.get(sid) || 0) + minutes(Number(s.durationMinutes) || 0));
    });
    const rows = el("div", "bar-list");
    const sorted = Array.from(perSubj.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = sorted[0] ? sorted[0][1] : 0;
    if (!sorted.length) {
      rows.appendChild(el("div", "calendar-empty", "No session data yet. Finish a study session to start building insights."));
    } else {
      sorted.forEach(([sid, min]) => rows.appendChild(barRow(subjectNameById(subjects, sid), min, max)));
    }
    secB.appendChild(rows);
    ui.body.appendChild(secB);

    const secC = el("div", "insights-section");
    secC.appendChild(el("div", "insights-title", "Plan vs done (last 7 days)"));
    const planned7 = plannedMinutesRange(calendar, start7);
    secC.appendChild(el("div", "calendar-event-meta", `Planned: ${fmtMin(planned7)} · Done: ${fmtMin(total7)}`));
    ui.body.appendChild(secC);

    const secD = el("div", "insights-section");
    secD.appendChild(el("div", "insights-title", "Time budget"));
    const settings = TimeBudget ? TimeBudget.load() : { dailyMaxMinutes: 0, weeklyMaxMinutes: 0, mode: "warn" };
    const usage = TimeBudget ? TimeBudget.computeUsage(sessions, Date.now()) : { dayMin: 0, weekMin: 0 };
    const dayLine = settings.dailyMaxMinutes ? `${fmtMin(usage.dayMin)} / ${fmtMin(settings.dailyMaxMinutes)}` : `${fmtMin(usage.dayMin)} (daily limit off)`;
    const weekLine = settings.weeklyMaxMinutes ? `${fmtMin(usage.weekMin)} / ${fmtMin(settings.weeklyMaxMinutes)}` : `${fmtMin(usage.weekMin)} (weekly limit off)`;
    secD.appendChild(el("div", "calendar-event-meta", `Today: ${dayLine} · Week: ${weekLine} · Mode: ${settings.mode}`));
    ui.body.appendChild(secD);
  }

  function open() {
    render();
    ui.backdrop.hidden = false;
    ui.backdrop.style.display = "flex";
  }

  function close() {
    ui.backdrop.style.display = "none";
    ui.backdrop.hidden = true;
  }

  ui.openBtn.addEventListener("click", open);
  ui.closeBtn?.addEventListener("click", close);
  ui.closeBtn2?.addEventListener("click", close);
  ui.backdrop.addEventListener("mousedown", (event) => {
    if (event.target === ui.backdrop) close();
  });

  window.addEventListener("study:sessions-changed", () => {
    if (!ui.backdrop.hidden) render();
  });
  window.addEventListener("study:budget-changed", () => {
    if (!ui.backdrop.hidden) render();
  });
})();

