const STORAGE_KEY = "studySubjects_v1";
    const CONFIG_KEY = "studyFocusConfig_v1";
    const TODO_KEY = "studyTodayTodos_v1";
    const DAILY_FOCUS_KEY = "studyDailyFocus_v1";
    const ACTIVE_SESSION_KEY = "studyActiveSession_v1";
    const THEME_KEY = "studyTheme_v1";
    const COLOR_PALETTE_KEY = "studyColorPalette_v1";
    const LANGUAGE_KEY = "studyLanguage_v1";
    const STYLE_PREF_KEY = "studyStylePrefs_v1";
    const CALENDAR_KEY = "studyCalendarEvents_v1";
    const CONF_MODE_KEY = "studyConfidenceMode_v1";

const DEFAULT_SUBJECT_COLORS = [
      "#4f8bff", // vivid blue
      "#4ec58a", // vivid green
      "#f77fb3", // punchy pink
      "#f6a23c", // bright orange
      "#b18bff", // rich violet
      "#37c6c0", // teal
      "#f17575", // coral red
      "#f4c74f"  // warm gold
    ];

const CVD_SAFE_SUBJECT_COLORS = [
  // Okabe-Ito inspired (good separation for common CVD types)
  "#0072B2", // blue
  "#E69F00", // orange
  "#009E73", // bluish green
  "#D55E00", // vermillion
  "#56B4E9", // sky blue
  "#CC79A7", // reddish purple
  "#F0E442", // yellow
  "#000000" // black
];

    let subjectColors = [...DEFAULT_SUBJECT_COLORS];
    const THEMES = [
      {
        id: "breeze",
        name: "Breeze",
        subtitle: "Crisp blues and soft gradients",
        swatch: "linear-gradient(135deg, #6aa9ff, #9fc5ff)"
      },
      {
        id: "sunrise",
        name: "Sunrise",
        subtitle: "Warm peaches and amber glow",
        swatch: "linear-gradient(135deg, #ff9f66, #ffd3a4)"
      },
      {
        id: "forest",
        name: "Forest",
        subtitle: "Calm greens with fresh undertones",
        swatch: "linear-gradient(135deg, #34c38f, #a8e6b0)"
      },
      {
        id: "midnight",
        name: "Midnight",
        subtitle: "High-contrast dark inspired by VS Code Dark+",
        swatch: "linear-gradient(135deg, #1e1e1e, #2a2d3e)"
      },
      {
        id: "nocturne",
        name: "Nocturne",
        subtitle: "Warm, low-blue dark to rest your eyes",
        swatch: "linear-gradient(135deg, #1a1410, #2a2018)"
      },
      {
        id: "amber",
        name: "Amber Calm",
        subtitle: "Warm, low-blue light for late sessions",
        swatch: "linear-gradient(135deg, #f6d6a8, #f1b87a)"
      }
    ];

    const DEFAULT_WEEKLY_TARGET_MINUTES = 600; // 10 hours
    const STREAK_THRESHOLD_MINUTES = 10; // minutes required to count toward streak
    const METER_STYLES = {
      classic: {
        low: "linear-gradient(90deg, #fb7185, #f97373)",
        mid: "linear-gradient(90deg, #fbbf24, #facc15)",
        high: "linear-gradient(90deg, #22c55e, #16a34a)"
      },
      flat: {
        low: "#ef4444",
        mid: "#f59e0b",
        high: "#10b981"
      },
      stripe: {
        low: "repeating-linear-gradient(45deg, #fb7185, #fb7185 6px, #ffffff 6px, #ffffff 12px)",
        mid: "repeating-linear-gradient(45deg, #fbbf24, #fbbf24 6px, #ffffff 6px, #ffffff 12px)",
        high: "repeating-linear-gradient(45deg, #22c55e, #22c55e 6px, #ffffff 6px, #ffffff 12px)"
      }
    };
    const STUDY_BAR_STYLES = {
      rounded: {
        bg: "#e8ecf7",
        radius: "999px"
      },
      flat: {
        bg: "#e5e7eb",
        radius: "6px"
      },
      stripe: {
        bg: "repeating-linear-gradient(90deg, #e8ecf7, #e8ecf7 12px, #f8fafc 12px, #f8fafc 18px)",
        radius: "10px"
      }
    };

    let subjects = [];
    let currentSearch = "";
    let todayTodos = [];
    let dailyFocusMap = {};
    let calendarEvents = [];
    let dragState = null; // { subjectId, fileId }
    let fileModalState = null; // { mode: "add"|"edit", subjectId, fileId? }
    let todayExpanded = false;

    // activeStudy session:
    // { kind: 'study'|'break', breakKind?, subjectId?, fileId?,
    //   startTimeMs, baseMs, targetMs, paused }
    let activeStudy = null;
    let lastActiveStudyKey = null;
    let lastActiveStudyPaused = null;

    let pomoConfig = { study: 25, short: 5, long: 15 };
    let weeklyTargetMinutes = DEFAULT_WEEKLY_TARGET_MINUTES;
    let activeTheme = document.documentElement.getAttribute("data-theme") || "breeze";
    let themeMenuOpen = false;
    let stylePrefs = {
      meter: "classic",
      meterSingle: "#f97373",
      meterGradStart: "#f97373",
      meterGradEnd: "#22c55e",
      studyBar: "rounded",
      contrast: "normal", // "normal" | "high" | "low"
      cvd: "none" // "none" | "safe"
    };
    let meterBaseColors = {
      low: "#fb7185",
      mid: "#fbbf24",
      high: "#22c55e"
    };
    let confidenceMode = "manual"; // "manual" | "perceived"
    let timerModePref = "countdown";
    let expandState = false;
    let subjectsMaximized = false;

    // DOM refs
    const appRoot = document.getElementById("appRoot");
    const layoutRow = document.getElementById("layoutRow");
    const todaySidebar = document.querySelector(".today-sidebar");
    const searchInput = null;
    const subjectTable = document.getElementById("subjectTable");
    const tableWrapper = document.querySelector(".table-wrapper");
    const mainArea = document.querySelector("#layoutRow .main-area");
    const expandPageBtn = document.getElementById("expandPageBtn");
    const emptyHint = document.getElementById("emptyHint");
    const openStatsBtn = document.getElementById("openStatsBtn");
    const todayDropZone = document.getElementById("todayDropZone");
    const todayList = document.getElementById("todayList");
    const todayHeaderActions = document.querySelector(".today-header-actions");
    const suggestionsList = document.getElementById("suggestionsList");
    const suggestionsCapNote = document.getElementById("suggestionsCapNote");
	    const dueSoonList = document.getElementById("dueSoonList");
	    const dueSoonHint = document.getElementById("dueSoonHint");
	    const openSuggestionsBtn = document.getElementById("openSuggestionsBtn");
	    const suggestionModalBackdrop = document.getElementById("suggestionModalBackdrop");
	    const suggestionModalCloseBtn = document.getElementById("suggestionModalCloseBtn");
	    const suggestionModalCloseBtn2 = document.getElementById("suggestionModalCloseBtn2");
	    const subjectSettingsBackdrop = document.getElementById("subjectSettingsBackdrop");
	    const subjectSettingsCloseBtn = document.getElementById("subjectSettingsCloseBtn");
	    const subjectSettingsCancelBtn = document.getElementById("subjectSettingsCancelBtn");
	    const subjectSettingsSaveBtn = document.getElementById("subjectSettingsSaveBtn");
	    const subjectSettingsNameInput = document.getElementById("subjectSettingsNameInput");
    const subjectSettingsStrength = document.getElementById("subjectSettingsStrength");
    const subjectSettingsSwatches = document.getElementById("subjectSettingsSwatches");
    const subjectSettingsDot = document.getElementById("subjectSettingsDot");
    const subjectSettingsCustomColor = document.getElementById("subjectSettingsCustomColor");
    const subjectSettingsColorLabel = document.getElementById("subjectSettingsColorLabel");
    const addTodoModalBackdrop = document.getElementById("addTodoModalBackdrop");
    const addTodoModalTitle = document.getElementById("addTodoModalTitle");
    const addTodoModalSubtitle = document.getElementById("addTodoModalSubtitle");
    const addTodoSubtaskInput = document.getElementById("addTodoSubtaskInput");
    const addTodoSubtaskAdd = document.getElementById("addTodoSubtaskAdd");
    const addTodoSubtaskList = document.getElementById("addTodoSubtaskList");
    const addTodoModalSave = document.getElementById("addTodoModalSave");
    const addTodoModalCancel = document.getElementById("addTodoModalCancel");
    const addTodoModalClose = document.getElementById("addTodoModalClose");
    const themeSwitcher = document.getElementById("themeSwitcher");
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    const themeMenu = document.getElementById("themeMenu");
    const themeLabel = document.getElementById("themeLabel");
    const themeDot = document.getElementById("themeDot");
    const headerMenu = document.getElementById("headerMenu");
    const headerMenuPanel = document.getElementById("headerMenuPanel");
    const headerMenuToggle = document.getElementById("headerMenuToggle");
    const headerProfileBtn = document.getElementById("headerProfileBtn");
    const headerSettingsBtn = document.getElementById("headerSettingsBtn");
    const quickJumpDropdown = document.getElementById("quickJumpDropdown");
    const quickJumpTrigger = document.getElementById("quickJumpTrigger");
    const quickJumpPanel = document.getElementById("quickJumpPanel");
    const settingsModal = document.getElementById("settingsModal");
    const settingsModalBackdrop = document.getElementById("settingsModalBackdrop");
    const settingsModalCloseBtn = document.getElementById("settingsModalCloseBtn");
    const settingsNav = document.getElementById("settingsNav");
    const settingsThemePanel = document.getElementById("settingsThemePanel");
  const settingsColorsPanel = document.getElementById("settingsColorsPanel");
  const settingsPrefsPanel = document.getElementById("settingsPrefsPanel");
  const settingsThemePickerBtn = document.getElementById("settingsThemePickerBtn");
  const timerModeCountdownBtn = document.getElementById("timerModeCountdownBtn");
  const timerModeStopwatchBtn = document.getElementById("timerModeStopwatchBtn");
  const focusTimerLabel = document.getElementById("focusTimerLabel");
  const manualConfBtn = document.getElementById("manualConfBtn");
  const perceivedConfBtn = document.getElementById("perceivedConfBtn");
		    let headerMenuTimer = null;
		    let addTodoModalState = null; // { subjectId, fileId, subjectName, fileName, subtasks: [] }

		    async function updateHeaderProfileLabel() {
	      if (!headerProfileBtn) return;
      try {
        const res = await fetch("/api/me", { credentials: "same-origin" });
        if (res.ok) {
          headerProfileBtn.textContent = "Profile";
          headerProfileBtn.title = "Account & sync";
        } else {
          headerProfileBtn.textContent = "Login";
          headerProfileBtn.title = "Login / register";
        }
      } catch {
        // If offline or server unreachable, leave default label.
      }
    }

    // View / schedule refs
    const viewBoardBtn = document.getElementById("viewBoardBtn");
    const viewScheduleBtn = document.getElementById("viewScheduleBtn");
    const scheduleView = document.getElementById("scheduleView");
    const scheduleGrid = document.getElementById("scheduleGrid");
    const scheduleRangeLabel = document.getElementById("scheduleRangeLabel");
    const schedulePrevWeekBtn = document.getElementById("schedulePrevWeekBtn");
    const scheduleNextWeekBtn = document.getElementById("scheduleNextWeekBtn");
    const scheduleTodayBtn = document.getElementById("scheduleTodayBtn");
    const scheduleTaskModalBackdrop = document.getElementById("scheduleTaskModalBackdrop");
    const scheduleTaskModalTitle = document.getElementById("scheduleTaskModalTitle");
    const scheduleTaskModalSubtitle = document.getElementById("scheduleTaskModalSubtitle");
    const scheduleTaskModalSubtasks = document.getElementById("scheduleTaskModalSubtasks");
    const scheduleTaskStudyBtn = document.getElementById("scheduleTaskStudyBtn");
    const scheduleTaskCloseBtn = document.getElementById("scheduleTaskCloseBtn");
    const noticeModalBackdrop = document.getElementById("noticeModalBackdrop");
    const noticeModalTitle = document.getElementById("noticeModalTitle");
    const noticeModalMessage = document.getElementById("noticeModalMessage");
    const noticeModalConfirmBtn = document.getElementById("noticeModalConfirmBtn");
    const noticeModalCancelBtn = document.getElementById("noticeModalCancelBtn");
    const timerInlinePanel = document.getElementById("timerInlinePanel");
    const timerInlineStudy = document.getElementById("timerInlineStudy");
    const timerInlineShort = document.getElementById("timerInlineShort");
    const timerInlineLong = document.getElementById("timerInlineLong");
    const timerInlineSave = document.getElementById("timerInlineSave");
    const timerInlineCancel = document.getElementById("timerInlineCancel");
    let noticeResolver = null;
    let noticeConfirmHandler = null;
    const toastContainer =
      document.getElementById("toastContainer") ||
      (() => {
        const div = document.createElement("div");
        div.id = "toastContainer";
        div.className = "toast-container";
        document.body.appendChild(div);
        return div;
      })();

    // Summary refs
    const summarySubjects = document.getElementById("summarySubjects");
    const summaryFiles = document.getElementById("summaryFiles");
    const summaryLow = document.getElementById("summaryLow");
    const summaryConfLabel = document.getElementById("summaryConfLabel");
    const summaryConfFill = document.getElementById("summaryConfFill");
    const summaryStudyTodayLabel = document.getElementById("summaryStudyTodayLabel");
    const summaryStudyBar = document.getElementById("summaryStudyBar");
    const summaryStudyLegend = document.getElementById("summaryStudyLegend");
    const weeklyGoalProgressLabel = document.getElementById("weeklyGoalProgressLabel");
    const weeklyGoalTotalLabel = document.getElementById("weeklyGoalTotalLabel");
    const weeklyGoalFill = document.getElementById("weeklyGoalFill");
    const weeklyGoalHint = document.getElementById("weeklyGoalHint");
    const streakCurrentLabel = document.getElementById("streakCurrentLabel");
    const streakBestLabel = document.getElementById("streakBestLabel");
    const editGoalBtn = document.getElementById("editGoalBtn");

    // Focus timer refs
    const focusCard = document.getElementById("focusCard");
    const focusSessionTitle = document.getElementById("focusSessionTitle");
    const focusSessionSubtitle = document.getElementById("focusSessionSubtitle");
    const focusTimerDisplay = document.getElementById("focusTimerDisplay");
    const focusSessionControls = document.getElementById("focusSessionControls");
    const openTimerSettingsBtn = document.getElementById("openTimerSettingsBtn");
    const startShortBreakBtn = document.getElementById("startShortBreakBtn");
    const startLongBreakBtn = document.getElementById("startLongBreakBtn");

    // File modal refs
    const fileModalBackdrop = document.getElementById("fileModalBackdrop");
    const fileModalTitle = document.getElementById("fileModalTitle");
    const fileModalSubtitle = document.getElementById("fileModalSubtitle");
    const fileModalCloseBtn = document.getElementById("fileModalCloseBtn");
    const modalFileNameInput = document.getElementById("modalFileName");
    const modalSubjectSelect = document.getElementById("modalSubjectSelect");
    const modalConfidenceRange = document.getElementById("modalConfidenceRange");
    const modalConfidenceValue = document.getElementById("modalConfidenceValue");
    const modalFileNotesInput = document.getElementById("modalFileNotes");
    const modalSaveBtn = document.getElementById("fileModalSaveBtn");
    const modalCancelBtn = document.getElementById("fileModalCancelBtn");
    const modalDeleteBtn = document.getElementById("fileModalDeleteBtn");

    // Timer settings modal refs
    const timerModalBackdrop = document.getElementById("timerModalBackdrop");
    const timerStudyInput = document.getElementById("timerStudyInput");
    const timerShortInput = document.getElementById("timerShortInput");
    const timerLongInput = document.getElementById("timerLongInput");
    const timerModalSaveBtn = document.getElementById("timerModalSaveBtn");
    const timerModalCancelBtn = document.getElementById("timerModalCancelBtn");
    const timerModalCloseBtn = document.getElementById("timerModalCloseBtn");

    // Stats modal refs
    const statsBackdrop = document.getElementById("statsModalBackdrop");
    const statsBody = document.getElementById("statsModalBody");
    const statsCloseBtn = document.getElementById("statsModalCloseBtn");
    const statsCloseBtn2 = document.getElementById("statsModalCloseBtn2");

    let statsRange = "week"; // "day" | "week" | "month" | "all"
    let activeView = "board"; // "board" | "schedule"
    let scheduleWeekStart = null;
    let scheduleCursorDay = null;
    let subjectCursorIndex = 0;
    let scheduleModalState = null;
    let scheduleDrag = null;

    // Helpers
    function isPhoneLayout() {
      return window.matchMedia && window.matchMedia("(max-width: 720px)").matches;
    }

    function isPhoneTodayPicker() {
      return (
        isPhoneLayout() &&
        document.body?.dataset?.mode === "today" &&
        document.body.classList.contains("today-picker-open")
      );
    }

    function applyDesktopSubjectSizing() {
      if (!subjectTable) return;
      if (subjectsMaximized) {
        subjectTable.classList.remove("subject-table-dynamic");
        subjectTable.style.removeProperty("grid-template-columns");
        return;
      }
      if (isPhoneLayout()) return;
      if (window.matchMedia && window.matchMedia("(max-width: 960px)").matches) return;

      const wrapper = subjectTable.closest(".table-wrapper");
      if (!wrapper) return;

      const count = subjects.length;
      const addColWidth = 96; // "scroll a little" to reach Add subject

      if (count <= 0) {
        subjectTable.classList.remove("subject-table-dynamic");
        subjectTable.style.removeProperty("grid-template-columns");
        return;
      }

      const wrapperStyles = window.getComputedStyle(wrapper);
      const paddingLeft = parseFloat(wrapperStyles.paddingLeft) || 0;
      const paddingRight = parseFloat(wrapperStyles.paddingRight) || 0;
      const viewportWidth = Math.max(0, wrapper.clientWidth - paddingLeft - paddingRight);

      const tableStyles = window.getComputedStyle(subjectTable);
      const gapRaw = tableStyles.columnGap || tableStyles.gap || "0px";
      const gap = parseFloat(gapRaw) || 0;

      const visibleSubjects = count >= 4 ? 4 : Math.max(1, count);
      const base =
        (viewportWidth - gap * Math.max(0, visibleSubjects - 1)) / Math.max(1, visibleSubjects);
      const subjectWidth = Math.round(Math.max(190, Math.min(360, base)));

      const template = `repeat(${count}, ${subjectWidth}px) ${addColWidth}px`;
      subjectTable.classList.add("subject-table-dynamic");
      subjectTable.style.gridTemplateColumns = template;
    }

    function ensureSubjectScrollButtons() {
      if (!subjectTable) return;
      if (isPhoneLayout()) return;
      const wrapper = subjectTable.closest(".table-wrapper");
      if (!wrapper) return;

      // Remove previous overlay arrows (older versions).
      wrapper.querySelector(".subject-scroll-nav")?.remove();

      const leftBtn = document.getElementById("subjectScrollLeftBtn");
      const rightBtn = document.getElementById("subjectScrollRightBtn");
      if (!leftBtn || !rightBtn) return;

      if (!leftBtn.dataset.bound) {
        leftBtn.dataset.bound = "1";
        leftBtn.addEventListener("click", (event) => {
          event.preventDefault();
          const step = Math.max(240, Math.round(wrapper.clientWidth * 0.8));
          wrapper.scrollBy({ left: -step, behavior: "smooth" });
        });
      }
      if (!rightBtn.dataset.bound) {
        rightBtn.dataset.bound = "1";
        rightBtn.addEventListener("click", (event) => {
          event.preventDefault();
          const step = Math.max(240, Math.round(wrapper.clientWidth * 0.8));
          wrapper.scrollBy({ left: step, behavior: "smooth" });
        });
      }

      const update = () => {
        const max = Math.max(0, wrapper.scrollWidth - wrapper.clientWidth);
        const atStart = wrapper.scrollLeft <= 2;
        const atEnd = wrapper.scrollLeft >= max - 2;
        const hasOverflow = max > 4;
        leftBtn.classList.toggle("is-hidden", !hasOverflow);
        rightBtn.classList.toggle("is-hidden", !hasOverflow);
        leftBtn.disabled = atStart;
        rightBtn.disabled = atEnd;
      };

      wrapper.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
      window.addEventListener("resize", () => requestAnimationFrame(update));
      requestAnimationFrame(update);
    }

    function getScheduleCursorDay() {
      if (!scheduleCursorDay) {
        scheduleCursorDay = new Date();
      }
      // Reduce timezone edge cases around midnight
      scheduleCursorDay.setHours(12, 0, 0, 0);
      return scheduleCursorDay;
    }

    function applySubjectPaging() {
      if (!subjectTable) return;
      if (!isPhoneLayout()) return;
      const mode = document.body.dataset.mode;
      const allowTodayPicker = mode === "today" && document.body.classList.contains("today-picker-open");
      if (mode !== "subjects" && !allowTodayPicker) return;

      const cols = subjectTable.querySelectorAll(".subject-column");
      const total = cols.length;
      if (!total) return;

      subjectCursorIndex = Math.max(0, Math.min(subjectCursorIndex, total - 1));
      subjectTable.style.setProperty("--subject-page", String(subjectCursorIndex));

      const subjectPrevBtn = document.getElementById("subjectPrevBtn");
      const subjectNextBtn = document.getElementById("subjectNextBtn");
      const subjectNavLabel = document.getElementById("subjectNavLabel");

      if (subjectNavLabel) subjectNavLabel.textContent = `${subjectCursorIndex + 1} / ${total}`;
      if (subjectPrevBtn) subjectPrevBtn.disabled = subjectCursorIndex <= 0;
      if (subjectNextBtn) subjectNextBtn.disabled = subjectCursorIndex >= total - 1;
    }

    function getSubjectColor(index) {
      const palette =
        stylePrefs?.cvd === "safe"
          ? CVD_SAFE_SUBJECT_COLORS
          : Array.isArray(subjectColors) && subjectColors.length
            ? subjectColors
            : DEFAULT_SUBJECT_COLORS;
      return palette[index % palette.length];
    }

    function isHexColor(value) {
      const v = String(value || "").trim();
      return /^#[0-9a-f]{6}$/i.test(v);
    }

    function getSubjectColorById(subjectId) {
      const idx = subjects.findIndex((s) => s.id === subjectId);
      if (idx === -1) return "#d1d5db";
      const subj = subjects[idx];
      if (subj && isHexColor(subj.color)) return subj.color;
      return getSubjectColor(idx);
    }

    function getSubjectTintAlphaById(subjectId) {
      const subj = subjects.find((s) => s.id === subjectId);
      const value = Number(subj?.tintAlpha);
      if (!Number.isFinite(value)) return 0.2;
      return Math.max(0.05, Math.min(0.6, value));
    }

    function getSubjectSwatches() {
      if (stylePrefs?.cvd === "safe") return [...CVD_SAFE_SUBJECT_COLORS];
      return [
        "#4f8bff",
        "#4ec58a",
        "#f77fb3",
        "#f6a23c",
        "#b18bff",
        "#37c6c0",
        "#f17575",
        "#f4c74f",
        "#0ea5e9",
        "#22c55e",
        "#a855f7",
        "#ef4444"
      ];
    }

    let subjectColorPopover = null;
    function closeSubjectColorPopover() {
      if (!subjectColorPopover) return;
      subjectColorPopover.remove();
      subjectColorPopover = null;
    }

    function openSubjectColorPopover(anchorEl, subj, fallbackColor) {
      closeSubjectColorPopover();
      if (!anchorEl) return;

      const baseColor = isHexColor(subj.color) ? subj.color : fallbackColor;
      const tintAlpha = Number.isFinite(Number(subj.tintAlpha)) ? getSubjectTintAlphaById(subj.id) : 0.2;

      const pop = document.createElement("div");
      pop.className = "subject-color-popover";
      pop.setAttribute("role", "dialog");
      pop.setAttribute("aria-label", "Choose subject color");
      pop.addEventListener("click", (e) => e.stopPropagation());

      const title = document.createElement("div");
      title.className = "subject-color-popover-title";
      title.textContent = "Subject color";

      const grid = document.createElement("div");
      grid.className = "subject-color-swatch-grid";
      getSubjectSwatches().forEach((color) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "subject-color-swatch";
        btn.style.backgroundColor = color;
        btn.setAttribute("aria-label", `Set color ${color}`);
        if (color.toLowerCase() === String(baseColor).toLowerCase()) {
          btn.classList.add("is-active");
        }
        btn.addEventListener("click", () => {
          subj.color = color;
          saveToStorage();
          renderTable();
          renderTodayTodos();
          renderScheduleView();
          renderFocusState();
          closeSubjectColorPopover();
        });
        grid.appendChild(btn);
      });

      const customRow = document.createElement("div");
      customRow.className = "subject-color-custom-row";
      const customLabel = document.createElement("div");
      customLabel.className = "subject-color-custom-label";
      customLabel.textContent = "Custom";
      const customInput = document.createElement("input");
      customInput.type = "color";
      customInput.value = baseColor;
      customInput.className = "subject-color-custom-input";
      customInput.addEventListener("change", () => {
        subj.color = customInput.value;
        saveToStorage();
        renderTable();
        renderTodayTodos();
        renderScheduleView();
        renderFocusState();
        closeSubjectColorPopover();
      });
      customRow.appendChild(customLabel);
      customRow.appendChild(customInput);

      const strength = document.createElement("div");
      strength.className = "subject-color-strength";
      const strengthLabel = document.createElement("div");
      strengthLabel.className = "subject-color-strength-label";
      strengthLabel.textContent = "Highlight strength";
      const strengthRange = document.createElement("input");
      strengthRange.type = "range";
      strengthRange.min = "5";
      strengthRange.max = "60";
      strengthRange.step = "1";
      strengthRange.value = String(Math.round(tintAlpha * 100));
      strengthRange.className = "subject-color-strength-range";
      const strengthValue = document.createElement("div");
      strengthValue.className = "subject-color-strength-value";
      strengthValue.textContent = `${strengthRange.value}%`;
      strengthRange.addEventListener("input", () => {
        strengthValue.textContent = `${strengthRange.value}%`;
        subj.tintAlpha = Number(strengthRange.value) / 100;
        saveToStorage();
        renderTodayTodos();
        renderScheduleView();
      });
      strength.appendChild(strengthLabel);
      strength.appendChild(strengthRange);
      strength.appendChild(strengthValue);

      pop.appendChild(title);
      pop.appendChild(grid);
      pop.appendChild(customRow);
      pop.appendChild(strength);

      document.body.appendChild(pop);
      subjectColorPopover = pop;

      const rect = anchorEl.getBoundingClientRect();
      const popRect = pop.getBoundingClientRect();
      const margin = 8;
      const left = Math.min(
        window.innerWidth - popRect.width - margin,
        Math.max(margin, rect.left - popRect.width / 2 + rect.width / 2)
      );
      const top = Math.min(window.innerHeight - popRect.height - margin, rect.bottom + 8);
      pop.style.left = `${left}px`;
      pop.style.top = `${top}px`;

      // Close on outside click / Escape.
      const onDocClick = () => closeSubjectColorPopover();
      const onKey = (e) => {
        if (e.key !== "Escape") return;
        closeSubjectColorPopover();
      };
      setTimeout(() => {
        document.addEventListener("click", onDocClick, { once: true });
        document.addEventListener("keydown", onKey, { once: true });
      }, 0);
    }

    let subjectSettingsState = null; // { subjectId }
    let subjectSettingsTempColor = null;

    function closeSubjectSettingsModal() {
      subjectSettingsState = null;
      subjectSettingsTempColor = null;
      if (subjectSettingsBackdrop) {
        subjectSettingsBackdrop.hidden = true;
        subjectSettingsBackdrop.style.display = "none";
      }
    }

    function renderSubjectSettingsSwatches(selectedColor) {
      if (!subjectSettingsSwatches) return;
      subjectSettingsSwatches.innerHTML = "";
      const colors = getSubjectSwatches();
      colors.forEach((c) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "subject-swatch-btn";
        btn.style.background = c;
        btn.title = c;
        if (String(c).toLowerCase() === String(selectedColor).toLowerCase()) {
          btn.classList.add("is-selected");
        }
        btn.addEventListener("click", () => {
          subjectSettingsTempColor = c;
          if (subjectSettingsCustomColor) subjectSettingsCustomColor.value = c;
          updateSubjectSettingsPreview();
        });
        subjectSettingsSwatches.appendChild(btn);
      });
    }

    function updateSubjectSettingsPreview() {
      if (subjectSettingsDot && subjectSettingsTempColor) {
        subjectSettingsDot.style.backgroundColor = subjectSettingsTempColor;
      }
      if (subjectSettingsColorLabel && subjectSettingsTempColor) {
        subjectSettingsColorLabel.textContent = subjectSettingsTempColor;
      }
    }

    function openSubjectSettingsModal(subjectId) {
      if (!subjectSettingsBackdrop) return;
      const idx = subjects.findIndex((s) => s.id === subjectId);
      if (idx === -1) return;
      const subj = subjects[idx];

      subjectSettingsState = { subjectId };
      subjectSettingsTempColor = isHexColor(subj.color) ? subj.color : getSubjectColor(idx);

      if (subjectSettingsNameInput) {
        subjectSettingsNameInput.value = subj.name || "";
        subjectSettingsNameInput.focus();
        subjectSettingsNameInput.select?.();
      }
      if (subjectSettingsCustomColor) subjectSettingsCustomColor.value = subjectSettingsTempColor;
      if (subjectSettingsStrength) {
        subjectSettingsStrength.value = String(getSubjectTintAlphaById(subjectId));
      }

      renderSubjectSettingsSwatches(subjectSettingsTempColor);
      updateSubjectSettingsPreview();

      subjectSettingsBackdrop.hidden = false;
      subjectSettingsBackdrop.style.display = "flex";
    }

    function showToast(message, tone = "info") {
      if (!toastContainer) return;
      const toast = document.createElement("div");
      toast.className = "toast toast-" + tone;
      toast.textContent = message;
      toastContainer.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add("toast-visible"));
      setTimeout(() => {
        toast.classList.remove("toast-visible");
        setTimeout(() => toast.remove(), 200);
      }, 2200);
    }

    function showNotice(message, tone = "info", onConfirm = null) {
      if (!noticeModalBackdrop || !noticeModalMessage || !noticeModalTitle) {
        showToast(message, tone);
        return;
      }
      noticeConfirmHandler = typeof onConfirm === "function" ? onConfirm : null;
      noticeModalTitle.textContent = tone === "warn" ? "Heads up" : tone === "success" ? "Done" : "Notice";
      noticeModalMessage.textContent = message;
      noticeModalBackdrop.hidden = false;
      noticeModalBackdrop.style.display = "flex";
    }

    function closeNotice() {
      if (!noticeModalBackdrop) return;
      noticeModalBackdrop.style.display = "none";
      noticeModalBackdrop.hidden = true;
      if (noticeResolver) {
        noticeResolver(null);
        noticeResolver = null;
      }
      noticeConfirmHandler = null;
    }

    function openHeaderMenu() {
      if (headerMenuTimer) {
        clearTimeout(headerMenuTimer);
        headerMenuTimer = null;
      }
      headerMenu?.classList.add("header-menu-open");
      headerMenuToggle?.setAttribute("aria-expanded", "true");
    }

    function closeHeaderMenu() {
      if (headerMenuTimer) {
        clearTimeout(headerMenuTimer);
        headerMenuTimer = null;
      }
      headerMenu?.classList.remove("header-menu-open");
      headerMenuToggle?.setAttribute("aria-expanded", "false");
    }

    function scheduleCloseHeaderMenu() {
      if (headerMenuTimer) {
        clearTimeout(headerMenuTimer);
      }
      headerMenuTimer = setTimeout(() => {
        closeHeaderMenu();
      }, 2000);
    }

    function openSettingsModal() {
      if (!settingsModal) return;
      settingsModal.classList.add("is-open");
      settingsModal.setAttribute("aria-hidden", "false");
      renderSettingsThemeList();
      renderSettingsColorsList();
      populateSettingsColorsControls();
      populateSettingsPreferences();
      renderSettingsPreview();
    }

    function closeSettingsModal() {
      if (!settingsModal) return;
      settingsModal.classList.remove("is-open");
      settingsModal.setAttribute("aria-hidden", "true");
    }

    function setActiveSettingsPanel(panelId) {
      if (!settingsNav) return;
      settingsNav.querySelectorAll(".settings-nav-item").forEach((btn) => {
        const target = btn.dataset.panel;
        if (target === panelId) {
          btn.classList.add("settings-nav-active");
        } else {
          btn.classList.remove("settings-nav-active");
        }
      });
      const panels = [settingsThemePanel, settingsColorsPanel, settingsPrefsPanel];
      panels.forEach((panel) => {
        if (!panel) return;
        if (panel.id === panelId) {
          panel.classList.add("settings-panel-active");
        } else {
          panel.classList.remove("settings-panel-active");
        }
      });
    }

    function renderSettingsThemeList() {
      const list = document.getElementById("settingsThemeList");
      if (!list) return;
      list.innerHTML = "";
      THEMES.forEach((theme) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "settings-theme-item" + (theme.id === activeTheme ? " settings-theme-active" : "");
        btn.dataset.theme = theme.id;
        const dot = document.createElement("span");
        dot.className = "settings-theme-dot";
        dot.style.setProperty("--swatch", theme.swatch);
        const text = document.createElement("div");
        text.className = "settings-theme-text";
        const name = document.createElement("div");
        name.className = "settings-theme-name";
        name.textContent = theme.name;
        const sub = document.createElement("div");
        sub.className = "settings-theme-subtitle";
        sub.textContent = theme.subtitle;
        text.appendChild(name);
        text.appendChild(sub);
        btn.appendChild(dot);
        btn.appendChild(text);
        btn.addEventListener("click", () => {
          applyTheme(theme.id);
          renderSettingsThemeList();
        });
        list.appendChild(btn);
      });
    }

    function renderSettingsColorsList() {
      const list = document.getElementById("settingsColorsList");
      if (!list) return;
      list.innerHTML = "";
      const palette = Array.isArray(subjectColors) && subjectColors.length
        ? subjectColors
        : DEFAULT_SUBJECT_COLORS;
      const rows = subjects.length
        ? subjects.map((s, idx) => ({
            label: s.name || `Subject ${idx + 1}`,
            color: palette[idx % palette.length]
          }))
        : palette.map((color, idx) => ({
            label: `Color ${idx + 1}`,
            color
          }));

      rows.forEach((rowData, idx) => {
        const row = document.createElement("div");
        row.className = "settings-color-row";
        const label = document.createElement("div");
        label.className = "settings-color-label";
        label.textContent = rowData.label;
        const input = document.createElement("input");
        input.type = "color";
        input.value = rowData.color;
        input.className = "settings-color-input";
        input.dataset.index = String(idx);
        input.addEventListener("input", () => {
          subjectColors[idx] = input.value;
        });
        row.appendChild(label);
        row.appendChild(input);
        list.appendChild(row);
      });
    }

    function renderSettingsPreview() {
      const meterFill = document.getElementById("settingsPreviewMeterFill");
      const studyBar = document.getElementById("settingsPreviewStudyBar");
      const tempPrefs = getTempStylePrefsFromControls();
      const tempMeterBase = deriveMeterBase(tempPrefs);
      if (meterFill) {
        const color =
          65 < 50
            ? mixColors(tempMeterBase.low, tempMeterBase.mid, 65 / 50)
            : mixColors(tempMeterBase.mid, tempMeterBase.high, (65 - 50) / 50);
        meterFill.style.background = `linear-gradient(90deg, ${color}, ${color})`;
        meterFill.style.width = "65%";
      }
      if (studyBar) {
        studyBar.innerHTML = "";
        const segments = [
          { color: getSubjectColor(0), width: 45 },
          { color: getSubjectColor(1), width: 35 },
          { color: getSubjectColor(2), width: 20 }
        ];
        const barStyle = STUDY_BAR_STYLES[tempPrefs.studyBar] || STUDY_BAR_STYLES.rounded;
        studyBar.style.background = barStyle.bg;
        studyBar.style.borderRadius = barStyle.radius;
        segments.forEach((seg) => {
          const div = document.createElement("div");
          div.className = "summary-study-segment";
          div.style.width = seg.width + "%";
          div.style.background = seg.color;
          studyBar.appendChild(div);
        });
      }
    }

    function getTempStylePrefsFromControls() {
      const meterSelect = document.getElementById("settingsMeterStyleSelect");
      const barSelect = document.getElementById("settingsStudyBarStyleSelect");
      const meterSingle = document.getElementById("settingsMeterSingleInput");
      const meterGradStart = document.getElementById("settingsMeterGradStartInput");
      const meterGradEnd = document.getElementById("settingsMeterGradEndInput");
      const contrastSelect = document.getElementById("settingsContrastSelect");
      const cvdSelect = document.getElementById("settingsCvdSelect");
      return {
        ...stylePrefs,
        meter: meterSelect ? meterSelect.value : stylePrefs.meter,
        studyBar: barSelect ? barSelect.value : stylePrefs.studyBar,
        meterSingle: meterSingle ? meterSingle.value : stylePrefs.meterSingle,
        meterGradStart: meterGradStart ? meterGradStart.value : stylePrefs.meterGradStart,
        meterGradEnd: meterGradEnd ? meterGradEnd.value : stylePrefs.meterGradEnd,
        contrast: contrastSelect ? contrastSelect.value : stylePrefs.contrast,
        cvd: cvdSelect ? cvdSelect.value : stylePrefs.cvd
      };
    }

    function toggleExpand() {
      expandState = !expandState;
      if (expandState) {
        appRoot.classList.add("app-expanded");
        expandPageBtn.textContent = "⤡";
        document.body.style.overflow = "auto";
      } else {
        appRoot.classList.remove("app-expanded");
        expandPageBtn.textContent = "⤢";
        document.body.style.overflow = "hidden";
      }
      enforceTodayHeight();
    }

    function toggleSubjectsMaximize(force) {
      subjectsMaximized = typeof force === "boolean" ? force : !subjectsMaximized;
      if (subjectsMaximized) {
        // fill the viewport and hide Today so subjects take the whole row
        appRoot.classList.add("app-expanded");
        appRoot.classList.add("subjects-maximized");
        layoutRow?.classList.add("today-full");
        if (todaySidebar) todaySidebar.style.display = "none";
        expandState = true;
        if (expandPageBtn) expandPageBtn.textContent = "⤡";
        document.body.style.overflow = "auto";
      } else {
        appRoot.classList.remove("subjects-maximized");
        if (layoutRow) layoutRow.classList.remove("today-full");
        if (todaySidebar) todaySidebar.style.display = "";
        // If the user had not expanded the page manually, restore default body overflow
        if (!todayExpanded && !expandState) {
          document.body.style.overflow = "hidden";
          if (expandPageBtn) expandPageBtn.textContent = "⤢";
        }
      }
      applyTodayExpandedLayout();
      renderTable();
      renderTodayTodos();
      enforceTodayHeight();
    }

    function populateSettingsPreferences() {
      const lang = loadLanguagePreference();
      const langSelect = document.getElementById("settingsLanguageSelect");
      if (langSelect) langSelect.value = lang;
      const contrastSelect = document.getElementById("settingsContrastSelect");
      if (contrastSelect) contrastSelect.value = stylePrefs.contrast || "normal";
      const cvdSelect = document.getElementById("settingsCvdSelect");
      if (cvdSelect) cvdSelect.value = stylePrefs.cvd || "none";
      const study = document.getElementById("settingsStudyMinutes");
      const short = document.getElementById("settingsShortMinutes");
      const long = document.getElementById("settingsLongMinutes");
      if (study) study.value = pomoConfig.study;
      if (short) short.value = pomoConfig.short;
      if (long) long.value = pomoConfig.long;
    }

    function populateSettingsColorsControls() {
      const meterSelect = document.getElementById("settingsMeterStyleSelect");
      const barSelect = document.getElementById("settingsStudyBarStyleSelect");
      if (meterSelect) meterSelect.value = stylePrefs.meter || "classic";
      if (barSelect) barSelect.value = stylePrefs.studyBar || "rounded";
      const meterSingle = document.getElementById("settingsMeterSingleInput");
      const meterGradStart = document.getElementById("settingsMeterGradStartInput");
      const meterGradEnd = document.getElementById("settingsMeterGradEndInput");
      if (meterSingle) meterSingle.value = stylePrefs.meterSingle || "#f97373";
      if (meterGradStart) meterGradStart.value = stylePrefs.meterGradStart || "#f97373";
      if (meterGradEnd) meterGradEnd.value = stylePrefs.meterGradEnd || "#22c55e";
    }

    function openNoticePrompt(title, placeholder, onSubmit) {
      if (!noticeModalBackdrop || !noticeModalMessage || !noticeModalTitle) {
        const value = prompt(title || "Enter value", placeholder || "");
        onSubmit(value);
        return;
      }
      noticeModalTitle.textContent = title || "Input";
      noticeModalMessage.innerHTML =
        '<input id="noticePromptInput" class="notice-input" type="text" placeholder="' +
        escapeHtml(placeholder || "") +
        '" />';
      const input = document.getElementById("noticePromptInput");
      noticeModalBackdrop.hidden = false;
      noticeModalBackdrop.style.display = "flex";
      input.focus();
      return new Promise((resolve) => {
        noticeResolver = resolve;
        const submit = () => {
          const val = input.value;
          closeNotice();
          onSubmit(val);
          resolve(val);
        };
        const listener = (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        };
        input.addEventListener("keydown", listener, { once: true });
        noticeModalConfirmBtn.onclick = submit;
      });
    }

    function hexToRgba(hex, alpha) {
      if (!hex) return "";
      let h = hex.replace("#", "");
      if (h.length === 3) {
        h = h
          .split("")
          .map((c) => c + c)
          .join("");
      }
      const int = parseInt(h, 16);
      if (Number.isNaN(int)) return "";
      const r = (int >> 16) & 255;
      const g = (int >> 8) & 255;
      const b = int & 255;
      return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
    }

    function dateKeyToMs(key) {
      const t = new Date(key + "T00:00:00").getTime();
      return Number.isNaN(t) ? null : t;
    }

    // Daily history compaction:
    // Instead of storing large `{ 'YYYY-MM-DD': value }` objects for every file,
    // store a packed string to reduce JS heap overhead (no history is deleted).
    //
    // Format: "dayId:value,dayId:value" where both numbers are base36.
    // dayId is UTC day number for the YYYY-MM-DD date string.
    const DAY_MS = 24 * 60 * 60 * 1000;

    function dateKeyToDayId(key) {
      const raw = String(key || "");
      const parts = raw.split("-");
      if (parts.length !== 3) return null;
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);
      if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
      if (year < 1970 || month < 1 || month > 12 || day < 1 || day > 31) return null;
      const ms = Date.UTC(year, month - 1, day);
      const dayId = Math.floor(ms / DAY_MS);
      return Number.isFinite(dayId) ? dayId : null;
    }

    function dayIdToDateKey(dayId) {
      const ms = Number(dayId) * DAY_MS;
      if (!Number.isFinite(ms)) return null;
      const d = new Date(ms);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    }

    function getTodayDayId() {
      return dateKeyToDayId(getTodayKey());
    }

    function parsePackedPairs(packed) {
      const out = new Map();
      const raw = String(packed || "").trim();
      if (!raw) return out;
      const parts = raw.split(",");
      for (const part of parts) {
        if (!part) continue;
        const idx = part.indexOf(":");
        if (idx === -1) continue;
        const k = part.slice(0, idx);
        const v = part.slice(idx + 1);
        const dayId = parseInt(k, 36);
        const val = parseInt(v, 36);
        if (!Number.isFinite(dayId) || !Number.isFinite(val)) continue;
        if (val <= 0) continue;
        out.set(dayId, val);
      }
      return out;
    }

    function packPairs(map) {
      if (!(map instanceof Map) || map.size === 0) return "";
      const entries = [...map.entries()].filter(([, v]) => (Number(v) || 0) > 0);
      entries.sort((a, b) => a[0] - b[0]);
      return entries.map(([k, v]) => `${k.toString(36)}:${Math.round(v).toString(36)}`).join(",");
    }

    function packLegacyDayObject(obj) {
      if (!obj || typeof obj !== "object") return "";
      const map = new Map();
      for (const [key, val] of Object.entries(obj)) {
        const dayId = dateKeyToDayId(key);
        if (dayId === null) continue;
        const num = Math.round(Number(val) || 0);
        if (num <= 0) continue;
        map.set(dayId, num);
      }
      return packPairs(map);
    }

    function packedGet(packed, dayId) {
      if (!packed) return 0;
      const target = Number(dayId);
      if (!Number.isFinite(target)) return 0;
      const raw = String(packed || "").trim();
      if (!raw) return 0;
      const parts = raw.split(",");
      for (const part of parts) {
        if (!part) continue;
        const idx = part.indexOf(":");
        if (idx === -1) continue;
        const k = part.slice(0, idx);
        if (parseInt(k, 36) !== target) continue;
        const v = part.slice(idx + 1);
        return Math.round(Number.parseInt(v, 36) || 0);
      }
      return 0;
    }

    function packedAdd(packed, dayId, delta) {
      const d = Math.round(Number(delta) || 0);
      if (!d) return String(packed || "");
      const target = Number(dayId);
      if (!Number.isFinite(target)) return String(packed || "");
      const map = parsePackedPairs(packed);
      map.set(target, (map.get(target) || 0) + d);
      return packPairs(map);
    }

    function ensureDailyPacked(file) {
      if (!file || typeof file !== "object") return;
      if (file.dailyMs && typeof file.dailyMs === "object") {
        if (!file.dailyMsPacked) file.dailyMsPacked = packLegacyDayObject(file.dailyMs);
        delete file.dailyMs;
      }
      if (file.dailySessions && typeof file.dailySessions === "object") {
        if (!file.dailySessionsPacked) file.dailySessionsPacked = packLegacyDayObject(file.dailySessions);
        delete file.dailySessions;
      }
    }

    function sumPackedInRange(packed, range) {
      if (!packed) return 0;
      if (range === "all") return 0;
      const todayId = getTodayDayId();
      if (todayId === null) return 0;
      let windowDays = 7;
      if (range === "day") windowDays = 1;
      else if (range === "month") windowDays = 30;
      const startId = todayId - (windowDays - 1);
      const endId = todayId;
      let sum = 0;
      const raw = String(packed || "").trim();
      if (!raw) return 0;
      const parts = raw.split(",");
      for (const part of parts) {
        if (!part) continue;
        const idx = part.indexOf(":");
        if (idx === -1) continue;
        const dayId = parseInt(part.slice(0, idx), 36);
        if (!Number.isFinite(dayId)) continue;
        if (dayId < startId || dayId > endId) continue;
        const val = parseInt(part.slice(idx + 1), 36);
        if (!Number.isFinite(val)) continue;
        sum += val;
      }
      return sum;
    }

    function msInRange(ms, range) {
      if (range === "all") return true;
      const dayMs = 24 * 60 * 60 * 1000;
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ).getTime();
      let windowDays = 7;
      if (range === "day") windowDays = 1;
      else if (range === "month") windowDays = 30;
      const windowStart = todayStart - (windowDays - 1) * dayMs;
      return ms >= windowStart && ms <= todayStart + dayMs;
    }

    function totalMsForRange(file, range) {
      if (!file) return 0;
      if (range === "all") {
        return file.totalMs || 0;
      }
      let sum = 0;
      if (file.dailyMsPacked) {
        sum += sumPackedInRange(file.dailyMsPacked, range);
      } else if (file.dailyMs && typeof file.dailyMs === "object") {
        for (const [key, val] of Object.entries(file.dailyMs)) {
          const t = dateKeyToMs(key);
          if (t === null) continue;
          if (msInRange(t, range)) {
            sum += Number(val) || 0;
          }
        }
      }
      return sum;
    }

    function totalSessionsForRange(file, range) {
      if (!file) return 0;
      if (range === "all") {
        return file.sessions || 0;
      }
      let sum = 0;
      if (file.dailySessionsPacked) {
        sum += sumPackedInRange(file.dailySessionsPacked, range);
      } else if (file.dailySessions && typeof file.dailySessions === "object") {
        for (const [key, val] of Object.entries(file.dailySessions)) {
          const t = dateKeyToMs(key);
          if (t === null) continue;
          if (msInRange(t, range)) {
            sum += Number(val) || 0;
          }
        }
      }
      return sum;
    }

    function saveToStorage() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(subjects));
      } catch (e) {}
    }

    function saveActiveSession() {
      try {
        if (!activeStudy) {
          localStorage.removeItem(ACTIVE_SESSION_KEY);
          return;
        }
        activeStudy.savedAtMs = Date.now();
        localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(activeStudy));
      } catch (e) {}
    }

    function clearActiveSession() {
      try {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      } catch (e) {}
    }

    function loadActiveSession() {
      try {
        const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        if (parsed.kind !== "study" && parsed.kind !== "break") return null;
        if (typeof parsed.baseMs !== "number" || typeof parsed.paused !== "boolean") return null;
        if (typeof parsed.targetMs !== "number") return null;

        // Validate study references.
        if (parsed.kind === "study") {
          if (!parsed.subjectId || !parsed.fileId) return null;
          const { subj, file } = resolveFileRef(parsed.subjectId, parsed.fileId);
          if (!subj || !file) return null;
          if (!parsed.timerMode) parsed.timerMode = timerModePref || "countdown";
        }

        // Keep persisted running timers running across reloads.

        if (parsed.pausedReason === "nav" && typeof parsed.autoResume !== "boolean") {
          parsed.autoResume = true;
        }

        return parsed;
      } catch (e) {
        return null;
      }
    }

    function pauseActiveSession(reason = "manual", { autoResume = false } = {}) {
      if (!activeStudy || activeStudy.paused) return false;
      const now = Date.now();
      const delta = now - Number(activeStudy.startTimeMs || 0);
      if (Number.isFinite(delta) && delta > 0) {
        activeStudy.baseMs = (Number(activeStudy.baseMs) || 0) + delta;
      }
      activeStudy.startTimeMs = null;
      activeStudy.paused = true;
      activeStudy.pausedReason = reason;
      activeStudy.autoResume = !!autoResume;
      activeStudy.pausedAtMs = now;
      saveActiveSession();
      return true;
    }

    function resumeActiveSession({ clearNavFlags = true } = {}) {
      if (!activeStudy || !activeStudy.paused) return false;
      activeStudy.startTimeMs = Date.now();
      activeStudy.paused = false;
      if (clearNavFlags) {
        activeStudy.pausedReason = null;
        activeStudy.autoResume = false;
        activeStudy.pausedAtMs = null;
      }
      saveActiveSession();
      return true;
    }

    function saveDailyFocusMap() {
      try {
        localStorage.setItem(DAILY_FOCUS_KEY, JSON.stringify(dailyFocusMap));
      } catch (e) {}
    }

    function loadDailyFocusMap() {
      try {
        const raw = localStorage.getItem(DAILY_FOCUS_KEY);
        if (!raw) {
          dailyFocusMap = {};
          return;
        }
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          dailyFocusMap = parsed;
        }
      } catch (e) {
        dailyFocusMap = {};
      }
    }

    function loadFromStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        subjects = data;
      subjects.forEach((subj) => {
        if (!Array.isArray(subj.files)) subj.files = [];
        if (!subj.sortMode) subj.sortMode = "manual";
        if (!Array.isArray(subj.manualOrder)) {
          subj.manualOrder = subj.files.map((f) => f.id);
        }
        subj.files.forEach((file) => {
          ensureDailyPacked(file);
          if (typeof file.totalMs !== "number") file.totalMs = 0;
          if (typeof file.sessions !== "number") file.sessions = 0;
          if (typeof file.lastSessionMs !== "number") file.lastSessionMs = 0;
        });
      });
        }
      } catch (e) {
        subjects = [];
      }
    }

    function cloneTodos(list) {
      return (Array.isArray(list) ? list : []).map((t) => ({
        id: t.id,
        subjectId: t.subjectId,
        fileId: t.fileId,
        label: t.label || "",
        subjectName: t.subjectName || "",
        done: !!t.done,
        subtasks: Array.isArray(t.subtasks)
          ? t.subtasks
              .filter((s) => s && s.id && s.label !== undefined)
              .map((s) => ({
                id: s.id,
                label: s.label,
                done: !!s.done
              }))
          : []
      }));
    }

    function saveTodayTodos() {
      try {
        localStorage.setItem(TODO_KEY, JSON.stringify(todayTodos));
      } catch (e) {}
      const key = getTodayKey();
      dailyFocusMap[key] = cloneTodos(todayTodos);
      saveDailyFocusMap();
    }

    function loadTodayTodos() {
      const todayKey = getTodayKey();
      let seeded = false;

      if (
        dailyFocusMap &&
        typeof dailyFocusMap === "object" &&
        Array.isArray(dailyFocusMap[todayKey])
      ) {
        todayTodos = cloneTodos(dailyFocusMap[todayKey]);
        seeded = true;
      }

      if (seeded) return;

      try {
        const raw = localStorage.getItem(TODO_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          todayTodos = cloneTodos(data.filter((t) => t && t.id && t.subjectId && t.fileId));
          dailyFocusMap[todayKey] = cloneTodos(todayTodos);
          saveDailyFocusMap();
        }
      } catch (e) {
        todayTodos = [];
      }
    }

    function saveFocusConfig() {
      try {
        localStorage.setItem(
          CONFIG_KEY,
          JSON.stringify({ pomoConfig, weeklyTargetMinutes })
        );
      } catch (e) {}
    }

    function loadFocusConfig() {
      try {
        const raw = localStorage.getItem(CONFIG_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data) return;
        if (data.pomoConfig) {
          if (typeof data.pomoConfig.study === "number")
            pomoConfig.study = data.pomoConfig.study;
          if (typeof data.pomoConfig.short === "number")
            pomoConfig.short = data.pomoConfig.short;
          if (typeof data.pomoConfig.long === "number")
            pomoConfig.long = data.pomoConfig.long;
        }
        if (typeof data.weeklyTargetMinutes === "number") {
          weeklyTargetMinutes = data.weeklyTargetMinutes;
        }
      } catch (e) {}
    }

    function loadStylePrefs() {
      try {
        const raw = localStorage.getItem(STYLE_PREF_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          if (parsed.meter) stylePrefs.meter = parsed.meter;
          if (parsed.studyBar) stylePrefs.studyBar = parsed.studyBar;
          if (parsed.contrast) stylePrefs.contrast = parsed.contrast;
          if (parsed.cvd) stylePrefs.cvd = parsed.cvd;
        }
      } catch (e) {}
    }

    function saveStylePrefs() {
      try {
        localStorage.setItem(STYLE_PREF_KEY, JSON.stringify(stylePrefs));
      } catch (e) {}
    }

