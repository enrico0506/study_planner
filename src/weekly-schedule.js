(() => {
  const StudyPlanner = window.StudyPlanner || (window.StudyPlanner = {});
  const Storage = StudyPlanner.Storage || null;

  const STORAGE_KEY = "studyCalendarEvents_v1";
  const NARROW_MQ = "(max-width: 960px)";
  const WORK_DAYS = 5; // Monday–Friday

  const START_HOUR = 9;
  const END_HOUR = 20;
  const SLOT_MINUTES = 30;

  const root = document.getElementById("weeklyShell");
  if (!root) return;

  const els = {
    sidebar: document.getElementById("wsSidebar"),
    sidebarToggle: document.getElementById("wsSidebarToggle"),
    sidebarBackdrop: document.getElementById("wsSidebarBackdrop"),
    addTaskBtn: document.getElementById("wsAddTaskBtn"),

    viewWeekBtn: document.getElementById("wsViewWeekBtn"),
    viewMonthBtn: document.getElementById("wsViewMonthBtn"),

    todayBtn: document.getElementById("wsTodayBtn"),
    prevWeekBtn: document.getElementById("wsPrevWeekBtn"),
    nextWeekBtn: document.getElementById("wsNextWeekBtn"),

    planBtn: document.getElementById("wsPlanBtn"),
    planPopover: document.getElementById("wsPlanPopover"),
    planAddTaskBtn: document.getElementById("wsPlanAddTaskBtn"),
    planAddAssignmentBtn: document.getElementById("wsPlanAddAssignmentBtn"),
    planAutoPlanBtn: document.getElementById("wsPlanAutoPlanBtn"),

    monthLabel: document.getElementById("wsMonthLabel"),
    weekRangeLabel: document.getElementById("wsWeekRangeLabel"),
    dayStrip: document.getElementById("wsDayStrip"),

    weekView: document.getElementById("wsWeekView"),
    monthView: document.getElementById("wsMonthView"),
    monthGrid: document.getElementById("wsMonthGrid"),

    gridScroll: document.getElementById("wsGridScroll"),
    gridHead: document.getElementById("wsGridHead"),
    grid: document.getElementById("wsGrid"),

    reviewList: document.getElementById("calendarReviewList"),

    modal: document.getElementById("calendarModal"),
    modalBackdrop: document.getElementById("calendarModalBackdrop"),
    modalTitle: document.getElementById("modalTitle"),
    modalDateLabel: document.getElementById("modalDateLabel"),
    closeModalBtn: document.getElementById("closeModalBtn"),
    todayModalBtn: document.getElementById("newDeadlineTodayBtn"),
    form: document.getElementById("calendarForm"),
    titleInput: document.getElementById("eventTitleInput"),
    dateInput: document.getElementById("eventDateInput"),
    startInput: document.getElementById("eventTimeInput"),
    endInput: document.getElementById("eventEndTimeInput"),
    typeSelect: document.getElementById("eventTypeSelect"),
    prioritySelect: document.getElementById("eventPrioritySelect"),
    notesInput: document.getElementById("eventNotesInput"),
    doneInput: document.getElementById("eventDoneInput"),
    deleteBtn: document.getElementById("eventDeleteBtn"),
    status: document.getElementById("formStatus"),
    cancelBtn: document.getElementById("cancelEditBtn"),
  };

  const state = {
    view: "week",
    weekStart: startOfWeek(new Date()),
    activeDayIndex: 0,
    isNarrow: false,
    monthCursor: startOfMonth(new Date()),
    monthSelectedKey: dateKey(new Date()),
    editingId: null,
    lastFocusEl: null,
    dayEls: new Map(), // dateKey -> { allDayCell, eventsLayer }
    slotHeightPx: 34,
  };

  function safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function getRaw(key, fallback) {
    if (Storage) return Storage.getRaw(key, fallback);
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : raw;
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

  function dispatchCalendarChanged() {
    try {
      window.dispatchEvent(new CustomEvent("study:calendar-changed"));
    } catch {}
  }

  function createId(prefix = "evt") {
    try {
      if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    } catch {}
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function dateKey(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function parseDateKey(key) {
    const [y, m, d] = String(key || "")
      .split("-")
      .map((v) => parseInt(v, 10));
    if (!y || !m || !d) return null;
    const out = new Date(y, m - 1, d);
    if (Number.isNaN(out.getTime())) return null;
    out.setHours(12, 0, 0, 0);
    return out;
  }

  function startOfWeek(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const weekday = (d.getDay() + 6) % 7; // Monday=0
    d.setDate(d.getDate() - weekday);
    d.setHours(12, 0, 0, 0);
    return d;
  }

  function startOfMonth(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), 1);
    d.setHours(12, 0, 0, 0);
    return d;
  }

  function addDays(date, delta) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    return d;
  }

  function addMonths(date, delta) {
    const d = new Date(date.getFullYear(), date.getMonth() + delta, 1);
    d.setHours(12, 0, 0, 0);
    return d;
  }

  function isSameDay(a, b) {
    return (
      a &&
      b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function formatWeekRangeLabel(weekStartDate) {
    const start = new Date(weekStartDate);
    const end = addDays(start, WORK_DAYS - 1);
    const fmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  }

  function formatMonthLabel(weekStartDate) {
    const start = new Date(weekStartDate);
    const end = addDays(start, WORK_DAYS - 1);
    const startLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(start);
    const endLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(end);
    if (startLabel === endLabel) return startLabel;
    const startMonth = new Intl.DateTimeFormat("en", { month: "short" }).format(start);
    const endMonth = new Intl.DateTimeFormat("en", { month: "short" }).format(end);
    const year = new Intl.DateTimeFormat("en", { year: "numeric" }).format(end);
    return `${startMonth} – ${endMonth} ${year}`;
  }

  function formatDisplayMonth(date) {
    return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
  }

  function parseTimeToMinutes(timeStr) {
    const raw = String(timeStr || "").trim();
    if (!raw) return null;
    const m = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return hh * 60 + mm;
  }

  function minutesToTime(mins) {
    const m = Math.max(0, Math.floor(mins));
    const hh = Math.floor(m / 60) % 24;
    const mm = m % 60;
    return `${pad2(hh)}:${pad2(mm)}`;
  }

  function defaultDurationMinutes(evt) {
    const type = String(evt?.type || "");
    if (type === "study") return 50;
    if (type === "reminder") return 15;
    if (type === "exam") return 90;
    return 30;
  }

  function toneForEvent(evt) {
    const type = String(evt?.type || "deadline");
    if (type === "study") return "study";
    if (type === "reminder") return "reminder";
    if (type === "exam") return "exam";
    return "deadline";
  }

  function readSlotHeightPx() {
    const raw = getComputedStyle(document.body).getPropertyValue("--ws-slot-height").trim();
    const m = raw.match(/([\d.]+)px/);
    state.slotHeightPx = m ? Number(m[1]) : 34;
  }

  function slotCount() {
    return Math.max(1, Math.floor(((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES));
  }

  function loadEvents() {
    const raw = getRaw(STORAGE_KEY, "");
    const parsed = raw ? safeJsonParse(raw) : null;
    const list = Array.isArray(parsed) ? parsed : [];
    let changed = false;
    list.forEach((evt) => {
      if (!evt || typeof evt !== "object") return;
      if (!evt.id) {
        evt.id = "evt_legacy_" + createId("legacy");
        changed = true;
      }
      if (typeof evt.done !== "boolean") {
        evt.done = !!evt.done;
        changed = true;
      }
      if (typeof evt.time !== "string") {
        evt.time = String(evt.time || "");
        changed = true;
      }
    });
    if (changed) {
      setJSON(STORAGE_KEY, list, { debounceMs: 0 });
      dispatchCalendarChanged();
    }
    return list;
  }

  function saveEvents(list) {
    setJSON(STORAGE_KEY, Array.isArray(list) ? list : [], { debounceMs: 0 });
    dispatchCalendarChanged();
  }

  function closePlanMenu() {
    if (!els.planPopover || !els.planBtn) return;
    if (els.planPopover.hidden) return;
    els.planPopover.hidden = true;
    els.planBtn.setAttribute("aria-expanded", "false");
  }

  function isImportantPriority(priority) {
    const p = String(priority || "normal");
    return p === "important" || p === "critical";
  }

  function shouldShowInMonth(evt) {
    if (!evt || typeof evt !== "object") return false;
    if (!evt.date) return false;
    if (evt.done) return false;
    const type = String(evt.type || "deadline");
    const origin = String(evt.origin || "");
    if (type === "study" || origin === "autoplan") return false;
    if (type === "exam" || type === "reminder") return true;
    if (isImportantPriority(evt.priority)) return true;
    return Boolean(String(evt.time || "").trim());
  }

  function applyViewUI() {
    const isMonth = state.view === "month";
    if (els.weekView) els.weekView.hidden = isMonth;
    if (els.monthView) els.monthView.hidden = !isMonth;
    if (els.dayStrip) els.dayStrip.hidden = isMonth;

    document.body.classList.toggle("ws-view-month", isMonth);
    document.body.classList.toggle("ws-view-week", !isMonth);

    const applyToggle = (btn, on) => {
      if (!btn) return;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.className = on ? "chip-btn chip-btn-primary" : "chip-btn";
    };
    applyToggle(els.viewWeekBtn, !isMonth);
    applyToggle(els.viewMonthBtn, isMonth);
  }

  function setView(nextView) {
    const view = nextView === "month" ? "month" : "week";
    if (view === state.view) return;
    state.view = view;

    if (view === "month") {
      const weekDays = currentWeekDays();
      const base = weekDays[state.activeDayIndex] || new Date();
      state.monthSelectedKey = dateKey(base);
      state.monthCursor = startOfMonth(base);
    } else {
      const base = parseDateKey(state.monthSelectedKey) || new Date();
      state.weekStart = startOfWeek(base);
      const weekDays = currentWeekDays();
      const idx = weekDays.findIndex((d) => isSameDay(d, base));
      state.activeDayIndex = idx !== -1 ? idx : 0;
      clampActiveDayIndex();
    }

    closePlanMenu();
    applyViewUI();
    render();
  }

  function setMonthCursor(nextMonth) {
    state.monthCursor = startOfMonth(nextMonth);
    render();
  }

  function openPlanMenu() {
    if (!els.planPopover || !els.planBtn) return;
    els.planPopover.hidden = false;
    els.planBtn.setAttribute("aria-expanded", "true");
  }

  function togglePlanMenu() {
    if (!els.planPopover || !els.planBtn) return;
    if (els.planPopover.hidden) openPlanMenu();
    else closePlanMenu();
  }

  function setSidebarOpen(open) {
    const next = !!open;
    document.body.classList.toggle("ws-sidebar-open", next);
    if (els.sidebarBackdrop) els.sidebarBackdrop.hidden = !next;
  }

  function openModal({ date, evt } = {}) {
    if (!els.modal || !els.form) return;
    state.lastFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.editingId = evt && evt.id ? String(evt.id) : null;

    if (els.status) els.status.textContent = "";

    const isEdit = !!state.editingId;
    if (els.modalTitle) els.modalTitle.textContent = isEdit ? "Edit task" : "Add task";
    if (els.deleteBtn) els.deleteBtn.hidden = !isEdit;
    if (els.doneInput) els.doneInput.checked = !!(evt && evt.done);

    const dateObj = typeof date === "string" ? parseDateKey(date) : date instanceof Date ? date : null;
    const dayKey = dateObj ? dateKey(dateObj) : evt?.date || dateKey(new Date());

    if (els.dateInput) els.dateInput.value = dayKey;
    if (els.titleInput) els.titleInput.value = String(evt?.title || "");
    if (els.typeSelect) els.typeSelect.value = String(evt?.type || "deadline");
    if (els.prioritySelect) els.prioritySelect.value = String(evt?.priority || "normal");
    if (els.notesInput) els.notesInput.value = String(evt?.notes || "");

    const startVal = evt && evt.time ? String(evt.time) : "";
    const endVal = (() => {
      if (!evt) return "";
      if (evt.endTime) return String(evt.endTime);
      const startMin = parseTimeToMinutes(evt.time);
      if (startMin == null) return "";
      const dur = Number(evt.durationMinutes) || defaultDurationMinutes(evt);
      return minutesToTime(startMin + Math.max(5, dur));
    })();

    if (els.startInput) els.startInput.value = startVal;
    if (els.endInput) els.endInput.value = startVal ? endVal : "";
    if (els.endInput) els.endInput.disabled = !startVal;

    if (els.modalDateLabel && dateObj) {
      els.modalDateLabel.textContent = new Intl.DateTimeFormat("en", {
        weekday: "long",
        month: "short",
        day: "numeric",
      }).format(dateObj);
    } else if (els.modalDateLabel) {
      const parsed = parseDateKey(dayKey);
      els.modalDateLabel.textContent = parsed
        ? new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric" }).format(parsed)
        : "Selected date";
    }

    els.modal.classList.add("is-open");
    els.modal.setAttribute("aria-hidden", "false");
    setSidebarOpen(false);

    requestAnimationFrame(() => {
      els.titleInput?.focus();
    });
  }

  function closeModal({ restoreFocus = true } = {}) {
    if (!els.modal || !els.modal.classList.contains("is-open")) return;
    els.modal.classList.remove("is-open");
    els.modal.setAttribute("aria-hidden", "true");
    state.editingId = null;
    if (els.form) els.form.reset();
    if (els.deleteBtn) els.deleteBtn.hidden = true;
    if (els.endInput) els.endInput.disabled = false;
    if (restoreFocus && state.lastFocusEl) {
      try {
        state.lastFocusEl.focus();
      } catch {}
    }
    state.lastFocusEl = null;
  }

  function setFormStatus(message, tone = "muted") {
    if (!els.status) return;
    els.status.textContent = message || "";
    els.status.dataset.tone = tone;
  }

  function upsertEvent(next) {
    const list = loadEvents();
    const id = next && next.id ? String(next.id) : "";
    if (!id) return { ok: false };
    const idx = list.findIndex((e) => e && e.id === id);
    if (idx === -1) list.push(next);
    else list[idx] = { ...list[idx], ...next };
    saveEvents(list);
    return { ok: true };
  }

  function removeEvent(id) {
    const list = loadEvents();
    const before = list.length;
    const next = list.filter((e) => !(e && e.id === id));
    if (next.length === before) return false;
    saveEvents(next);
    return true;
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    const title = String(els.titleInput?.value || "").trim();
    const date = String(els.dateInput?.value || "").trim();
    const start = String(els.startInput?.value || "").trim();
    const end = String(els.endInput?.value || "").trim();
    const type = String(els.typeSelect?.value || "deadline");
    const priority = String(els.prioritySelect?.value || "normal");
    const notes = String(els.notesInput?.value || "").trim();
    const done = !!els.doneInput?.checked;

    if (!title) {
      setFormStatus("Title is required.", "error");
      els.titleInput?.focus();
      return;
    }
    if (!date) {
      setFormStatus("Date is required.", "error");
      els.dateInput?.focus();
      return;
    }

    let cleanStart = "";
    let durationMinutes = 0;
    let endTime = "";

    if (start || end) {
      const startMin = parseTimeToMinutes(start);
      if (startMin == null) {
        setFormStatus("Start time is invalid.", "error");
        els.startInput?.focus();
        return;
      }
      const endMin = parseTimeToMinutes(end);
      if (endMin == null) {
        setFormStatus("End time is required for timed events.", "error");
        els.endInput?.focus();
        return;
      }
      if (endMin <= startMin) {
        setFormStatus("End time must be after start time.", "error");
        els.endInput?.focus();
        return;
      }
      cleanStart = minutesToTime(startMin);
      endTime = minutesToTime(endMin);
      durationMinutes = Math.max(5, endMin - startMin);
    }

    const isEditing = !!state.editingId;
    const id = state.editingId || "evt_" + createId("evt");
    const payload = {
      id,
      title,
      date,
      time: cleanStart,
      type,
      priority,
      notes,
      done,
    };
    if (!isEditing) payload.source = "weekly";

    if (cleanStart) {
      payload.durationMinutes = durationMinutes;
      payload.endTime = endTime;
    } else {
      payload.durationMinutes = undefined;
      payload.endTime = undefined;
    }

    const result = upsertEvent(payload);
    if (!result.ok) {
      setFormStatus("Could not save event.", "error");
      return;
    }
    closeModal();
    render();
  }

  function handleDelete() {
    if (!state.editingId) return;
    if (!confirm("Delete this task?")) return;
    removeEvent(state.editingId);
    closeModal();
    render();
  }

  function handleStartInputChanged() {
    const start = String(els.startInput?.value || "").trim();
    if (!els.endInput) return;
    if (!start) {
      els.endInput.value = "";
      els.endInput.disabled = true;
      return;
    }
    els.endInput.disabled = false;
    if (els.endInput.value) return;
    const startMin = parseTimeToMinutes(start);
    if (startMin == null) return;
    const type = String(els.typeSelect?.value || "deadline");
    const dur = defaultDurationMinutes({ type });
    els.endInput.value = minutesToTime(startMin + dur);
  }

  function currentWeekDays() {
    const days = [];
    for (let i = 0; i < WORK_DAYS; i++) days.push(addDays(state.weekStart, i));
    return days;
  }

  function clampActiveDayIndex() {
    state.activeDayIndex = Math.max(0, Math.min(WORK_DAYS - 1, state.activeDayIndex || 0));
  }

  function setWeekStart(nextStart) {
    state.weekStart = startOfWeek(nextStart);
    const today = new Date();
    const days = currentWeekDays();
    const idx = days.findIndex((d) => isSameDay(d, today));
    if (idx !== -1) state.activeDayIndex = idx;
    clampActiveDayIndex();
    render();
  }

  function setActiveDayIndex(nextIndex) {
    state.activeDayIndex = Math.max(0, Math.min(WORK_DAYS - 1, Number(nextIndex) || 0));
    render();
  }

  function renderDayStrip(days) {
    if (!els.dayStrip) return;
    els.dayStrip.replaceChildren();
    days.forEach((d, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ws-day-tab";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", idx === state.activeDayIndex ? "true" : "false");
      btn.textContent = `${d.toLocaleString("en", { weekday: "short" })} ${d.getDate()}`;
      btn.addEventListener("click", () => setActiveDayIndex(idx));
      els.dayStrip.appendChild(btn);
    });
  }

  function buildGrid({ visibleDays, allWeekDays }) {
    if (!els.grid || !els.gridHead) return;
    state.dayEls.clear();

    const slots = slotCount();
    els.grid.style.setProperty("--ws-grid-height", `calc(${slots} * var(--ws-slot-height))`);
    document.body.style.setProperty("--ws-day-count", String(visibleDays.length));

    const makeGutter = (extraClass = "", text = "") => {
      const div = document.createElement("div");
      div.className = `ws-gutter${extraClass ? ` ${extraClass}` : ""}`;
      div.textContent = text;
      return div;
    };

    els.gridHead.replaceChildren();

    els.gridHead.appendChild(makeGutter("", ""));
    visibleDays.forEach((d) => {
      const key = dateKey(d);
      const head = document.createElement("div");
      head.className = "ws-day-head";
      head.dataset.date = key;
      head.addEventListener("click", () => openModal({ date: key }));

      const top = document.createElement("div");
      top.className = "ws-day-head-top";
      const name = document.createElement("div");
      name.className = "ws-day-name";
      name.textContent = d.toLocaleString("en", { weekday: "short" });
      const num = document.createElement("div");
      num.className = "ws-day-num";
      num.textContent = String(d.getDate());
      top.appendChild(name);

      const today = new Date();
      if (isSameDay(d, today)) {
        const dot = document.createElement("span");
        dot.className = "ws-day-dot";
        dot.setAttribute("aria-hidden", "true");
        top.appendChild(dot);
      }

      head.appendChild(top);
      head.appendChild(num);
      els.gridHead.appendChild(head);
    });

    els.gridHead.appendChild(makeGutter("ws-all-day-label", "All-day"));
    visibleDays.forEach((d) => {
      const key = dateKey(d);
      const cell = document.createElement("div");
      cell.className = "ws-all-day-cell";
      cell.dataset.date = key;
      els.gridHead.appendChild(cell);
      state.dayEls.set(key, { allDayCell: cell, eventsLayer: null });
    });

    els.grid.replaceChildren();

    const timeCol = document.createElement("div");
    timeCol.className = "ws-time-col";
    for (let i = 0; i < slots; i++) {
      const slot = document.createElement("div");
      slot.className = "ws-time-slot";
      if (i % 2 === 0) {
        const hour = START_HOUR + i / 2;
        slot.textContent = `${pad2(hour)}:00`;
      } else {
        slot.textContent = "";
      }
      timeCol.appendChild(slot);
    }
    els.grid.appendChild(timeCol);

    visibleDays.forEach((d) => {
      const key = dateKey(d);
      const col = document.createElement("div");
      col.className = "ws-day-col";
      col.dataset.date = key;

      const layer = document.createElement("div");
      layer.className = "ws-events-layer";
      col.appendChild(layer);

      els.grid.appendChild(col);

      const existing = state.dayEls.get(key) || { allDayCell: null, eventsLayer: null };
      state.dayEls.set(key, { ...existing, eventsLayer: layer });
    });

    // Keep strip buttons consistent even when rendering a single day.
    renderDayStrip(allWeekDays);
  }

  function renderHeader() {
    if (state.view === "month") {
      if (els.weekRangeLabel) els.weekRangeLabel.textContent = "Important (no study blocks)";
      if (els.monthLabel) els.monthLabel.textContent = formatDisplayMonth(state.monthCursor);
      return;
    }
    if (els.weekRangeLabel) els.weekRangeLabel.textContent = formatWeekRangeLabel(state.weekStart);
    if (els.monthLabel) els.monthLabel.textContent = formatMonthLabel(state.weekStart);
  }

  function renderMonthGrid() {
    if (!els.monthGrid) return;
    els.monthGrid.replaceChildren();

    const cursor = startOfMonth(state.monthCursor || new Date());
    const today = new Date();

    const weekdayMon0 = (d) => (d.getDay() + 6) % 7;
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    first.setHours(12, 0, 0, 0);
    const startOffset = weekdayMon0(first);
    const gridStart = addDays(first, -startOffset);

    const events = loadEvents().filter(shouldShowInMonth);
    const byDate = new Map();
    events.forEach((evt) => {
      const key = String(evt.date || "");
      if (!key) return;
      const list = byDate.get(key) || [];
      list.push(evt);
      byDate.set(key, list);
    });

    const priorityRank = (priority) => {
      const p = String(priority || "normal");
      if (p === "critical") return 0;
      if (p === "important") return 1;
      return 2;
    };

    for (const [key, list] of byDate.entries()) {
      list.sort((a, b) => {
        const pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr) return pr;
        const typeA = String(a.type || "");
        const typeB = String(b.type || "");
        if (typeA !== typeB) return typeA.localeCompare(typeB);
        const timeA = a.time || "24:00";
        const timeB = b.time || "24:00";
        if (timeA !== timeB) return timeA.localeCompare(timeB);
        return String(a.title || "").localeCompare(String(b.title || ""));
      });
    }

    for (let i = 0; i < 42; i++) {
      const day = addDays(gridStart, i);
      const key = dateKey(day);

      const cell = document.createElement("div");
      cell.className = "ws-month-cell";
      cell.dataset.date = key;
      cell.setAttribute("role", "gridcell");
      cell.tabIndex = 0;
      if (day.getMonth() !== cursor.getMonth()) cell.classList.add("is-outside");
      if (isSameDay(day, today)) cell.classList.add("is-today");

      const head = document.createElement("div");
      head.className = "ws-month-day";
      const num = document.createElement("div");
      num.className = "ws-month-day-num";
      num.textContent = String(day.getDate());
      head.appendChild(num);
      cell.appendChild(head);

      const eventsWrap = document.createElement("div");
      eventsWrap.className = "ws-month-events";
      cell.appendChild(eventsWrap);

      const dayEvents = byDate.get(key) || [];
      const limit = 2;
      dayEvents.slice(0, limit).forEach((evt) => {
        const btn = document.createElement("button");
        btn.type = "button";
        const tone = toneForEvent(evt);
        btn.className = `ws-month-event ws-month-event--${tone}${isImportantPriority(evt.priority) ? " is-important" : ""}`;
        const title = String(evt.title || "Untitled");
        const time = String(evt.time || "").trim();
        btn.textContent = time ? `${time} ${title}` : title;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          state.monthSelectedKey = key;
          openModal({ date: key, evt });
        });
        eventsWrap.appendChild(btn);
      });

      if (dayEvents.length > limit) {
        const more = document.createElement("div");
        more.className = "ws-month-more";
        more.textContent = `+${dayEvents.length - limit} more`;
        eventsWrap.appendChild(more);
      }

      const openForDay = () => {
        state.monthSelectedKey = key;
        openModal({ date: key });
      };

      cell.addEventListener("click", openForDay);
      cell.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        openForDay();
      });

      els.monthGrid.appendChild(cell);
    }
  }

  function renderEventsForVisibleDays(visibleDays) {
    const startMinBoundary = START_HOUR * 60;
    const endMinBoundary = END_HOUR * 60;
    const pxPerMinute = state.slotHeightPx / SLOT_MINUTES;

    const events = loadEvents();
    const visibleSet = new Set(visibleDays.map((d) => dateKey(d)));

    for (const [key, refs] of state.dayEls.entries()) {
      refs.allDayCell?.replaceChildren();
      refs.eventsLayer?.replaceChildren();
    }

    events.forEach((evt) => {
      if (!evt || typeof evt !== "object") return;
      const key = String(evt.date || "");
      if (!key || !visibleSet.has(key)) return;

      const refs = state.dayEls.get(key);
      if (!refs) return;

      const tone = toneForEvent(evt);
      const title = String(evt.title || "Untitled");

      const startMin = parseTimeToMinutes(evt.time);
      if (startMin == null) {
        if (!refs.allDayCell) return;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `ws-all-day-event ws-all-day-event--${tone}`;
        chip.textContent = title;
        chip.dataset.eventId = String(evt.id || "");
        chip.setAttribute("aria-label", `${title} (all-day)`);
        chip.addEventListener("click", () => openModal({ date: key, evt }));
        refs.allDayCell.appendChild(chip);
        return;
      }

      let dur = Number(evt.durationMinutes) || 0;
      if (!dur) {
        const endFromField = parseTimeToMinutes(evt.endTime);
        if (endFromField != null && endFromField > startMin) dur = endFromField - startMin;
        else dur = defaultDurationMinutes(evt);
      }
      const endMin = startMin + Math.max(5, dur);

      const visibleStart = Math.max(startMinBoundary, startMin);
      const visibleEnd = Math.min(endMinBoundary, endMin);
      if (visibleEnd <= visibleStart) return;

      const topPx = Math.max(0, (visibleStart - startMinBoundary) * pxPerMinute);
      const heightPx = Math.max(28, (visibleEnd - visibleStart) * pxPerMinute);

      if (!refs.eventsLayer) return;
      const card = document.createElement("button");
      card.type = "button";
      card.className = `ws-event ws-event--${tone}`;
      card.style.top = `${topPx}px`;
      card.style.height = `${heightPx}px`;
      card.dataset.eventId = String(evt.id || "");
      if (evt.done) card.setAttribute("aria-disabled", "true");

      const timeLabel = `${minutesToTime(startMin)} – ${minutesToTime(endMin)}`;
      card.setAttribute("aria-label", `${title} · ${timeLabel}`);
      card.addEventListener("click", () => openModal({ date: key, evt }));

      const t = document.createElement("div");
      t.className = "ws-event-title";
      t.textContent = title;
      const meta = document.createElement("div");
      meta.className = "ws-event-time";
      meta.textContent = timeLabel;

      card.appendChild(t);
      card.appendChild(meta);

      refs.eventsLayer.appendChild(card);
    });
  }

  function renderReviewToday() {
    if (!els.reviewList) return;
    const engine = window.StudyPlanner && window.StudyPlanner.ReviewEngine ? window.StudyPlanner.ReviewEngine : null;
    els.reviewList.replaceChildren();
    if (!engine || typeof engine.getQueue !== "function") {
      const empty = document.createElement("div");
      empty.className = "calendar-empty";
      empty.textContent = "Review queue unavailable.";
      els.reviewList.appendChild(empty);
      return;
    }
    const items = engine.getQueue({ limit: 5 }) || [];
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "calendar-empty";
      empty.textContent = "Nothing due right now.";
      els.reviewList.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "calendar-upcoming-row";
      const chip = document.createElement("span");
      chip.className = "calendar-chip calendar-chip-more";
      chip.textContent =
        item.kind === "exam_item" ? "Exam" : item.kind === "assignment" ? "Assignment" : "File";

      const title = document.createElement("div");
      title.className = "calendar-upcoming-title";
      title.textContent = item.title || "Review";

      const meta = document.createElement("div");
      meta.className = "calendar-upcoming-meta";
      if (item.kind === "file") meta.textContent = `${Math.round(item.confidence || 0)}% conf · ~${item.estMinutes || 25} min`;
      else if (item.kind === "exam_item") meta.textContent = `${item.daysLeft}d left · ~${item.estMinutes || 20} min`;
      else if (item.kind === "assignment") meta.textContent = `${item.daysLeft}d left · ~${item.estMinutes || 30} min`;
      else meta.textContent = "";

      const actions = document.createElement("div");
      actions.className = "assignments-row-actions";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-btn chip-btn-primary";
      btn.textContent = item.kind === "file" ? "Study" : "Open";
      btn.addEventListener("click", () => {
        if (item.kind === "exam_item") {
          try {
            window.dispatchEvent(
              new CustomEvent("study:open-exam-mode", {
                detail: { examId: item.examId, itemId: item.itemId },
              })
            );
          } catch {}
          return;
        }
        const action = engine.actionFor ? engine.actionFor(item) : null;
        if (action && action.type === "navigate" && action.href) window.location.href = action.href;
      });
      actions.appendChild(btn);

      row.appendChild(chip);
      row.appendChild(title);
      row.appendChild(meta);
      row.appendChild(actions);
      els.reviewList.appendChild(row);
    });
  }

  function updateLayoutMode() {
    const next = window.matchMedia ? window.matchMedia(NARROW_MQ).matches : window.innerWidth <= 960;
    if (next === state.isNarrow) return;
    state.isNarrow = next;
    render();
  }

  function render() {
    readSlotHeightPx();
    applyViewUI();
    renderHeader();

    if (state.view === "month") {
      renderMonthGrid();
      return;
    }

    if (!els.grid || !els.gridHead || !els.gridScroll) return;

    const scrollTop = els.gridScroll.scrollTop;
    const scrollLeft = els.gridScroll.scrollLeft;

    const weekDays = currentWeekDays();
    const visibleDays = state.isNarrow ? [weekDays[state.activeDayIndex]] : weekDays;

    buildGrid({ visibleDays, allWeekDays: weekDays });
    renderEventsForVisibleDays(visibleDays);

    requestAnimationFrame(() => {
      els.gridScroll.scrollTop = scrollTop;
      els.gridScroll.scrollLeft = scrollLeft;
    });
  }

  function bind() {
    const today = new Date();
    const weekDays = currentWeekDays();
    const idx = weekDays.findIndex((d) => isSameDay(d, today));
    state.activeDayIndex = idx !== -1 ? idx : 0;
    clampActiveDayIndex();

    if (els.prevWeekBtn) {
      els.prevWeekBtn.addEventListener("click", () => {
        if (state.view === "month") return setMonthCursor(addMonths(state.monthCursor, -1));
        setWeekStart(addDays(state.weekStart, -7));
      });
    }
    if (els.nextWeekBtn) {
      els.nextWeekBtn.addEventListener("click", () => {
        if (state.view === "month") return setMonthCursor(addMonths(state.monthCursor, 1));
        setWeekStart(addDays(state.weekStart, 7));
      });
    }
    if (els.todayBtn) {
      els.todayBtn.addEventListener("click", () => {
        if (state.view === "month") {
          const now = new Date();
          state.monthSelectedKey = dateKey(now);
          return setMonthCursor(startOfMonth(now));
        }
        setWeekStart(new Date());
      });
    }

    if (els.addTaskBtn) {
      els.addTaskBtn.addEventListener("click", () => {
        if (state.view === "month") {
          const key = state.monthSelectedKey || dateKey(new Date());
          openModal({ date: key });
          return;
        }
        const days = currentWeekDays();
        const day = state.isNarrow ? days[state.activeDayIndex] : new Date();
        openModal({ date: dateKey(day) });
      });
    }

    if (els.viewWeekBtn) {
      els.viewWeekBtn.addEventListener("click", () => setView("week"));
    }
    if (els.viewMonthBtn) {
      els.viewMonthBtn.addEventListener("click", () => setView("month"));
    }

    if (els.sidebarToggle) {
      els.sidebarToggle.addEventListener("click", () => setSidebarOpen(true));
    }
    if (els.sidebarBackdrop) {
      els.sidebarBackdrop.addEventListener("click", () => setSidebarOpen(false));
    }

    if (els.planBtn) {
      els.planBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePlanMenu();
      });
    }
    if (els.planAddTaskBtn) {
      els.planAddTaskBtn.addEventListener("click", () => {
        closePlanMenu();
        openModal({ date: dateKey(new Date()) });
      });
    }
    if (els.planAddAssignmentBtn) {
      els.planAddAssignmentBtn.addEventListener("click", () => {
        closePlanMenu();
        const btn = document.getElementById("assignmentsAddBtn");
        if (btn) btn.click();
      });
    }
    if (els.planAutoPlanBtn) {
      els.planAutoPlanBtn.addEventListener("click", () => {
        closePlanMenu();
        const btn = document.getElementById("autoPlanWeekBtn");
        if (btn) btn.click();
      });
    }

    document.addEventListener("click", (event) => {
      if (!els.planPopover || els.planPopover.hidden) return;
      const inside = event.target && event.target.closest ? event.target.closest(".ws-plan") : null;
      if (inside) return;
      closePlanMenu();
    });

    if (els.modalBackdrop) {
      els.modalBackdrop.addEventListener("click", (e) => {
        if (e.target === els.modalBackdrop) closeModal();
      });
    }
    els.closeModalBtn?.addEventListener("click", () => closeModal());
    els.cancelBtn?.addEventListener("click", () => closeModal());

    els.todayModalBtn?.addEventListener("click", () => {
      const now = new Date();
      const key = dateKey(now);
      if (els.dateInput) els.dateInput.value = key;
      if (els.modalDateLabel) {
        els.modalDateLabel.textContent = new Intl.DateTimeFormat("en", {
          weekday: "long",
          month: "short",
          day: "numeric",
        }).format(now);
      }
    });

    els.form?.addEventListener("submit", handleFormSubmit);
    els.deleteBtn?.addEventListener("click", handleDelete);
    els.startInput?.addEventListener("change", handleStartInputChanged);
    els.typeSelect?.addEventListener("change", handleStartInputChanged);

    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (els.modal && els.modal.classList.contains("is-open")) {
        event.preventDefault();
        closeModal();
        return;
      }
      if (document.body.classList.contains("ws-sidebar-open")) {
        event.preventDefault();
        setSidebarOpen(false);
        return;
      }
      if (els.planPopover && !els.planPopover.hidden) {
        event.preventDefault();
        closePlanMenu();
      }
    });

    window.addEventListener("resize", () => {
      state.isNarrow = window.matchMedia ? window.matchMedia(NARROW_MQ).matches : window.innerWidth <= 960;
      readSlotHeightPx();
      render();
    });

    if (window.matchMedia) {
      const mq = window.matchMedia(NARROW_MQ);
      if (mq && typeof mq.addEventListener === "function") mq.addEventListener("change", updateLayoutMode);
      else if (mq && typeof mq.addListener === "function") mq.addListener(updateLayoutMode);
    }

    window.addEventListener("study:calendar-changed", () => render());
    window.addEventListener("study:sessions-updated", () => renderReviewToday());
    window.addEventListener("study:assignments-changed", () => renderReviewToday());
    window.addEventListener("study:state-replaced", () => {
      render();
      renderReviewToday();
    });

    window.addEventListener("storage", (e) => {
      if (!e || !e.key || e.key === STORAGE_KEY) render();
    });

    updateLayoutMode();
    render();
    renderReviewToday();
  }

  bind();
})();
