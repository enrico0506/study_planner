(() => {
  const StudyPlanner = window.StudyPlanner || (window.StudyPlanner = {});
  const Storage = StudyPlanner.Storage || null;

  const STORAGE_KEY = "studyCalendarEvents_v1";
  const NARROW_MQ = "(max-width: 960px)";
  const TABLET_TOUCH_MQ =
    "(min-width: 900px) and (any-pointer: coarse), (min-width: 900px) and (hover: none) and (pointer: coarse)";
  const TWO_PANE_MQ =
    "(min-width: 900px) and (max-width: 1400px) and (any-pointer: coarse), " +
    "(min-width: 900px) and (max-width: 1400px) and (hover: none) and (pointer: coarse)";
  const WORK_DAYS = 5; // Monday–Friday

  const DEFAULT_START_HOUR = 9;
  const DEFAULT_END_HOUR = 20;
  const CORE_START_HOUR = 7;
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
    scrollToStartBtn: document.getElementById("wsScrollToStartBtn"),
    scrollToEndBtn: document.getElementById("wsScrollToEndBtn"),
    scrollToStartBtn: document.getElementById("wsScrollToStartBtn"),
    scrollToEndBtn: document.getElementById("wsScrollToEndBtn"),
    weekendToggleBtn: document.getElementById("wsWeekendToggleBtn"),

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
	    categoryInput: document.getElementById("eventCategoryInput"),
	    colorInput: document.getElementById("eventColorInput"),
	    timezoneInput: document.getElementById("eventTimezoneInput"),
	    locationInput: document.getElementById("eventLocationInput"),
	    reminderSelect: document.getElementById("eventReminderSelect"),
	    recurrenceSelect: document.getElementById("eventRecurrenceSelect"),
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
    pickerView: "month", // two-pane date picker: "month" | "week"
    weekendShifted: false,
    userScrolled: false,
    monthCursor: startOfMonth(new Date()),
    monthSelectedKey: dateKey(new Date()),
    editingId: null,
    lastFocusEl: null,
    dayEls: new Map(), // dateKey -> { allDayCell, eventsLayer }
    slotHeightPx: 34,
  };

  const drag = {
    active: false,
    dayKey: null,
    startMin: 0,
    currentMin: 0,
    layer: null,
    node: null,
    pointerId: null,
  };

  function isTwoPaneLayoutActive() {
    return Boolean(document.body && document.body.classList.contains("ipad-two-pane"));
  }

  function applyTwoPaneClass() {
    if (!document.body || !window.matchMedia) return false;
    const next = window.matchMedia(TWO_PANE_MQ).matches;
    document.body.classList.toggle("ipad-two-pane", next);
    if (next) {
      state.view = "week";
      if (state.pickerView !== "week") state.pickerView = "month";
    }
    return next;
  }

  function watchTwoPaneClass() {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(TWO_PANE_MQ);
    const handler = () => {
      const before = isTwoPaneLayoutActive();
      const after = applyTwoPaneClass();
      if (before === after) return;
      state.userScrolled = false;
      updateLayoutMode();
      applyViewUI();
      render();
    };
    try {
      mq.addEventListener("change", handler);
    } catch {
      mq.addListener(handler);
    }
  }

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

  function weekdayMon0(date) {
    return (date.getDay() + 6) % 7; // Monday=0
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

  const DEFAULT_TYPE_COLORS = {
    event: "#34d399",
    deadline: "#a78bfa",
    exam: "#fb7185",
    study: "#60a5fa",
    reminder: "#fbbf24",
  };

  function defaultColorForType(type) {
    return DEFAULT_TYPE_COLORS[type] || DEFAULT_TYPE_COLORS.deadline;
  }

  function normalizeHexColor(raw) {
    const m = String(raw || "")
      .trim()
      .match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (!m) return "";
    let hex = m[1];
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    return `#${hex.toLowerCase()}`;
  }

  function currentTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }

  function dayHourRange() {
    if (isTabletTouchLayout()) return { start: 0, end: 24 };
    return { start: DEFAULT_START_HOUR, end: DEFAULT_END_HOUR };
  }

  function scrollGridToHour(hour, behavior = "smooth") {
    if (!els.gridScroll) return;
    const { start, end } = dayHourRange();
    const clampedHour = Math.min(end, Math.max(start, hour));
    const minutesFromStart = (clampedHour - start) * 60;
    const slotsFromStart = minutesFromStart / SLOT_MINUTES;
    const targetPx = Math.max(0, slotsFromStart * state.slotHeightPx);
    try {
      els.gridScroll.scrollTo({ top: targetPx, behavior });
    } catch {
      els.gridScroll.scrollTop = targetPx;
    }
  }

  function clampToDayMinutes(min) {
    const { start, end } = dayHourRange();
    const minBound = start * 60;
    const maxBound = end * 60;
    return Math.min(maxBound, Math.max(minBound, min));
  }

  function snapToSlotMinutes(min) {
    return Math.round(min / SLOT_MINUTES) * SLOT_MINUTES;
  }

  function defaultDurationMinutes(evt) {
    const type = String(evt?.type || "");
    if (type === "study") return 50;
    if (type === "reminder") return 15;
    if (type === "exam") return 90;
    return 30;
  }

  function toneForEvent(evt) {
    const type = String(evt?.type || "event");
    if (type === "event") return "event";
    if (type === "study") return "study";
    if (type === "reminder") return "reminder";
    if (type === "exam") return "exam";
    return "deadline";
  }

  function applyCustomColor(el, color) {
    const clean = normalizeHexColor(color);
    if (!el || !clean) return;
    el.classList.add("ws-event--custom");
    el.style.setProperty("--ws-custom-color", clean);
  }

  function readSlotHeightPx() {
    const raw = getComputedStyle(document.body).getPropertyValue("--ws-slot-height").trim();
    const m = raw.match(/([\d.]+)px/);
    state.slotHeightPx = m ? Number(m[1]) : 34;
  }

  function slotCount() {
    const { start, end } = dayHourRange();
    return Math.max(1, Math.floor(((end - start) * 60) / SLOT_MINUTES));
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
    const type = String(evt.type || "event");
    const origin = String(evt.origin || "");
    if (type === "study" || origin === "autoplan") return false;
    if (type === "exam" || type === "reminder" || type === "event") return true;
    if (isImportantPriority(evt.priority)) return true;
    return Boolean(String(evt.time || "").trim());
  }

  function applyViewUI() {
    const twoPane = isTwoPaneLayoutActive();
    const isMonth = state.view === "month";
    const applyToggle = (btn, on) => {
      if (!btn) return;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.className = on ? "chip-btn chip-btn-primary" : "chip-btn";
    };

    if (twoPane) {
      if (els.weekView) els.weekView.hidden = false;
      if (els.monthView) els.monthView.hidden = false;
      if (els.dayStrip) els.dayStrip.hidden = true;

      document.body.classList.remove("ws-view-month");
      document.body.classList.add("ws-view-week");

      applyToggle(els.viewWeekBtn, state.pickerView === "week");
      applyToggle(els.viewMonthBtn, state.pickerView !== "week");
      return;
    }

    if (els.weekView) els.weekView.hidden = isMonth;
    if (els.monthView) els.monthView.hidden = !isMonth;
    if (els.dayStrip) els.dayStrip.hidden = isMonth;

    document.body.classList.toggle("ws-view-month", isMonth);
    document.body.classList.toggle("ws-view-week", !isMonth);

    applyToggle(els.viewWeekBtn, !isMonth);
    applyToggle(els.viewMonthBtn, isMonth);
  }

  function setView(nextView) {
    const view = nextView === "month" ? "month" : "week";
    if (view === "month" && isTwoPaneLayoutActive()) return;
    if (view === state.view) return;
    state.view = view;
    state.userScrolled = false;

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

  function setPickerView(nextView) {
    const view = nextView === "week" ? "week" : "month";
    if (!isTwoPaneLayoutActive()) return;
    if (view === state.pickerView) return;
    state.pickerView = view;
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

  function openModal({ date, evt, timeRange } = {}) {
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

    const typeVal = String(evt?.type || "event");
    const priorityVal = String(evt?.priority || "normal");
    const categoryVal = String(evt?.category || "");
    const locationVal = String(evt?.location || "");
    const reminderVal = String(evt?.reminder || "none");
    const recurrenceVal = String(evt?.recurrence || "none");
    const timeZoneVal = String(evt?.timeZone || evt?.timezone || currentTimeZone() || "");

    if (els.typeSelect) els.typeSelect.value = typeVal;
    if (els.prioritySelect) els.prioritySelect.value = priorityVal;
    if (els.categoryInput) els.categoryInput.value = categoryVal;
    if (els.locationInput) els.locationInput.value = locationVal;
    if (els.reminderSelect) els.reminderSelect.value = reminderVal;
    if (els.recurrenceSelect) els.recurrenceSelect.value = recurrenceVal;
    if (els.timezoneInput) els.timezoneInput.value = timeZoneVal;

    const defaultToneColor = defaultColorForType(typeVal);
    const incomingColor = normalizeHexColor(evt?.color);
    const colorVal = incomingColor || defaultToneColor;
    if (els.colorInput) {
      els.colorInput.value = colorVal;
      els.colorInput.dataset.autoColor = incomingColor && incomingColor !== defaultToneColor ? "" : colorVal;
    }

    let startVal = evt && evt.time ? String(evt.time) : "";
    let endVal = (() => {
      if (!evt) return "";
      if (evt.endTime) return String(evt.endTime);
      const startMin = parseTimeToMinutes(evt.time);
      if (startMin == null) return "";
      const dur = Number(evt.durationMinutes) || defaultDurationMinutes(evt);
      return minutesToTime(startMin + Math.max(5, dur));
    })();

    if (!isEdit && timeRange) {
      if (typeof timeRange.startMinutes === "number") startVal = minutesToTime(clampToDayMinutes(timeRange.startMinutes));
      if (typeof timeRange.endMinutes === "number") endVal = minutesToTime(clampToDayMinutes(timeRange.endMinutes));
    }

    if (startVal && !endVal) {
      const startMin = parseTimeToMinutes(startVal);
      if (startMin != null) endVal = minutesToTime(startMin + defaultDurationMinutes({ type: typeVal }));
    }

    if (els.startInput) els.startInput.value = startVal;
    if (els.endInput) {
      els.endInput.value = startVal ? endVal : "";
      els.endInput.disabled = !startVal;
    }

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
    const type = String(els.typeSelect?.value || "event");
    const priority = String(els.prioritySelect?.value || "normal");
    const done = !!els.doneInput?.checked;
    const category = String(els.categoryInput?.value || "").trim();
    const location = String(els.locationInput?.value || "").trim();
    const reminderRaw = String(els.reminderSelect?.value || "none");
    const recurrenceRaw = String(els.recurrenceSelect?.value || "none");
    const color = normalizeHexColor(els.colorInput?.value || "") || defaultColorForType(type);
    const timeZoneInput = String(els.timezoneInput?.value || "").trim();
    const timeZone = timeZoneInput || currentTimeZone();

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

    const validReminders = new Set(["none", "5m", "15m", "30m", "60m", "1d"]);
    const reminder = validReminders.has(reminderRaw) ? reminderRaw : "none";
    const validRecurrence = new Set(["none", "daily", "weekly", "weekdays", "monthly"]);
    const recurrence = validRecurrence.has(recurrenceRaw) ? recurrenceRaw : "none";

    const isEditing = !!state.editingId;
    const id = state.editingId || "evt_" + createId("evt");
    const payload = {
      id,
      title,
      date,
      time: cleanStart,
      type,
      priority,
      done,
      category,
      color,
      location,
      reminder,
      recurrence,
      timeZone,
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
    const type = String(els.typeSelect?.value || "event");
    const dur = defaultDurationMinutes({ type });
    els.endInput.value = minutesToTime(startMin + dur);
  }

  function handleTypeChanged() {
    handleStartInputChanged();
    const typeVal = String(els.typeSelect?.value || "event");
    if (!els.colorInput) return;
    const currentColor = normalizeHexColor(els.colorInput.value || "");
    const autoColor = normalizeHexColor(els.colorInput.dataset?.autoColor || "");
    const defaultColor = defaultColorForType(typeVal);
    if (!currentColor || (autoColor && currentColor === autoColor)) {
      els.colorInput.value = defaultColor;
      els.colorInput.dataset.autoColor = defaultColor;
    }
  }

  function handleColorManuallyChanged() {
    if (els.colorInput) els.colorInput.dataset.autoColor = "";
  }

  function isTabletTouchLayout() {
    return window.matchMedia && window.matchMedia(TABLET_TOUCH_MQ).matches;
  }

  function visibleWeekStart() {
    const offset = state.weekendShifted ? 2 : 0;
    return addDays(state.weekStart, offset);
  }

  function currentWeekDays() {
    const days = [];
    const start = visibleWeekStart();
    for (let i = 0; i < WORK_DAYS; i++) days.push(addDays(start, i));
    return days;
  }

  function clampActiveDayIndex() {
    state.activeDayIndex = Math.max(0, Math.min(WORK_DAYS - 1, state.activeDayIndex || 0));
  }

  function syncSelectedDayFromActiveIndex() {
    const days = currentWeekDays();
    const day = days[state.activeDayIndex];
    if (!day) return;
    state.monthSelectedKey = dateKey(day);
    state.monthCursor = startOfMonth(day);
  }

  function applyDayKeySelection(key) {
    const date = parseDateKey(key);
    if (!date) return false;

    state.monthSelectedKey = key;
    state.monthCursor = startOfMonth(date);
    state.weekStart = startOfWeek(date);

    const weekday = weekdayMon0(date);
    state.weekendShifted = weekday >= 5;
    const offset = state.weekendShifted ? 2 : 0;
    state.activeDayIndex = weekday - offset;
    clampActiveDayIndex();
    return true;
  }

  function selectDayKey(key) {
    if (!applyDayKeySelection(key)) return;
    state.userScrolled = false;
    render();
  }

  function setWeekStart(nextStart) {
    state.weekStart = startOfWeek(nextStart);
    const today = new Date();
    const days = currentWeekDays();
    const idx = days.findIndex((d) => isSameDay(d, today));
    if (idx !== -1) state.activeDayIndex = idx;
    clampActiveDayIndex();
    state.userScrolled = false;
    syncSelectedDayFromActiveIndex();
    render();
  }

  function setActiveDayIndex(nextIndex) {
    state.activeDayIndex = Math.max(0, Math.min(WORK_DAYS - 1, Number(nextIndex) || 0));
    syncSelectedDayFromActiveIndex();
    state.userScrolled = false;
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
        const { start } = dayHourRange();
        const hour = start + i / 2;
        slot.textContent = `${pad2(hour % 24)}:00`;
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
    renderDayStrip(visibleDays);
  }

  function renderHeader() {
    if (state.view === "month" && !isTwoPaneLayoutActive()) {
      if (els.weekRangeLabel) els.weekRangeLabel.textContent = "Important (no study blocks)";
      if (els.monthLabel) els.monthLabel.textContent = formatDisplayMonth(state.monthCursor);
      return;
    }
    const start = visibleWeekStart();
    if (els.weekRangeLabel) els.weekRangeLabel.textContent = formatWeekRangeLabel(start);
    if (els.monthLabel) els.monthLabel.textContent = formatMonthLabel(start);
  }

  function renderMonthGrid() {
    if (!els.monthGrid) return;
    els.monthGrid.replaceChildren();
    els.monthGrid.classList.remove("ws-month-grid--week");

    const cursor = startOfMonth(state.monthCursor || new Date());
    const today = new Date();

    const weekdayMon0 = (d) => (d.getDay() + 6) % 7;
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    first.setHours(12, 0, 0, 0);
    const startOffset = weekdayMon0(first);
    const daysInCurrentMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const weeksNeeded = Math.max(4, Math.ceil((startOffset + daysInCurrentMonth) / 7));
    const totalCells = weeksNeeded * 7;

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

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startOffset + 1;

      if (dayNum < 1 || dayNum > daysInCurrentMonth) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "ws-month-cell ws-month-cell--empty";
        emptyCell.setAttribute("role", "presentation");
        emptyCell.setAttribute("aria-hidden", "true");
        els.monthGrid.appendChild(emptyCell);
        continue;
      }

      const day = new Date(cursor.getFullYear(), cursor.getMonth(), dayNum);
      day.setHours(12, 0, 0, 0);
      const key = dateKey(day);

      const cell = document.createElement("div");
      cell.className = "ws-month-cell";
      cell.dataset.date = key;
      cell.setAttribute("role", "gridcell");
      cell.tabIndex = 0;
      if (key === state.monthSelectedKey) cell.classList.add("is-selected");
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
          if (isTwoPaneLayoutActive()) selectDayKey(key);
          else state.monthSelectedKey = key;
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
        if (isTwoPaneLayoutActive()) {
          selectDayKey(key);
          return;
        }
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

  function renderWeekPicker() {
    if (!els.monthGrid) return;
    els.monthGrid.replaceChildren();
    els.monthGrid.classList.add("ws-month-grid--week");

    const base = parseDateKey(state.monthSelectedKey) || new Date();
    const start = startOfWeek(base);
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      const key = dateKey(day);

      const cell = document.createElement("div");
      cell.className = "ws-month-cell ws-month-cell--week";
      cell.dataset.date = key;
      cell.setAttribute("role", "gridcell");
      cell.tabIndex = 0;
      if (key === state.monthSelectedKey) cell.classList.add("is-selected");
      if (isSameDay(day, today)) cell.classList.add("is-today");

      const head = document.createElement("div");
      head.className = "ws-month-day";
      const num = document.createElement("div");
      num.className = "ws-month-day-num";
      num.textContent = String(day.getDate());
      head.appendChild(num);
      cell.appendChild(head);

      const openForDay = () => {
        if (isTwoPaneLayoutActive()) {
          selectDayKey(key);
          return;
        }
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
    const { start, end } = dayHourRange();
    const startMinBoundary = start * 60;
    const endMinBoundary = end * 60;
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
      const customColor = normalizeHexColor(evt.color);
      const location = String(evt.location || "").trim();
      const timeZoneLabel = String(evt.timeZone || evt.timezone || "").trim();

      const startMin = parseTimeToMinutes(evt.time);
      if (startMin == null) {
        if (!refs.allDayCell) return;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `ws-all-day-event ws-all-day-event--${tone}`;
        chip.textContent = title;
        chip.dataset.eventId = String(evt.id || "");
        const allDayLabelParts = [`${title} (all-day)`];
        if (location) allDayLabelParts.push(location);
        if (timeZoneLabel) allDayLabelParts.push(timeZoneLabel);
        chip.setAttribute("aria-label", allDayLabelParts.join(" · "));
        chip.addEventListener("click", () => openModal({ date: key, evt }));
        applyCustomColor(chip, customColor);
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
      applyCustomColor(card, customColor);

      const timeLabel = `${minutesToTime(startMin)} – ${minutesToTime(endMin)}`;
      const compactTimeLabel = `${minutesToTime(startMin)}–${minutesToTime(endMin)}`;
      const compactThresholdPx = state.slotHeightPx * 1.7;
      const microThresholdPx = state.slotHeightPx * 1.05;
      const locationThresholdPx = state.slotHeightPx * 2.3;
      const isCompact = heightPx < compactThresholdPx;
      const isMicro = heightPx < microThresholdPx;
      if (isCompact) card.classList.add("ws-event--compact");
      if (isMicro) card.classList.add("ws-event--micro");
      const ariaParts = [title, timeLabel];
      if (location) ariaParts.push(location);
      if (timeZoneLabel) ariaParts.push(timeZoneLabel);
      card.setAttribute("aria-label", ariaParts.join(" · "));
      card.addEventListener("click", () => openModal({ date: key, evt }));

      const t = document.createElement("div");
      t.className = "ws-event-title";
      t.textContent = isCompact ? `${compactTimeLabel} ${title}` : title;
      card.appendChild(t);
      if (!isCompact) {
        const meta = document.createElement("div");
        meta.className = "ws-event-time";
        meta.textContent = timeLabel;
        card.appendChild(meta);
      }
      if (location && !isCompact && heightPx >= locationThresholdPx) {
        const loc = document.createElement("div");
        loc.className = "ws-event-time ws-event-location";
        loc.textContent = location;
        card.appendChild(loc);
      }

      refs.eventsLayer.appendChild(card);
    });
  }

  function clearDragSelection() {
    if (drag.node && drag.node.parentElement) drag.node.parentElement.removeChild(drag.node);
    drag.active = false;
    drag.dayKey = null;
    drag.startMin = 0;
    drag.currentMin = 0;
    drag.layer = null;
    drag.node = null;
    drag.pointerId = null;
    window.removeEventListener("pointermove", handleGridPointerMove);
    window.removeEventListener("pointerup", handleGridPointerUp);
    window.removeEventListener("pointercancel", handleGridPointerUp);
  }

  function ensureDragNode(layer) {
    if (!layer) return null;
    if (drag.node && drag.node.parentElement !== layer) {
      drag.node.remove();
      drag.node = null;
    }
    if (!drag.node) {
      const el = document.createElement("div");
      el.className = "ws-drag-selection";
      const label = document.createElement("span");
      label.className = "ws-drag-selection-label";
      el.appendChild(label);
      layer.prepend(el);
      drag.node = el;
    }
    return drag.node;
  }

  function positionMinutesFromPointer(event, layer, { clampStart = false } = {}) {
    if (!layer) {
      const { start } = dayHourRange();
      return start * 60;
    }
    const rect = layer.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const pxPerMinute = state.slotHeightPx / SLOT_MINUTES;
    const minutesFromStart = y / pxPerMinute;
    const { start, end } = dayHourRange();
    const raw = start * 60 + minutesFromStart;
    const minBound = start * 60;
    const maxBound = clampStart ? Math.max(minBound, end * 60 - SLOT_MINUTES) : end * 60;
    const clamped = Math.min(maxBound, Math.max(minBound, raw));
    const snapped = snapToSlotMinutes(clamped);
    return Math.min(maxBound, Math.max(minBound, snapped));
  }

  function updateDragSelection() {
    if (!drag.active || !drag.layer || !drag.node) return;
    const from = clampToDayMinutes(Math.min(drag.startMin, drag.currentMin));
    let to = clampToDayMinutes(Math.max(drag.startMin, drag.currentMin));
    if (to - from < SLOT_MINUTES) to = clampToDayMinutes(from + SLOT_MINUTES);
    const pxPerMinute = state.slotHeightPx / SLOT_MINUTES;
    const { start } = dayHourRange();
    const topPx = Math.max(0, (from - start * 60) * pxPerMinute);
    const heightPx = Math.max(state.slotHeightPx * 0.6, (to - from) * pxPerMinute);
    drag.node.style.top = `${topPx}px`;
    drag.node.style.height = `${heightPx}px`;
    const label = drag.node.querySelector(".ws-drag-selection-label");
    if (label) label.textContent = `${minutesToTime(from)} – ${minutesToTime(to)}`;
  }

  function handleGridPointerMove(event) {
    if (!drag.active) return;
    if (drag.pointerId != null && drag.pointerId !== event.pointerId) return;
    drag.currentMin = positionMinutesFromPointer(event, drag.layer);
    updateDragSelection();
  }

  function handleGridPointerUp(event) {
    if (!drag.active) return;
    if (drag.pointerId != null && drag.pointerId !== event.pointerId) return;
    const dayKey = drag.dayKey;
    const start = clampToDayMinutes(Math.min(drag.startMin, drag.currentMin));
    let end = clampToDayMinutes(Math.max(drag.startMin, drag.currentMin));
    if (end - start < SLOT_MINUTES) end = clampToDayMinutes(start + SLOT_MINUTES);
    clearDragSelection();
    if (!dayKey) return;
    openModal({ date: dayKey, timeRange: { startMinutes: start, endMinutes: end } });
  }

  function handleGridPointerDown(event) {
    if (state.view !== "week") return;
    if (event.button !== 0 || !event.isPrimary) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest(".ws-event") || target.closest(".ws-all-day-cell")) return;
    const col = target.closest(".ws-day-col");
    if (!col || !col.dataset.date) return;
    const refs = state.dayEls.get(col.dataset.date);
    if (!refs || !refs.eventsLayer) return;

    const isTouchLike = event.pointerType === "touch" || event.pointerType === "pen";
    const startX = event.clientX;
    const startY = event.clientY;
    const startMin = positionMinutesFromPointer(event, refs.eventsLayer, { clampStart: true });

    if (isTouchLike) {
      // Treat touch as a tap-to-add; ignore if the user scrolls.
      const tapThreshold = 12;
      const pointerId = event.pointerId;
      const cleanup = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
      };
      const onCancel = () => cleanup();
      const onMove = (ev) => {
        if (pointerId != null && ev.pointerId !== pointerId) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.hypot(dx, dy) > tapThreshold) cleanup();
      };
      const onUp = (ev) => {
        if (pointerId != null && ev.pointerId !== pointerId) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const movedTooFar = Math.hypot(dx, dy) > tapThreshold;
        cleanup();
        if (movedTooFar) return;
        const dur = defaultDurationMinutes({ type: "event" });
        const start = clampToDayMinutes(startMin);
        const end = clampToDayMinutes(start + dur);
        openModal({
          date: col.dataset.date,
          timeRange: { startMinutes: start, endMinutes: end },
        });
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
      window.addEventListener("pointercancel", onCancel, { once: true });
      return;
    }

    event.preventDefault();
    drag.active = true;
    drag.dayKey = col.dataset.date;
    drag.layer = refs.eventsLayer;
    drag.pointerId = event.pointerId;
    drag.startMin = startMin;
    drag.currentMin = drag.startMin;
    ensureDragNode(refs.eventsLayer);
    updateDragSelection();
    window.addEventListener("pointermove", handleGridPointerMove);
    window.addEventListener("pointerup", handleGridPointerUp);
    window.addEventListener("pointercancel", handleGridPointerUp);
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
    const next =
      isTwoPaneLayoutActive() ||
      (window.matchMedia ? window.matchMedia(NARROW_MQ).matches : window.innerWidth <= 960);
    if (next === state.isNarrow) return;
    state.isNarrow = next;
    render();
  }

  function render() {
    readSlotHeightPx();
    applyViewUI();
    renderHeader();

    if (drag.active || drag.node) clearDragSelection();

    const twoPane = isTwoPaneLayoutActive();

    if (twoPane) {
      if (state.pickerView === "week") renderWeekPicker();
      else renderMonthGrid();
    } else if (state.view === "month") {
      renderMonthGrid();
      return;
    }

    if (!els.grid || !els.gridHead || !els.gridScroll) return;

    const scrollTop = els.gridScroll.scrollTop;
    const scrollLeft = els.gridScroll.scrollLeft;

    const showWeekendToggle = !state.isNarrow && isTabletTouchLayout() && state.view === "week";
    if (els.weekendToggleBtn) {
      if (showWeekendToggle) {
        els.weekendToggleBtn.hidden = false;
        els.weekendToggleBtn.textContent = state.weekendShifted ? "Back to week" : "Show weekend";
        els.weekendToggleBtn.setAttribute("aria-pressed", state.weekendShifted ? "true" : "false");
      } else {
        state.weekendShifted = false;
        els.weekendToggleBtn.hidden = true;
        els.weekendToggleBtn.setAttribute("aria-pressed", "false");
        els.weekendToggleBtn.textContent = "Show weekend";
      }
    }

    const showScrollBtns = state.view === "week" && isTabletTouchLayout();
    if (els.scrollToStartBtn) els.scrollToStartBtn.hidden = !showScrollBtns;
    if (els.scrollToEndBtn) els.scrollToEndBtn.hidden = !showScrollBtns;

    const weekDays = currentWeekDays();
    const visibleDays = state.isNarrow ? [weekDays[state.activeDayIndex]] : weekDays;

  buildGrid({ visibleDays, allWeekDays: weekDays });
  renderEventsForVisibleDays(visibleDays);

  requestAnimationFrame(() => {
    els.gridScroll.scrollTop = scrollTop;
    els.gridScroll.scrollLeft = scrollLeft;

    if (!state.userScrolled && state.view === "week" && isTabletTouchLayout()) {
      scrollGridToHour(CORE_START_HOUR, "auto");
    }
  });
}

  function bind() {
    applyTwoPaneClass();
    watchTwoPaneClass();

    const today = new Date();
    if (isTwoPaneLayoutActive()) {
      applyDayKeySelection(state.monthSelectedKey || dateKey(today));
    } else {
      const weekDays = currentWeekDays();
      const idx = weekDays.findIndex((d) => isSameDay(d, today));
      state.activeDayIndex = idx !== -1 ? idx : 0;
      clampActiveDayIndex();
      syncSelectedDayFromActiveIndex();
    }

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

    if (els.weekendToggleBtn) {
      els.weekendToggleBtn.addEventListener("click", () => {
        if (state.view !== "week" || state.isNarrow || !isTabletTouchLayout()) return;
        state.weekendShifted = !state.weekendShifted;
        clampActiveDayIndex();
        render();
      });
    }

    if (els.scrollToStartBtn) {
      els.scrollToStartBtn.addEventListener("click", () => {
        scrollGridToHour(dayHourRange().start, "smooth");
        state.userScrolled = true;
      });
    }
    if (els.scrollToEndBtn) {
      els.scrollToEndBtn.addEventListener("click", () => {
        scrollGridToHour(dayHourRange().end - 0.05, "smooth");
        state.userScrolled = true;
      });
    }

    if (els.gridScroll && !els.gridScroll.dataset.boundScroll) {
      els.gridScroll.dataset.boundScroll = "true";
      els.gridScroll.addEventListener(
        "scroll",
        () => {
          state.userScrolled = true;
        },
        { passive: true }
      );
    }

    if (els.viewWeekBtn) {
      els.viewWeekBtn.addEventListener("click", () => {
        if (isTwoPaneLayoutActive()) return setPickerView("week");
        setView("week");
      });
    }
    if (els.viewMonthBtn) {
      els.viewMonthBtn.addEventListener("click", () => {
        if (isTwoPaneLayoutActive()) return setPickerView("month");
        setView("month");
      });
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
    els.typeSelect?.addEventListener("change", handleTypeChanged);
    els.colorInput?.addEventListener("input", handleColorManuallyChanged);
    els.grid?.addEventListener("pointerdown", handleGridPointerDown);

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
      state.isNarrow =
        isTwoPaneLayoutActive() ||
        (window.matchMedia ? window.matchMedia(NARROW_MQ).matches : window.innerWidth <= 960);
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
