(() => {
  const StudyPlanner = window.StudyPlanner || {};
  const Storage = StudyPlanner.Storage || null;
  const Assignments = StudyPlanner.Assignments || null;

  const CALENDAR_KEY = "studyCalendarEvents_v1";
  const SUBJECTS_KEY = "studySubjects_v1";
  const TIMETABLE_KEY = "studyTimetable_v1";
  const SETTINGS_KEY = "studyAutoPlanSettings_v1";

  const els = {
    openBtn: document.getElementById("autoPlanWeekBtn"),
    modal: document.getElementById("autoPlanModal"),
    backdrop: document.getElementById("autoPlanModalBackdrop"),
    closeBtn: document.getElementById("closeAutoPlanModalBtn"),
    step1: document.getElementById("autoPlanStep1"),
    step2: document.getElementById("autoPlanStep2"),
    status: document.getElementById("autoPlanStatus"),
    previewMeta: document.getElementById("autoPlanPreviewMeta"),
    previewList: document.getElementById("autoPlanPreviewList"),
    nextBtn: document.getElementById("autoPlanNextBtn"),
    backBtn: document.getElementById("autoPlanBackBtn"),
    applyBtn: document.getElementById("autoPlanApplyBtn"),
    sessionLen: document.getElementById("autoPlanSessionLen"),
    breakBuffer: document.getElementById("autoPlanBreakBuffer"),
    dailyMax: document.getElementById("autoPlanDailyMax"),
    includeWeekend: document.getElementById("autoPlanIncludeWeekend"),
    earliest: document.getElementById("autoPlanEarliest"),
    latest: document.getElementById("autoPlanLatest"),
    priority: document.getElementById("autoPlanPriority"),
  };

  if (!els.openBtn || !els.modal) return;

  const state = {
    plan: [],
    settings: null,
  };

  function safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function getRaw(key, fallback = "") {
    if (Storage) return Storage.getRaw(key, fallback);
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }

  function setJSON(key, value, { debounceMs = 0 } = {}) {
    if (Storage) return Storage.setJSON(key, value, { debounceMs });
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function setStatus(message, tone = "muted") {
    if (!els.status) return;
    els.status.textContent = String(message || "");
    els.status.dataset.tone = tone;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toTimeString(minutes) {
    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    return `${pad2(hh)}:${pad2(mm)}`;
  }

  function parseTimeToMinutes(value, fallback) {
    const m = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return fallback;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return fallback;
    return Math.max(0, Math.min(24 * 60, hh * 60 + mm));
  }

  function startOfWeek(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const weekday = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - weekday);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function dateKey(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function loadCalendarEvents() {
    const raw = getRaw(CALENDAR_KEY, "");
    const parsed = raw ? safeJsonParse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  }

  function loadSubjects() {
    const raw = getRaw(SUBJECTS_KEY, "");
    const parsed = raw ? safeJsonParse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  }

  function loadAssignments() {
    if (!Assignments) return [];
    const list = Assignments.loadAll();
    return Array.isArray(list) ? list : [];
  }

  function loadTimetableLessons() {
    const raw = getRaw(TIMETABLE_KEY, "");
    const parsed = raw ? safeJsonParse(raw) : null;
    if (!parsed) return [];
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.tables)) {
      const tableId = parsed.activeTableId || (parsed.tables[0] && parsed.tables[0].id);
      const table = parsed.tables.find((t) => t.id === tableId) || parsed.tables[0];
      return table && Array.isArray(table.lessons) ? table.lessons : [];
    }
    return [];
  }

  function normalizeIntervals(list) {
    const sorted = (list || [])
      .map((b) => ({ start: Math.max(0, b.start), end: Math.max(0, b.end) }))
      .filter((b) => b.end > b.start)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const out = [];
    for (const b of sorted) {
      const last = out[out.length - 1];
      if (!last || b.start > last.end) out.push({ ...b });
      else last.end = Math.max(last.end, b.end);
    }
    return out;
  }

  function subtractBusy(free, busy) {
    let out = free.slice();
    for (const b of busy) {
      const next = [];
      out.forEach((f) => {
        if (b.end <= f.start || b.start >= f.end) return next.push(f);
        if (b.start > f.start) next.push({ start: f.start, end: b.start });
        if (b.end < f.end) next.push({ start: b.end, end: f.end });
      });
      out = next;
    }
    return normalizeIntervals(out);
  }

  function computeWeekDates(includeWeekend) {
    const base = startOfWeek(new Date());
    const days = includeWeekend ? 7 : 5;
    const list = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      list.push(d);
    }
    return list;
  }

  function buildBusyMap(weekDates, earliestMin, latestMin) {
    const busy = new Map();
    weekDates.forEach((d, idx) => {
      const key = dateKey(d);
      busy.set(key, []);
      const dayIdx = idx; // Monday=0
      const lessons = loadTimetableLessons().filter((l) => Number(l.day) === dayIdx);
      lessons.forEach((l) => {
        const s = parseTimeToMinutes(l.start, null);
        const e = parseTimeToMinutes(l.end, null);
        if (s == null || e == null) return;
        busy.get(key).push({ start: s, end: e });
      });
    });

    const events = loadCalendarEvents();
    events.forEach((evt) => {
      if (!evt || !evt.date) return;
      if (!busy.has(evt.date)) return;
      if (!evt.time) return;
      const start = parseTimeToMinutes(evt.time, null);
      if (start == null) return;
      const dur = Number(evt.durationMinutes) || (evt.type === "study" ? 50 : evt.type === "reminder" ? 15 : 30);
      const end = Math.min(latestMin, start + Math.max(5, dur));
      if (end <= earliestMin) return;
      busy.get(evt.date).push({ start, end });
    });

    for (const [k, list] of busy.entries()) busy.set(k, normalizeIntervals(list));
    return busy;
  }

  function buildTasks({ focusPriority, sessionLen }) {
    const tasks = [];
    const now = Date.now();

    const assignments = loadAssignments()
      .filter((a) => a && a.status !== "done" && a.dueAt)
      .map((a) => {
        const due = new Date(a.dueAt);
        return Number.isNaN(due.getTime()) ? null : { a, due };
      })
      .filter(Boolean)
      .sort((x, y) => x.due - y.due);

    assignments.forEach(({ a, due }) => {
      const est = a.estimateMinutes == null ? 60 : Number(a.estimateMinutes) || 0;
      const remaining = Math.max(0, est - (Number(a.spentMinutes) || 0));
      const target = Math.max(sessionLen, remaining);
      tasks.push({
        kind: "assignment",
        id: a.id,
        title: (a.type === "exam" ? "Exam: " : "Assignment: ") + a.title,
        priority: a.priority || "normal",
        dueMs: due.getTime(),
        remainingMinutes: Math.max(15, remaining || sessionLen),
        subjectId: a.subjectId || null,
        fileId: a.fileId || null,
      });
    });

    const subjects = loadSubjects();
    const fileTasks = [];
    subjects.forEach((s) => {
      (Array.isArray(s.files) ? s.files : []).forEach((f) => {
        const conf = Number(f.confidence);
        const confScore = Number.isFinite(conf) ? 100 - conf : 30;
        const last = f.lastReviewed ? new Date(f.lastReviewed).getTime() : 0;
        const ageDays = last ? Math.max(0, Math.round((now - last) / 86400000)) : 999;
        const score = confScore + Math.min(40, ageDays);
        fileTasks.push({
          kind: "file",
          subjectId: s.id,
          fileId: f.id,
          title: `${s.name || "Subject"} – ${f.name || "File"}`,
          score,
          remainingMinutes: sessionLen,
        });
      });
    });
    fileTasks.sort((a, b) => b.score - a.score);
    fileTasks.slice(0, 20).forEach((t) => tasks.push(t));

    if (focusPriority === "confidence") {
      tasks.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "file" ? -1 : 1;
        if (a.kind === "assignment") return (a.dueMs || 0) - (b.dueMs || 0);
        return (b.score || 0) - (a.score || 0);
      });
    } else {
      tasks.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "assignment" ? -1 : 1;
        if (a.kind === "assignment") return (a.dueMs || 0) - (b.dueMs || 0);
        return (b.score || 0) - (a.score || 0);
      });
    }

    return tasks;
  }

  function generatePlan(prefs) {
    const sessionLen = Math.max(15, Number(prefs.sessionLen) || 50);
    const buffer = Math.max(0, Number(prefs.breakBuffer) || 0);
    const dailyMax = Math.max(0, Number(prefs.dailyMax) || 180);
    const earliestMin = parseTimeToMinutes(prefs.earliest, 8 * 60);
    const latestMin = parseTimeToMinutes(prefs.latest, 20 * 60);
    const includeWeekend = !!prefs.includeWeekend;
    const focusPriority = prefs.priority === "confidence" ? "confidence" : "deadlines";

    const weekDates = computeWeekDates(includeWeekend);
    const busyMap = buildBusyMap(weekDates, earliestMin, latestMin);
    const tasks = buildTasks({ focusPriority, sessionLen });

    const plan = [];
    const unscheduled = [];

    const dayBudgets = new Map();
    weekDates.forEach((d) => dayBudgets.set(dateKey(d), 0));

    const freeMap = new Map();
    weekDates.forEach((d) => {
      const key = dateKey(d);
      const baseFree = normalizeIntervals([{ start: earliestMin, end: latestMin }]);
      const busy = busyMap.get(key) || [];
      freeMap.set(key, subtractBusy(baseFree, busy));
    });

    const pickNextTask = () => tasks.find((t) => (t.remainingMinutes || 0) > 0) || null;

    weekDates.forEach((d) => {
      const key = dateKey(d);
      let used = dayBudgets.get(key) || 0;
      const free = freeMap.get(key) || [];

      for (const slot of free) {
        let cursor = slot.start;
        while (cursor + 15 <= slot.end && used < dailyMax) {
          const task = pickNextTask();
          if (!task) break;
          const remainingBudget = dailyMax - used;
          const minutes = Math.min(sessionLen, remainingBudget, task.remainingMinutes || sessionLen);
          if (cursor + minutes > slot.end) break;
          plan.push({
            id: `plan_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`,
            date: key,
            startMin: cursor,
            minutes,
            title: task.title,
            kind: task.kind,
            assignmentId: task.kind === "assignment" ? task.id : null,
            subjectId: task.subjectId || null,
            fileId: task.fileId || null,
          });
          task.remainingMinutes = Math.max(0, (task.remainingMinutes || 0) - minutes);
          used += minutes;
          cursor += minutes + buffer;
        }
        if (used >= dailyMax) break;
      }

      dayBudgets.set(key, used);
    });

    tasks
      .filter((t) => t.kind === "assignment" && (t.remainingMinutes || 0) > 0)
      .forEach((t) => unscheduled.push(t));

    return { plan, unscheduled, weekStart: dateKey(startOfWeek(new Date())) };
  }

  function renderPreview(planResult) {
    if (!els.previewList || !els.previewMeta) return;
    els.previewList.replaceChildren();
    state.plan = planResult.plan.map((p) => ({ ...p, enabled: true }));

    const uns = planResult.unscheduled || [];
    els.previewMeta.textContent = uns.length
      ? `${state.plan.length} blocks proposed. Not enough time for ${uns.length} deadline item(s).`
      : `${state.plan.length} blocks proposed.`;

    if (!state.plan.length) {
      const empty = document.createElement("div");
      empty.className = "calendar-empty";
      empty.textContent = "No free time found with the chosen settings.";
      els.previewList.appendChild(empty);
      return;
    }

    state.plan.forEach((p) => {
      const row = document.createElement("div");
      row.className = "calendar-upcoming-row";
      row.dataset.planId = p.id;

      const title = document.createElement("div");
      title.className = "calendar-upcoming-title";
      title.textContent = p.title;

      const meta = document.createElement("div");
      meta.className = "calendar-upcoming-meta";
      meta.textContent = `${p.date} · ${toTimeString(p.startMin)} · ${p.minutes} min`;

      const actions = document.createElement("div");
      actions.className = "assignments-row-actions";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = p.enabled ? "chip-btn chip-btn-primary" : "chip-btn";
      toggle.textContent = p.enabled ? "Keep" : "Removed";
      toggle.addEventListener("click", () => {
        p.enabled = !p.enabled;
        toggle.className = p.enabled ? "chip-btn chip-btn-primary" : "chip-btn";
        toggle.textContent = p.enabled ? "Keep" : "Removed";
      });
      actions.appendChild(toggle);

      row.appendChild(title);
      row.appendChild(meta);
      row.appendChild(actions);
      els.previewList.appendChild(row);
    });
  }

  function applyPlan() {
    const enabled = (state.plan || []).filter((p) => p.enabled);
    if (!enabled.length) {
      setStatus("Nothing to apply.", "error");
      return;
    }
    const events = loadCalendarEvents();
    const nowIso = new Date().toISOString();
    enabled.forEach((p) => {
      events.push({
        id: (crypto && crypto.randomUUID) ? crypto.randomUUID() : `evt_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`,
        title: p.title,
        date: p.date,
        time: toTimeString(p.startMin),
        type: "study",
        priority: "normal",
        notes: "Auto-plan week",
        done: false,
        durationMinutes: p.minutes,
        subjectId: p.subjectId || null,
        fileId: p.fileId || null,
        assignmentId: p.assignmentId || null,
        origin: "autoplan",
        createdAt: nowIso
      });
    });
    setJSON(CALENDAR_KEY, events, { debounceMs: 0 });
    try {
      window.dispatchEvent(new CustomEvent("study:calendar-changed"));
    } catch {}
    closeModal();
  }

  function showStep(step) {
    if (els.step1) els.step1.hidden = step !== 1;
    if (els.step2) els.step2.hidden = step !== 2;
  }

  function openModal() {
    els.modal.classList.add("is-open");
    els.modal.setAttribute("aria-hidden", "false");
    showStep(1);
    setStatus("", "muted");
    loadSettingsIntoForm();
  }

  function closeModal() {
    if (!els.modal.classList.contains("is-open")) return;
    els.modal.classList.remove("is-open");
    els.modal.setAttribute("aria-hidden", "true");
    showStep(1);
  }

  function loadSettings() {
    const raw = getRaw(SETTINGS_KEY, "");
    const parsed = raw ? safeJsonParse(raw) : null;
    if (!parsed || typeof parsed !== "object") {
      return {
        sessionLen: 50,
        breakBuffer: 10,
        dailyMax: 180,
        includeWeekend: true,
        earliest: "08:00",
        latest: "20:00",
        priority: "deadlines",
      };
    }
    return {
      sessionLen: Number(parsed.sessionLen) || 50,
      breakBuffer: Number(parsed.breakBuffer) || 10,
      dailyMax: Number(parsed.dailyMax) || 180,
      includeWeekend: parsed.includeWeekend !== false,
      earliest: parsed.earliest || "08:00",
      latest: parsed.latest || "20:00",
      priority: parsed.priority === "confidence" ? "confidence" : "deadlines",
    };
  }

  function saveSettingsFromForm() {
    const next = {
      sessionLen: Number(els.sessionLen?.value) || 50,
      breakBuffer: Number(els.breakBuffer?.value) || 10,
      dailyMax: Number(els.dailyMax?.value) || 180,
      includeWeekend: !!els.includeWeekend?.checked,
      earliest: els.earliest?.value || "08:00",
      latest: els.latest?.value || "20:00",
      priority: els.priority?.value === "confidence" ? "confidence" : "deadlines",
    };
    setJSON(SETTINGS_KEY, next, { debounceMs: 0 });
    state.settings = next;
    return next;
  }

  function loadSettingsIntoForm() {
    const s = state.settings || loadSettings();
    state.settings = s;
    if (els.sessionLen) els.sessionLen.value = String(s.sessionLen);
    if (els.breakBuffer) els.breakBuffer.value = String(s.breakBuffer);
    if (els.dailyMax) els.dailyMax.value = String(s.dailyMax);
    if (els.includeWeekend) els.includeWeekend.checked = !!s.includeWeekend;
    if (els.earliest) els.earliest.value = s.earliest;
    if (els.latest) els.latest.value = s.latest;
    if (els.priority) els.priority.value = s.priority;
  }

  function handlePreview() {
    const prefs = saveSettingsFromForm();
    if (!loadAssignments().length && !loadSubjects().length) {
      setStatus("No data yet. Add subjects/files or assignments first.", "error");
      return;
    }
    const res = generatePlan(prefs);
    renderPreview(res);
    showStep(2);
  }

  els.openBtn.addEventListener("click", () => openModal());
  els.closeBtn?.addEventListener("click", () => closeModal());
  els.backdrop?.addEventListener("click", (e) => {
    if (e.target === els.backdrop) closeModal();
  });
  els.nextBtn?.addEventListener("click", () => handlePreview());
  els.backBtn?.addEventListener("click", () => showStep(1));
  els.applyBtn?.addEventListener("click", () => applyPlan());

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!els.modal || !els.modal.classList.contains("is-open")) return;
    event.preventDefault();
    closeModal();
  });
})();

