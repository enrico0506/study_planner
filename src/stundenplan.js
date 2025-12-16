(() => {
  const SUBJECT_STORAGE_KEY = "studySubjects_v1";
  const TIMETABLE_KEY = "studyTimetable_v1";
  const TIMETABLE_WEEKEND_KEY = "studyTimetableIncludeWeekend_v1";
  const COLOR_PALETTE_KEY = "studyColorPalette_v1";
  const Storage = window.StudyPlanner && window.StudyPlanner.Storage ? window.StudyPlanner.Storage : null;
  const DEFAULT_SUBJECT_COLORS = [
    "#4f8bff",
    "#4ec58a",
    "#f77fb3",
    "#f6a23c",
    "#b18bff",
    "#37c6c0",
    "#f17575",
    "#f4c74f"
  ];

  const DAY_LABELS = [
    { value: 0, label: "Monday" },
    { value: 1, label: "Tuesday" },
    { value: 2, label: "Wednesday" },
    { value: 3, label: "Thursday" },
    { value: 4, label: "Friday" },
    { value: 5, label: "Saturday" },
    { value: 6, label: "Sunday" }
  ];
  let subjectColors = [...DEFAULT_SUBJECT_COLORS];
  const DEFAULT_START_MINUTES = 8 * 60;
  const DEFAULT_END_MINUTES = 20 * 60;

  // DOM references
  const timetableGrid = document.getElementById("timetableGrid");
  const subjectListEl = document.getElementById("timetableSubjectList");
  const lessonForm = document.getElementById("lessonForm");
  const lessonFormTitle = document.getElementById("lessonFormTitle");
  const lessonTitleInput = document.getElementById("lessonTitleInput");
  const lessonSubjectSelect = document.getElementById("lessonSubjectSelect");
  const lessonDaySelect = document.getElementById("lessonDaySelect");
  const lessonStartInput = document.getElementById("lessonStartInput");
  const lessonEndInput = document.getElementById("lessonEndInput");
  const lessonLocationInput = document.getElementById("lessonLocationInput");
  const lessonNotesInput = document.getElementById("lessonNotesInput");
  const lessonColorInput = document.getElementById("lessonColorInput");
  const lessonStatus = document.getElementById("lessonStatus");
  const lessonResetBtn = document.getElementById("lessonResetBtn");
  const lessonSubmitBtn = document.getElementById("lessonSubmitBtn");
  const openLessonModalBtn = document.getElementById("openLessonModalBtn");
  const lessonModal = document.getElementById("lessonModal");
  const lessonModalBackdrop = document.getElementById("lessonModalBackdrop");
  const lessonModalCloseBtn = document.getElementById("lessonModalCloseBtn");
  const copyTimetableBtn = document.getElementById("copyTimetableBtn");
  const timetableTabs = document.getElementById("timetableTabs");
  const newTimetableTabBtn = document.getElementById("newTimetableTabBtn");
  const tabMenu = document.getElementById("tabMenu");
  const tabMenuToggle = document.getElementById("tabMenuToggle");
  const tabMenuPanel = document.getElementById("tabMenuPanel");
  const ttPrevDayBtn = document.getElementById("ttPrevDayBtn");
  const ttNextDayBtn = document.getElementById("ttNextDayBtn");
  const ttDayLabel = document.getElementById("ttDayLabel");
  const toggleWeekendBtn = document.getElementById("toggleWeekendBtn");
  const ttNowBtn = document.getElementById("ttNowBtn");
  let subjects = [];
  let tables = [];
  let activeTableId = "";
  let editingId = null;
  let tabMenuTimer = null;
  let phoneDayIndex = null;
  let includeWeekend = true;

  function loadIncludeWeekend() {
    try {
      const raw = Storage ? Storage.getRaw(TIMETABLE_WEEKEND_KEY, null) : localStorage.getItem(TIMETABLE_WEEKEND_KEY);
      if (raw === null || raw === undefined || raw === "") return true;
      return raw === "1" || raw === "true";
    } catch {
      return true;
    }
  }

  function saveIncludeWeekend() {
    try {
      if (Storage) Storage.setRaw(TIMETABLE_WEEKEND_KEY, includeWeekend ? "1" : "0", { debounceMs: 0 });
      else localStorage.setItem(TIMETABLE_WEEKEND_KEY, includeWeekend ? "1" : "0");
    } catch {}
  }

  function getVisibleDays() {
    return includeWeekend ? DAY_LABELS : DAY_LABELS.slice(0, 5);
  }

  function updateWeekendToggleUi() {
    if (!toggleWeekendBtn) return;
    toggleWeekendBtn.textContent = includeWeekend ? "Hide weekend" : "Show weekend";
    toggleWeekendBtn.setAttribute("aria-pressed", includeWeekend ? "true" : "false");
  }

  function isPhoneLayout() {
    return window.matchMedia && window.matchMedia("(max-width: 1024px)").matches;
  }

  function getPhoneDayIndex() {
    if (phoneDayIndex === null) {
      const today = new Date().getDay(); // 0=Sun..6=Sat
      phoneDayIndex = today === 0 ? 6 : today - 1; // Monday-based
    }
    const maxIdx = getVisibleDays().length - 1;
    return Math.max(0, Math.min(maxIdx, phoneDayIndex));
  }

  function setPhoneDayIndex(nextIndex) {
    const maxIdx = getVisibleDays().length - 1;
    phoneDayIndex = Math.max(0, Math.min(maxIdx, Number(nextIndex) || 0));
    applyPhoneDayView();
  }

  function applyPhoneDayView() {
    if (!timetableGrid) return;
    const days = getVisibleDays();
    if (!isPhoneLayout()) {
      timetableGrid.style.removeProperty("--tt-day");
      if (ttDayLabel) ttDayLabel.textContent = "";
      if (ttPrevDayBtn) ttPrevDayBtn.disabled = false;
      if (ttNextDayBtn) ttNextDayBtn.disabled = false;
      return;
    }
    const idx = getPhoneDayIndex();
    timetableGrid.style.setProperty("--tt-day", String(idx));
    if (ttDayLabel) ttDayLabel.textContent = days[idx]?.label?.slice(0, 3) || String(idx + 1);
    if (ttPrevDayBtn) ttPrevDayBtn.disabled = idx <= 0;
    if (ttNextDayBtn) ttNextDayBtn.disabled = idx >= days.length - 1;
  }

  function createId(prefix = "ls_") {
    return prefix + Math.random().toString(36).slice(2, 9);
  }

  const timelineState = {
    minuteHeight: 1,
    startHour: 8,
    endHour: 20,
    days: [],
    wrap: null,
    cols: null,
    rail: null,
    hoverRowEl: null,
    nowLineEl: null,
    nowLabelEl: null,
    nowTimer: null
  };

  function loadColorPalette() {
    try {
      const raw = Storage ? Storage.getRaw(COLOR_PALETTE_KEY, null) : localStorage.getItem(COLOR_PALETTE_KEY);
      if (!raw) {
        subjectColors = [...DEFAULT_SUBJECT_COLORS];
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((c) => typeof c === "string" && c.trim().length)) {
        subjectColors = parsed;
      }
    } catch (e) {
      subjectColors = [...DEFAULT_SUBJECT_COLORS];
    }
  }

  loadColorPalette();
  includeWeekend = loadIncludeWeekend();
  updateWeekendToggleUi();

  function loadSubjects() {
    try {
      const raw = Storage ? Storage.getRaw(SUBJECT_STORAGE_KEY, null) : localStorage.getItem(SUBJECT_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function loadTimetableState() {
    const fallback = {
      tables: [
        {
          id: createId("tt_"),
          name: "Default timetable",
          lessons: []
        }
      ],
      activeTableId: ""
    };
    try {
      const raw = Storage ? Storage.getRaw(TIMETABLE_KEY, null) : localStorage.getItem(TIMETABLE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return {
          tables: [
            {
              id: createId("tt_"),
              name: "Default timetable",
              lessons: parsed
            }
          ],
          activeTableId: ""
        };
      }
      if (parsed && typeof parsed === "object") {
        const tables = Array.isArray(parsed.tables) ? parsed.tables : [];
        const activeTableId = parsed.activeTableId || "";
        if (!tables.length) {
          tables.push({
            id: createId("tt_"),
            name: "Default timetable",
            lessons: []
          });
        }
        tables.forEach((t, idx) => {
          if (!t.id) t.id = createId("tt_");
          if (!t.name) t.name = `Timetable ${idx + 1}`;
          if (!Array.isArray(t.lessons)) t.lessons = [];
        });
        return { tables, activeTableId };
      }
      return fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveTimetableState() {
    try {
      if (Storage) Storage.setJSON(TIMETABLE_KEY, { tables, activeTableId }, { debounceMs: 150 });
      else localStorage.setItem(TIMETABLE_KEY, JSON.stringify({ tables, activeTableId }));
    } catch (e) {}
  }

  function getSubjectColorById(id) {
    const idx = subjects.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    if (!Array.isArray(subjectColors) || !subjectColors.length) {
      subjectColors = [...DEFAULT_SUBJECT_COLORS];
    }
    return subjectColors[idx % subjectColors.length];
  }

  function getSubjectName(lesson) {
    const subj = subjects.find((s) => s.id === lesson.subjectId);
    return (subj && subj.name) || lesson.subjectName || "";
  }

  function getLessonColor(lesson) {
    if (lesson.subjectId) {
      const color = getSubjectColorById(lesson.subjectId);
      if (color) return color;
    }
    return lesson.color || "#4b5563";
  }

  function blendWithWhite(hex, ratio = 0.7) {
    if (typeof hex !== "string" || !/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(hex)) {
      return "#e5e7eb";
    }
    let r, g, b;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    const mix = (channel) => Math.round(channel + (255 - channel) * ratio);
    return `#${mix(r).toString(16).padStart(2, "0")}${mix(g)
      .toString(16)
      .padStart(2, "0")}${mix(b).toString(16).padStart(2, "0")}`;
  }

  function ensureActiveTable() {
    if (!tables.length) {
      tables.push({
        id: createId("tt_"),
        name: "Default timetable",
        lessons: []
      });
    }
    if (!activeTableId || !tables.some((t) => t.id === activeTableId)) {
      activeTableId = tables[0].id;
    }
  }

  function getActiveTable() {
    ensureActiveTable();
    return tables.find((t) => t.id === activeTableId) || tables[0];
  }

  function cloneLessons(list) {
    return (list || []).map((l) => ({ ...l }));
  }

  function getBaseLessonsRef(tableId = activeTableId) {
    const table = tables.find((t) => t.id === tableId) || getActiveTable();
    if (!Array.isArray(table.lessons)) table.lessons = [];
    return table.lessons;
  }

  function getWorkingLessons() {
    return getBaseLessonsRef();
  }

  function addNewTimetable() {
    const name = prompt("Name for the new timetable?", "New timetable");
    if (!name) return;
    const table = {
      id: createId("tt_"),
      name: name.trim(),
      lessons: []
    };
    tables.push(table);
    activeTableId = table.id;
    renderTimetableTabs();
    renderTimetable();
    saveTimetableState();
  }

  function renderTimetableTabs() {
    if (!timetableTabs) return;
    timetableTabs.innerHTML = "";
    ensureActiveTable();
    tables.forEach((table, idx) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "timetable-tab" + (table.id === activeTableId ? " timetable-tab-active" : "");
      const label = document.createElement("span");
      label.className = "timetable-tab-label";
      label.textContent = table.name || `Timetable ${idx + 1}`;
      const close = document.createElement("button");
      close.type = "button";
      close.className = "timetable-tab-close";
      close.textContent = "×";
      close.title = "Delete timetable";
      close.disabled = tables.length <= 1;
      close.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteTimetable(table.id);
      });
      tab.addEventListener("click", () => setActiveTable(table.id));
      tab.appendChild(label);
      tab.appendChild(close);
      timetableTabs.appendChild(tab);
    });
  }

  function setActiveTable(id) {
    if (tables.some((t) => t.id === id)) {
      activeTableId = id;
    }
    ensureActiveTable();
    renderTimetableTabs();
    renderTimetable();
    saveTimetableState();
  }

  function duplicateActiveTimetable() {
    const base = getActiveTable();
    const name = prompt("Name for the duplicated timetable?", `${base.name || "Timetable"} copy`);
    if (!name) return;
    const copy = {
      id: createId("tt_"),
      name: name.trim(),
      lessons: cloneLessons(base.lessons)
    };
    tables.push(copy);
    activeTableId = copy.id;
    renderTimetableTabs();
    renderTimetable();
    saveTimetableState();
  }

  function openTabMenu() {
    if (tabMenuTimer) {
      clearTimeout(tabMenuTimer);
      tabMenuTimer = null;
    }
    tabMenu?.classList.add("tab-menu-open");
    tabMenuToggle?.setAttribute("aria-expanded", "true");
  }

  function closeTabMenu() {
    if (tabMenuTimer) {
      clearTimeout(tabMenuTimer);
      tabMenuTimer = null;
    }
    tabMenu?.classList.remove("tab-menu-open");
    tabMenuToggle?.setAttribute("aria-expanded", "false");
  }

  function scheduleCloseTabMenu() {
    if (tabMenuTimer) clearTimeout(tabMenuTimer);
    tabMenuTimer = setTimeout(closeTabMenu, 1200);
  }

  function deleteTimetable(tableId) {
    if (tables.length <= 1) {
      alert("You need at least one timetable.");
      return;
    }
    tables = tables.filter((t) => t.id !== tableId);
    ensureActiveTable();
    if (!tables.some((t) => t.id === activeTableId)) {
      activeTableId = tables[0].id;
    }
    renderTimetableTabs();
    renderTimetable();
    saveTimetableState();
  }

  function copyLessonToAnotherTable(lesson) {
    if (!tables.length) return;
    const options = tables.filter((t) => t.id !== activeTableId);
    if (!options.length) {
      alert("Create another timetable first to copy lessons into.");
      return;
    }
    const names = options.map((t, idx) => `${idx + 1}. ${t.name || "Timetable"}`);
    const choice = prompt(
      "Copy to which timetable?\n" + names.join("\n"),
      "1"
    );
    const idx = Number(choice) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= options.length) return;
    const target = options[idx];
    const targetLessons = getBaseLessonsRef(target.id);
    targetLessons.push({ ...lesson, id: createId() });
    saveTimetableState();
    setStatus(`Copied to "${target.name}".`, "success");
    alert(`Copied to "${target.name}".`);
  }

  function timeToMinutes(value) {
    if (!value || typeof value !== "string") return null;
    const parts = value.split(":");
    if (parts.length < 2) return null;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  function minutesToTime(totalMinutes) {
    const safe = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function snapMinutes(totalMinutes, step = 15) {
    const m = Math.max(0, Math.min(24 * 60 - 1, Number(totalMinutes) || 0));
    return Math.round(m / step) * step;
  }

  function yToMinutes(y) {
    const mh = Number(timelineState.minuteHeight) || 1;
    const minutesFromTop = Math.max(0, y / mh);
    return timelineState.startHour * 60 + minutesFromTop;
  }

  function minutesToY(minutes) {
    const mh = Number(timelineState.minuteHeight) || 1;
    return (minutes - timelineState.startHour * 60) * mh;
  }

  function getTodayIndex(days) {
    const today = new Date().getDay(); // 0=Sun..6=Sat
    const mondayBased = today === 0 ? 6 : today - 1;
    return (days || []).findIndex((d) => Number(d.value) === Number(mondayBased));
  }

  function ensureHoverRow() {
    if (!timelineState.cols) return;
    if (timelineState.hoverRowEl && timelineState.cols.contains(timelineState.hoverRowEl)) return;
    const el = document.createElement("div");
    el.className = "tt-hover-row";
    timelineState.hoverRowEl = el;
    timelineState.cols.appendChild(el);
  }

  function clearHover() {
    timelineState.cols?.querySelectorAll(".timeline-day.tt-hover-col").forEach((el) => {
      el.classList.remove("tt-hover-col");
    });
    if (timelineState.hoverRowEl) timelineState.hoverRowEl.classList.remove("is-visible");
  }

  function ensureNowIndicators() {
    if (!timelineState.cols || !timelineState.rail) return;
    const hasLine = timelineState.nowLineEl && timelineState.cols.contains(timelineState.nowLineEl);
    const hasLabel = timelineState.nowLabelEl && timelineState.rail.contains(timelineState.nowLabelEl);
    if (hasLine && hasLabel) return;
    const line = document.createElement("div");
    line.className = "tt-now-line";
    const label = document.createElement("div");
    label.className = "tt-now-label";
    label.textContent = "Now";
    timelineState.nowLineEl = line;
    timelineState.nowLabelEl = label;
    timelineState.cols.appendChild(line);
    timelineState.rail.appendChild(label);
  }

  function updateNowIndicators() {
    const line = timelineState.nowLineEl;
    const label = timelineState.nowLabelEl;
    if (!line || !label) return;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const y = minutesToY(minutes);
    if (!Number.isFinite(y)) return;
    line.style.top = `${y}px`;
    label.style.top = `${y}px`;
  }

  function startNowTimer() {
    if (timelineState.nowTimer) clearInterval(timelineState.nowTimer);
    timelineState.nowTimer = setInterval(() => updateNowIndicators(), 60 * 1000);
    updateNowIndicators();
  }

  function stopNowTimer() {
    if (!timelineState.nowTimer) return;
    clearInterval(timelineState.nowTimer);
    timelineState.nowTimer = null;
  }

  function scrollToNow() {
    if (!timetableGrid) return;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const y = minutesToY(minutes);
    if (!Number.isFinite(y)) return;
    timetableGrid.scrollTop = Math.max(0, y - 140);
  }

  function overlaps(a, b) {
    if (!a || !b) return false;
    if (Number(a.day) !== Number(b.day)) return false;
    const as = timeToMinutes(a.start);
    const ae = timeToMinutes(a.end);
    const bs = timeToMinutes(b.start);
    const be = timeToMinutes(b.end);
    if (as === null || ae === null || bs === null || be === null) return false;
    return as < be && bs < ae;
  }

  function computeConflictIds(lessons) {
    const ids = new Set();
    const list = Array.isArray(lessons) ? lessons : [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (overlaps(list[i], list[j])) {
          if (list[i]?.id) ids.add(list[i].id);
          if (list[j]?.id) ids.add(list[j].id);
        }
      }
    }
    return ids;
  }

  function wouldOverlap(candidate, ignoreId = null) {
    const working = getWorkingLessons();
    return working.some((l) => l && l.id !== ignoreId && overlaps(l, candidate));
  }

  function addMinutesToTime(timeStr, minutesToAdd) {
    const base = timeToMinutes(timeStr);
    if (base === null) return "";
    return minutesToTime(base + minutesToAdd);
  }

  function buildTimeSlots() {
    const lessons = getWorkingLessons();
    let earliest = DEFAULT_START_MINUTES;
    let latest = DEFAULT_END_MINUTES;

    lessons.forEach((lesson) => {
      const s = timeToMinutes(lesson.start);
      const e = timeToMinutes(lesson.end);
      if (s !== null) earliest = Math.min(earliest, Math.floor(s / 60) * 60);
      if (e !== null) latest = Math.max(latest, Math.ceil(e / 60) * 60);
    });

    if (latest <= earliest) {
      latest = earliest + 3 * 60;
    }

    const slots = [];
    for (let t = earliest; t <= latest; t += 60) {
      slots.push(minutesToTime(t));
    }

    if (slots.length < 2) {
      slots.push(minutesToTime(earliest + 60));
    }

    return slots;
  }

  function nearestHalfHour() {
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    let rounded = Math.ceil(current / 30) * 30;
    const max = 23 * 60 + 30;
    if (rounded > max) rounded = max;
    return minutesToTime(rounded);
  }

  function formatTimeRange(start, end) {
    if (!start && !end) return "Time not set";
    if (!start) return `Ends ${end}`;
    if (!end) return `Starts ${start}`;
    return `${start} - ${end}`;
  }

  function formatHourLabel(timeStr) {
    if (!timeStr) return "";
    const mins = timeToMinutes(timeStr);
    if (mins === null) return timeStr;
    const hour = Math.floor(mins / 60);
    return String(hour);
  }

  function findSlotIndex(timeStr, slots, mode = "start") {
    const minutes = timeToMinutes(timeStr);
    if (minutes === null) return null;
    const slotMinutes = slots
      .map((s) => timeToMinutes(s))
      .filter((v) => v !== null);
    if (!slotMinutes.length) return null;

    if (mode === "end") {
      for (let i = 0; i < slotMinutes.length; i++) {
        if (slotMinutes[i] >= minutes) return i;
      }
      return slotMinutes.length - 1;
    }

    let idx = 0;
    for (let i = 0; i < slotMinutes.length; i++) {
      if (slotMinutes[i] <= minutes) idx = i;
      else break;
    }
    return idx;
  }

  function setStatus(message, tone = "info") {
    if (!lessonStatus) return;
    lessonStatus.textContent = message || "";
    lessonStatus.dataset.tone = tone;
  }

  function clearStatus() {
    setStatus("");
  }

  function closeAllSlotMenus() {
    document.querySelectorAll(".timetable-slot-actions.slot-menu-open").forEach((el) => {
      el.classList.remove("slot-menu-open");
    });
  }

  function populateDayOptions() {
    if (!lessonDaySelect) return;
    lessonDaySelect.innerHTML = "";
    DAY_LABELS.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = String(d.value);
      opt.textContent = d.label;
      lessonDaySelect.appendChild(opt);
    });
    const today = new Date().getDay(); // 0 (Sun) - 6 (Sat)
    const mondayBased = today === 0 ? 6 : today - 1;
    const defaultDay = includeWeekend ? mondayBased : Math.min(4, mondayBased);
    lessonDaySelect.value = String(defaultDay);
  }

  function populateSubjectOptions() {
    if (!lessonSubjectSelect) return;
    lessonSubjectSelect.innerHTML = "";
    const base = document.createElement("option");
    base.value = "";
    base.textContent = "Custom lesson (no subject link)";
    lessonSubjectSelect.appendChild(base);
    subjects.forEach((subj, idx) => {
      const opt = document.createElement("option");
      opt.value = subj.id;
      opt.textContent = subj.name || `Subject ${idx + 1}`;
      lessonSubjectSelect.appendChild(opt);
    });
  }

  function renderSubjectList() {
    if (!subjectListEl) return;
    subjectListEl.innerHTML = "";
    if (!subjects.length) {
      const empty = document.createElement("div");
      empty.className = "timetable-empty";
      empty.textContent = "No subjects yet. Create some on the board to reuse their colors.";
      subjectListEl.appendChild(empty);
      return;
    }
    subjects.forEach((subj, idx) => {
      const chip = document.createElement("div");
      chip.className = "timetable-subject-chip";
      chip.style.setProperty("--chip-color", getSubjectColorById(subj.id) || "#4f46e5");
      const dot = document.createElement("span");
      dot.className = "timetable-chip-dot";
      chip.appendChild(dot);
      chip.appendChild(document.createTextNode(subj.name || "Subject"));
      subjectListEl.appendChild(chip);
    });
  }

  function resetForm(presetDay = null, presetStart = "", presetEnd = "") {
    editingId = null;
    if (lessonFormTitle) lessonFormTitle.textContent = "Add lesson";
    if (lessonSubmitBtn) lessonSubmitBtn.textContent = "Save lesson";
    lessonTitleInput && (lessonTitleInput.value = "");
    lessonSubjectSelect && (lessonSubjectSelect.value = "");
    if (lessonDaySelect) {
      lessonDaySelect.value =
        presetDay !== null ? String(presetDay) : lessonDaySelect.options[0]?.value || "0";
    }
    lessonStartInput && (lessonStartInput.value = presetStart || "");
    lessonEndInput && (lessonEndInput.value = presetEnd || "");
    lessonLocationInput && (lessonLocationInput.value = "");
    lessonNotesInput && (lessonNotesInput.value = "");
    lessonColorInput && (lessonColorInput.value = "#4f8bff");
    clearStatus();
    lessonTitleInput?.focus();
  }

  function fillForm(lesson) {
    editingId = lesson.id;
    if (lessonFormTitle) lessonFormTitle.textContent = "Edit lesson";
    if (lessonSubmitBtn) lessonSubmitBtn.textContent = "Update lesson";
    lessonTitleInput && (lessonTitleInput.value = lesson.title || "");
    lessonSubjectSelect &&
      (lessonSubjectSelect.value = lesson.subjectId ? lesson.subjectId : "");
    lessonDaySelect && (lessonDaySelect.value = String(lesson.day ?? 0));
    lessonStartInput && (lessonStartInput.value = lesson.start || "");
    lessonEndInput && (lessonEndInput.value = lesson.end || "");
    lessonLocationInput && (lessonLocationInput.value = lesson.location || "");
    lessonNotesInput && (lessonNotesInput.value = lesson.notes || "");
    lessonColorInput && (lessonColorInput.value = lesson.color || "#4f8bff");
    clearStatus();
    if (lessonModal) {
      lessonModal.classList.add("is-open");
      lessonModal.setAttribute("aria-hidden", "false");
    }
    lessonTitleInput?.focus();
  }

  function openLessonModal(presetDay = null, presetStart = "", presetEnd = "") {
    resetForm(presetDay, presetStart, presetEnd);
    if (lessonModal) {
      lessonModal.classList.add("is-open");
      lessonModal.setAttribute("aria-hidden", "false");
    }
    lessonTitleInput?.focus();
  }

  function closeLessonModal() {
    if (lessonModal) {
      lessonModal.classList.remove("is-open");
      lessonModal.setAttribute("aria-hidden", "true");
    }
  }

  function renderTimetable() {
    if (!timetableGrid) return;
    timetableGrid.innerHTML = "";
    const days = getVisibleDays();
    timetableGrid.style.setProperty("--tt-days", String(days.length));
    timelineState.days = days;

    const lessons = getWorkingLessons();
    const conflictIds = computeConflictIds(lessons);
    let minStart = Infinity;
    let maxEnd = -Infinity;

    lessons.forEach((lesson) => {
      const s = timeToMinutes(lesson.start);
      const e = timeToMinutes(lesson.end);
      if (s !== null) minStart = Math.min(minStart, s);
      if (e !== null) maxEnd = Math.max(maxEnd, e);
    });

    const startMin =
      minStart === Infinity
        ? DEFAULT_START_MINUTES
        : Math.min(DEFAULT_START_MINUTES, Math.floor(minStart / 60) * 60);
    let endMin =
      maxEnd === -Infinity
        ? DEFAULT_END_MINUTES
        : Math.max(DEFAULT_END_MINUTES, Math.ceil(maxEnd / 60) * 60);

    if (endMin <= startMin) {
      endMin = startMin + 3 * 60;
    }

    const minuteHeight = 1; // 60px per hour for a clean grid
    const startHour = Math.floor(startMin / 60);
    const endHour = Math.ceil(endMin / 60);
    const timelineHeight = Math.max((endHour * 60 - startHour * 60) * minuteHeight, 420);

    const wrap = document.createElement("div");
    wrap.className = "timeline-wrap";
    wrap.style.setProperty("--timeline-hour-height", 60 * minuteHeight + "px");
    wrap.style.gridTemplateRows = "auto 1fr";

    const railHeadCell = document.createElement("div");
    railHeadCell.className = "timeline-rail-head";
    railHeadCell.textContent = "Time";
    railHeadCell.style.gridColumn = "1";
    railHeadCell.style.gridRow = "1";

    const colsHead = document.createElement("div");
    colsHead.className = "timeline-cols-head";
    colsHead.style.gridColumn = "2";
    colsHead.style.gridRow = "1";
    const todayIdx = getTodayIndex(days);
    days.forEach((day) => {
      const h = document.createElement("div");
      h.className = "timeline-day-head";
      h.textContent = day.label;
      if (todayIdx >= 0 && Number(day.value) === Number(days[todayIdx]?.value)) h.classList.add("tt-today");
      colsHead.appendChild(h);
    });

    const rail = document.createElement("div");
    rail.className = "timeline-rail";
    rail.style.height = timelineHeight + "px";
    rail.style.gridColumn = "1";
    rail.style.gridRow = "2";
    for (let h = startHour; h <= endHour; h++) {
      const label = document.createElement("div");
      label.className = "timeline-rail-label";
      label.textContent = `${String(h).padStart(2, "0")}:00`;
      // Prevent top-most label from being clipped by translateY(-50%).
      const top = (h * 60 - startHour * 60) * minuteHeight;
      label.style.top = Math.max(10, top) + "px";
      rail.appendChild(label);
    }

    const cols = document.createElement("div");
    cols.className = "timeline-cols";
    cols.style.height = timelineHeight + "px";
    cols.style.gridColumn = "2";
    cols.style.gridRow = "2";

    days.forEach((day) => {
      const col = document.createElement("div");
      col.className = "timeline-day";
      col.dataset.day = String(day.value);
      col.style.height = timelineHeight + "px";
      col.style.setProperty("--timeline-hour-start", `${startHour}`);

      const dayLessons = lessons
        .filter((l) => Number(l.day) === Number(day.value))
        .sort((a, b) => (timeToMinutes(a.start) ?? 0) - (timeToMinutes(b.start) ?? 0));

      if (!dayLessons.length) {
        const placeholder = document.createElement("div");
        placeholder.className = "timeline-day-empty";
        placeholder.textContent = "";
        col.appendChild(placeholder);
      } else {
        dayLessons.forEach((lesson) => {
          const start = timeToMinutes(lesson.start) ?? startMin;
          const end =
            lesson.end && timeToMinutes(lesson.end) !== null
              ? timeToMinutes(lesson.end)
              : start + 60;
          const top = (start - startHour * 60) * minuteHeight;
          const height = Math.max((end - start) * minuteHeight, 30);
          const block = buildLessonBlock(lesson, height, "timeline");
          block.dataset.lessonId = lesson.id;
          if (conflictIds.has(lesson.id)) {
            block.classList.add("tt-conflict");
            block.title = "Overlaps with another lesson";
          }
          block.style.top = `${top}px`;
          col.appendChild(block);
        });
      }

      cols.appendChild(col);
    });

    wrap.appendChild(railHeadCell);
    wrap.appendChild(colsHead);
    wrap.appendChild(rail);
    wrap.appendChild(cols);
    timetableGrid.appendChild(wrap);
    applyPhoneDayView();

    timelineState.minuteHeight = minuteHeight;
    timelineState.startHour = startHour;
    timelineState.endHour = endHour;
    timelineState.wrap = wrap;
    timelineState.cols = cols;
    timelineState.rail = rail;
    ensureHoverRow();
    ensureNowIndicators();
    startNowTimer();
  }
  function buildLessonBlock(lesson, heightPx, mode = "timeline") {
    const color = mode === "timeline" ? getLessonColor(lesson) : "#4b5563";
    const wrap = document.createElement("div");
    wrap.className =
      "timetable-slot-lesson " + (mode === "timeline" ? "timeline-lesson-block" : "classic-lesson-block");
    wrap.style.setProperty("--lesson-color", color);
    if (mode === "timeline") {
      wrap.style.height = `${heightPx}px`;
      wrap.style.top = "0px";
      wrap.style.position = "absolute";
      const bg = blendWithWhite(color, 0.78);
      const border = blendWithWhite(color, 0.55);
      wrap.style.backgroundColor = bg;
      wrap.style.borderColor = border;
      wrap.style.color = "#0f172a";
    } else {
      wrap.style.removeProperty("height");
      wrap.style.removeProperty("top");
      wrap.style.removeProperty("position");
      wrap.style.backgroundColor = "#ffffff";
      wrap.style.borderColor = "#cbd5e1";
    }

    const title = document.createElement("div");
    title.className = "timetable-slot-title";
    title.textContent = lesson.title || "Lesson";

    const timeLine = document.createElement("div");
    timeLine.className = "timetable-slot-meta";
    timeLine.textContent = formatTimeRange(lesson.start, lesson.end);

    const meta = document.createElement("div");
    meta.className = "timetable-slot-meta";
    const bits = [];
    if (lesson.location) bits.push(lesson.location);
    meta.textContent = bits.join(" • ");

    const notes = document.createElement("div");
    notes.className = "timetable-slot-notes";
    if (lesson.notes) {
      notes.textContent = lesson.notes;
    }

    const actions = document.createElement("div");
    actions.className = "timetable-slot-actions";
    const menuToggle = document.createElement("button");
    menuToggle.type = "button";
    menuToggle.className = "timetable-slot-menu-toggle";
    menuToggle.textContent = "...";
    menuToggle.setAttribute("aria-label", "Open lesson menu");
    const menu = document.createElement("div");
    menu.className = "timetable-slot-menu";
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => {
      closeAllSlotMenus();
      fillForm(lesson);
    });
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = "Copy to another timetable";
    copyBtn.addEventListener("click", () => {
      closeAllSlotMenus();
      copyLessonToAnotherTable(lesson);
    });
    const duplicateBtn = document.createElement("button");
    duplicateBtn.type = "button";
    duplicateBtn.textContent = "Duplicate";
    duplicateBtn.addEventListener("click", () => {
      closeAllSlotMenus();
      const working = getWorkingLessons();
      working.push({ ...lesson, id: createId() });
      saveTimetableState();
      renderTimetable();
      setStatus("Lesson duplicated.", "success");
    });
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      closeAllSlotMenus();
      if (!confirm("Delete this lesson from the Stundenplan?")) return;
      const working = getWorkingLessons();
      const idx = working.findIndex((l) => l.id === lesson.id);
      if (idx >= 0) {
        working.splice(idx, 1);
      }
      saveTimetableState();
      renderTimetable();
      setStatus("Lesson removed.", "success");
      closeLessonModal();
    });
    menu.appendChild(editBtn);
    menu.appendChild(copyBtn);
    menu.appendChild(duplicateBtn);
    menu.appendChild(deleteBtn);
    menuToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = actions.classList.contains("slot-menu-open");
      closeAllSlotMenus();
      if (!isOpen) {
        actions.classList.add("slot-menu-open");
      }
    });
    actions.appendChild(menuToggle);
    actions.appendChild(menu);

    wrap.appendChild(title);
    wrap.appendChild(timeLine);
    if (meta.textContent) wrap.appendChild(meta);
    if (notes.textContent) wrap.appendChild(notes);
    wrap.appendChild(actions);
    if (mode === "timeline") {
      const handle = document.createElement("div");
      handle.className = "tt-resize-handle";
      handle.setAttribute("aria-hidden", "true");
      wrap.appendChild(handle);

      wrap.addEventListener("click", (event) => {
        if (event.target.closest(".timetable-slot-actions")) return;
        if (event.target.closest(".tt-resize-handle")) return;
        if (Date.now() - (interaction.lastDragEndMs || 0) < 260) return;
        fillForm(lesson);
      });
    }
    return wrap;
  }

  const interaction = {
    bound: false,
    selecting: false,
    selectDay: null,
    selectStartMin: null,
    selectLastMin: null,
    selectEl: null,
    drag: null, // { mode, lessonId, origin, durationMin }
    lastDragEndMs: 0
  };

  function lessonById(id) {
    const lessons = getWorkingLessons();
    return lessons.find((l) => l && l.id === id) || null;
  }

  function updateLesson(id, patch) {
    const lessons = getWorkingLessons();
    const idx = lessons.findIndex((l) => l && l.id === id);
    if (idx < 0) return false;
    lessons[idx] = { ...lessons[idx], ...(patch || {}) };
    return true;
  }

  function dayFromClientX(clientX) {
    const cols = timelineState.cols;
    if (!cols) return null;
    const rect = cols.getBoundingClientRect();
    const x = clientX - rect.left;
    if (x < 0 || x > rect.width) return null;
    const dayWidth = rect.width / Math.max(1, timelineState.days.length);
    const idx = Math.min(timelineState.days.length - 1, Math.max(0, Math.floor(x / dayWidth)));
    const dayObj = timelineState.days[idx];
    return dayObj ? Number(dayObj.value) : null;
  }

  function minutesFromClientY(clientY) {
    const cols = timelineState.cols;
    if (!cols) return null;
    const rect = cols.getBoundingClientRect();
    const y = clientY - rect.top + (timetableGrid?.scrollTop || 0);
    const mins = yToMinutes(y);
    return snapMinutes(mins, 15);
  }

  function ensureSelectEl(dayValue) {
    if (!timelineState.cols) return null;
    const dayIdx = timelineState.days.findIndex((d) => Number(d.value) === Number(dayValue));
    const col = timelineState.cols.children[dayIdx];
    if (!col) return null;
    if (!interaction.selectEl) {
      interaction.selectEl = document.createElement("div");
      interaction.selectEl.className = "tt-select-preview";
      col.appendChild(interaction.selectEl);
    } else if (interaction.selectEl.parentElement !== col) {
      interaction.selectEl.parentElement?.removeChild(interaction.selectEl);
      col.appendChild(interaction.selectEl);
    }
    return interaction.selectEl;
  }

  function clearSelectEl() {
    interaction.selectEl?.parentElement?.removeChild(interaction.selectEl);
    interaction.selectEl = null;
  }

  function updateSelectPreview(dayValue, startMin, endMin) {
    const el = ensureSelectEl(dayValue);
    if (!el) return;
    const top = minutesToY(startMin);
    const height = Math.max(30, minutesToY(endMin) - top);
    el.style.top = `${top}px`;
    el.style.height = `${height}px`;
  }

  function openModalForRange(dayValue, startMin, endMin) {
    openLessonModal(dayValue, minutesToTime(startMin), minutesToTime(endMin));
  }

  function bindTimelineInteractions() {
    if (interaction.bound || !timetableGrid) return;
    interaction.bound = true;

    timetableGrid.addEventListener("pointermove", (event) => {
      if (!timelineState.cols) return;

      if (interaction.selecting) {
        const currentMin = minutesFromClientY(event.clientY);
        if (currentMin === null || interaction.selectDay === null || interaction.selectStartMin === null) return;
        interaction.selectLastMin = currentMin;
        const a = Math.min(interaction.selectStartMin, currentMin);
        const b = Math.max(interaction.selectStartMin + 15, currentMin);
        updateSelectPreview(interaction.selectDay, a, b);
        return;
      }

      const colsRect = timelineState.cols.getBoundingClientRect();
      const inside =
        event.clientX >= colsRect.left &&
        event.clientX <= colsRect.right &&
        event.clientY >= colsRect.top &&
        event.clientY <= colsRect.bottom;
      if (!inside) {
        clearHover();
        return;
      }

      const day = dayFromClientX(event.clientX);
      const mins = minutesFromClientY(event.clientY);
      if (day === null || mins === null) {
        clearHover();
        return;
      }

      ensureHoverRow();
      const dayIdx = timelineState.days.findIndex((d) => Number(d.value) === Number(day));
      timelineState.cols.querySelectorAll(".timeline-day").forEach((el, idx) => {
        el.classList.toggle("tt-hover-col", idx === dayIdx);
      });
      if (timelineState.hoverRowEl) {
        timelineState.hoverRowEl.style.top = `${minutesToY(mins)}px`;
        timelineState.hoverRowEl.classList.add("is-visible");
      }
    });

    timetableGrid.addEventListener("pointerleave", () => clearHover());

    timetableGrid.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (!timelineState.cols) return;

      const block = event.target.closest(".timetable-slot-lesson.timeline-lesson-block");
      if (block) {
        const menuToggle = event.target.closest(".timetable-slot-menu-toggle");
        if (menuToggle) return;
        const lessonId = block.dataset.lessonId;
        const lesson = lessonId ? lessonById(lessonId) : null;
        if (!lesson) return;

        const isResize = !!event.target.closest(".tt-resize-handle");
        const start = timeToMinutes(lesson.start) ?? 0;
        const end = timeToMinutes(lesson.end) ?? start + 60;
        interaction.drag = {
          mode: isResize ? "resize" : "move",
          lessonId: lesson.id,
          origin: { ...lesson },
          durationMin: Math.max(15, end - start)
        };
        block.classList.add("is-dragging");
        timetableGrid.setPointerCapture(event.pointerId);
        return;
      }

      // Selection on empty grid.
      const colsRect = timelineState.cols.getBoundingClientRect();
      const inside =
        event.clientX >= colsRect.left &&
        event.clientX <= colsRect.right &&
        event.clientY >= colsRect.top &&
        event.clientY <= colsRect.bottom;
      if (!inside) return;

      const day = dayFromClientX(event.clientX);
      const startMin = minutesFromClientY(event.clientY);
      if (day === null || startMin === null) return;

      interaction.selecting = true;
      interaction.selectDay = day;
      interaction.selectStartMin = startMin;
      interaction.selectLastMin = startMin;
      updateSelectPreview(day, startMin, startMin + 60);
      timetableGrid.setPointerCapture(event.pointerId);
    });

    timetableGrid.addEventListener("pointermove", (event) => {
      if (!interaction.drag || !timelineState.cols) return;
      const day = dayFromClientX(event.clientX);
      const mins = minutesFromClientY(event.clientY);
      if (day === null || mins === null) return;

      const origin = interaction.drag.origin;
      const start0 = timeToMinutes(origin.start) ?? mins;
      const nextStart = interaction.drag.mode === "move" ? mins : start0;
      const nextEnd =
        interaction.drag.mode === "resize"
          ? Math.max(nextStart + 15, mins)
          : nextStart + interaction.drag.durationMin;

      const dayIdx = timelineState.days.findIndex((d) => Number(d.value) === Number(day));
      const col = timelineState.cols.children[dayIdx];
      if (!col) return;

      let preview = col.querySelector(".tt-drag-preview");
      if (!preview) {
        preview = document.createElement("div");
        preview.className = "tt-drag-preview";
        col.appendChild(preview);
      }
      preview.style.top = `${minutesToY(nextStart)}px`;
      preview.style.height = `${Math.max(30, minutesToY(nextEnd) - minutesToY(nextStart))}px`;
    });

    timetableGrid.addEventListener("pointerup", (event) => {
      // Finish selection
      if (interaction.selecting) {
        const day = interaction.selectDay;
        const startMin = interaction.selectStartMin;
        const endMin = interaction.selectLastMin ?? minutesFromClientY(event.clientY);
        interaction.selecting = false;
        interaction.selectDay = null;
        interaction.selectStartMin = null;
        interaction.selectLastMin = null;
        clearSelectEl();

        if (day !== null && startMin !== null && endMin !== null) {
          const delta = Math.abs(endMin - startMin);
          if (delta < 10) {
            openModalForRange(day, startMin, startMin + 60);
          } else {
            const a = Math.min(startMin, endMin);
            const b = Math.max(startMin + 15, endMin);
            openModalForRange(day, a, b);
          }
        }
      }

      // Finish drag/resize
      if (interaction.drag) {
        const drag = interaction.drag;
        const origin = drag.origin;
        const day = dayFromClientX(event.clientX);
        const mins = minutesFromClientY(event.clientY);
        interaction.drag = null;
        interaction.lastDragEndMs = Date.now();

        timetableGrid.querySelectorAll(".tt-drag-preview").forEach((el) => el.remove());
        timetableGrid.querySelectorAll(".timeline-lesson-block.is-dragging").forEach((el) => el.classList.remove("is-dragging"));

        if (day === null || mins === null) {
          renderTimetable();
          return;
        }

        const start0 = timeToMinutes(origin.start) ?? mins;
        const nextStart = drag.mode === "move" ? mins : start0;
        const nextEnd = drag.mode === "resize" ? Math.max(nextStart + 15, mins) : nextStart + drag.durationMin;
        const candidate = { ...origin, day, start: minutesToTime(nextStart), end: minutesToTime(nextEnd) };

        if (wouldOverlap(candidate, origin.id)) {
          alert("That time range overlaps with another lesson.");
          renderTimetable();
          return;
        }

        updateLesson(origin.id, { day, start: candidate.start, end: candidate.end });
        saveTimetableState();
        renderTimetable();
      }
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    clearStatus();
    const title = (lessonTitleInput?.value || "").trim();
    const subjectId = lessonSubjectSelect?.value || "";
    const day = Number(lessonDaySelect?.value ?? 0);
    const start = lessonStartInput?.value || "";
    const end = lessonEndInput?.value || "";
    const location = (lessonLocationInput?.value || "").trim();
    const notes = (lessonNotesInput?.value || "").trim();
    const color = lessonColorInput?.value || "#4f8bff";

    if (!title) {
      setStatus("Please enter a lesson title.", "error");
      lessonTitleInput?.focus();
      return;
    }
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    if (start && end && startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
      setStatus("End time must be after start time.", "error");
      lessonEndInput?.focus();
      return;
    }

    const subjectName =
      (subjects.find((s) => s.id === subjectId)?.name || "") || undefined;

    const newLesson = {
      id: editingId || createId(),
      title,
      subjectId: subjectId || null,
      subjectName,
      day,
      start,
      end,
      location,
      notes,
      color
    };

    const working = getWorkingLessons();
    if (wouldOverlap(newLesson, newLesson.id)) {
      setStatus("This lesson overlaps with another one. Adjust the time or day.", "error");
      return;
    }
    const existingIndex = working.findIndex((l) => l.id === newLesson.id);
    if (existingIndex >= 0) {
      working[existingIndex] = newLesson;
      setStatus("Lesson updated.", "success");
    } else {
      working.push(newLesson);
      setStatus("Lesson saved.", "success");
    }

    saveTimetableState();
    renderTimetable();
    closeLessonModal();
  }

  function hookEvents() {
    if (lessonForm) {
      lessonForm.addEventListener("submit", handleSubmit);
    }
    lessonResetBtn?.addEventListener("click", () => resetForm());
    lessonSubjectSelect?.addEventListener("change", () => {
      const selected = lessonSubjectSelect.value;
      if (!selected) return;
      const subj = subjects.find((s) => s.id === selected);
      if (subj && !lessonTitleInput.value.trim()) {
        lessonTitleInput.value = subj.name || "";
      }
    });
    openLessonModalBtn?.addEventListener("click", () => {
      const today = new Date().getDay();
      const mondayBased = today === 0 ? 6 : today - 1;
      const start = nearestHalfHour();
      const end = addMinutesToTime(start, 60);
      const presetDay = includeWeekend ? mondayBased : Math.min(4, mondayBased);
      openLessonModal(presetDay, start, end);
    });
    lessonModalCloseBtn?.addEventListener("click", closeLessonModal);
    lessonModalBackdrop?.addEventListener("click", closeLessonModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeLessonModal();
        closeAllSlotMenus();
      }
    });
    copyTimetableBtn?.addEventListener("click", duplicateActiveTimetable);
    newTimetableTabBtn?.addEventListener("click", addNewTimetable);
    document.addEventListener("click", (event) => {
      // close slot menus when clicking outside
      if (!event.target.closest(".timetable-slot-actions")) {
        closeAllSlotMenus();
      }
    });
    tabMenuToggle?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (tabMenu?.classList.contains("tab-menu-open")) {
        closeTabMenu();
      } else {
        openTabMenu();
      }
    });
    tabMenu?.addEventListener("mouseenter", openTabMenu);
    tabMenu?.addEventListener("mouseleave", scheduleCloseTabMenu);
    tabMenuPanel?.addEventListener("mouseenter", openTabMenu);
    tabMenuPanel?.addEventListener("mouseleave", scheduleCloseTabMenu);
    document.addEventListener("click", (event) => {
      if (tabMenu && tabMenu.contains(event.target)) return;
      closeTabMenu();
    });

    ttPrevDayBtn?.addEventListener("click", () => {
      if (!isPhoneLayout()) return;
      setPhoneDayIndex(getPhoneDayIndex() - 1);
    });
    ttNextDayBtn?.addEventListener("click", () => {
      if (!isPhoneLayout()) return;
      setPhoneDayIndex(getPhoneDayIndex() + 1);
    });
    window.addEventListener("resize", applyPhoneDayView);
    window.addEventListener("orientationchange", applyPhoneDayView);

    toggleWeekendBtn?.addEventListener("click", () => {
      includeWeekend = !includeWeekend;
      saveIncludeWeekend();
      updateWeekendToggleUi();
      populateDayOptions();
      // Clamp phone day index to available days.
      setPhoneDayIndex(getPhoneDayIndex());
      renderTimetable();
    });

    ttNowBtn?.addEventListener("click", () => {
      scrollToNow();
    });

    bindTimelineInteractions();
  }

  function init() {
    subjects = loadSubjects();
    const state = loadTimetableState();
    tables = state.tables;
    activeTableId = state.activeTableId;
    ensureActiveTable();
    renderTimetableTabs();
    populateDayOptions();
    populateSubjectOptions();
    renderSubjectList();
    renderTimetable();
    hookEvents();
    applyPhoneDayView();
  }

  function reloadSyncedStateFromStorage() {
    subjects = loadSubjects();
    const state = loadTimetableState();
    tables = state.tables;
    activeTableId = state.activeTableId;
    ensureActiveTable();
    renderTimetableTabs();
    populateDayOptions();
    populateSubjectOptions();
    renderSubjectList();
    renderTimetable();
    applyPhoneDayView();
  }

  window.addEventListener("study:state-replaced", () => {
    reloadSyncedStateFromStorage();
  });

  init();
})();
