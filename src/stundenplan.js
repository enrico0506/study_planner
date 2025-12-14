(() => {
  const SUBJECT_STORAGE_KEY = "studySubjects_v1";
  const TIMETABLE_KEY = "studyTimetable_v1";
  const COLOR_PALETTE_KEY = "studyColorPalette_v1";
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
  let subjects = [];
  let tables = [];
  let activeTableId = "";
  let editingId = null;
  let tabMenuTimer = null;
  let phoneDayIndex = null;

  function isPhoneLayout() {
    return window.matchMedia && window.matchMedia("(max-width: 1024px)").matches;
  }

  function getPhoneDayIndex() {
    if (phoneDayIndex === null) {
      const today = new Date().getDay(); // 0=Sun..6=Sat
      phoneDayIndex = today === 0 ? 6 : today - 1; // Monday-based
    }
    return Math.max(0, Math.min(6, phoneDayIndex));
  }

  function setPhoneDayIndex(nextIndex) {
    phoneDayIndex = Math.max(0, Math.min(6, Number(nextIndex) || 0));
    applyPhoneDayView();
  }

  function applyPhoneDayView() {
    if (!timetableGrid) return;
    if (!isPhoneLayout()) {
      timetableGrid.style.removeProperty("--tt-day");
      if (ttDayLabel) ttDayLabel.textContent = "";
      if (ttPrevDayBtn) ttPrevDayBtn.disabled = false;
      if (ttNextDayBtn) ttNextDayBtn.disabled = false;
      return;
    }
    const idx = getPhoneDayIndex();
    timetableGrid.style.setProperty("--tt-day", String(idx));
    if (ttDayLabel) ttDayLabel.textContent = DAY_LABELS[idx]?.label?.slice(0, 3) || String(idx + 1);
    if (ttPrevDayBtn) ttPrevDayBtn.disabled = idx <= 0;
    if (ttNextDayBtn) ttNextDayBtn.disabled = idx >= 6;
  }

  function createId(prefix = "ls_") {
    return prefix + Math.random().toString(36).slice(2, 9);
  }

  function loadColorPalette() {
    try {
      const raw = localStorage.getItem(COLOR_PALETTE_KEY);
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

  function loadSubjects() {
    try {
      const raw = localStorage.getItem(SUBJECT_STORAGE_KEY);
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
      const raw = localStorage.getItem(TIMETABLE_KEY);
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
      localStorage.setItem(TIMETABLE_KEY, JSON.stringify({ tables, activeTableId }));
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
    lessonDaySelect.value = String(mondayBased);
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
      chip.innerHTML = `<span class="timetable-chip-dot"></span>${subj.name || "Subject"}`;
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

    const lessons = getWorkingLessons();
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
    DAY_LABELS.forEach((day) => {
      const h = document.createElement("div");
      h.className = "timeline-day-head";
      h.textContent = day.label;
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
      label.style.top = (h * 60 - startHour * 60) * minuteHeight + "px";
      rail.appendChild(label);
    }

    const cols = document.createElement("div");
    cols.className = "timeline-cols";
    cols.style.height = timelineHeight + "px";
    cols.style.gridColumn = "2";
    cols.style.gridRow = "2";

    DAY_LABELS.forEach((day) => {
      const col = document.createElement("div");
      col.className = "timeline-day";
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
    return wrap;
  }

  ttPrevDayBtn?.addEventListener("click", () => {
    phoneDayIndex = getPhoneDayIndex() - 1;
    applyPhoneDayView();
  });
  ttNextDayBtn?.addEventListener("click", () => {
    phoneDayIndex = getPhoneDayIndex() + 1;
    applyPhoneDayView();
  });

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
      openLessonModal(mondayBased, start, end);
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
  }

  init();
})();
