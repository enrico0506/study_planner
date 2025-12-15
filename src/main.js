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
	    const openReelsBreakBtn = document.getElementById("openReelsBreakBtn");
	    const suggestionModalBackdrop = document.getElementById("suggestionModalBackdrop");
	    const suggestionModalCloseBtn = document.getElementById("suggestionModalCloseBtn");
	    const suggestionModalCloseBtn2 = document.getElementById("suggestionModalCloseBtn2");
	    const reelsBreakModalBackdrop = document.getElementById("reelsBreakModalBackdrop");
	    const reelsBreakCloseBtn = document.getElementById("reelsBreakCloseBtn");
	    const reelsBreakEndBtn = document.getElementById("reelsBreakEndBtn");
	    const reelsBreakOpenInstagramBtn = document.getElementById("reelsBreakOpenInstagramBtn");
	    const reelsBreakOpenInstagramBtn2 = document.getElementById("reelsBreakOpenInstagramBtn2");
	    const reelsBreakLoadBtn = document.getElementById("reelsBreakLoadBtn");
	    const reelsBreakUrlInput = document.getElementById("reelsBreakUrlInput");
	    const reelsBreakIframe = document.getElementById("reelsBreakIframe");
	    const reelsBreakCountdown = document.getElementById("reelsBreakCountdown");
	    const reelsBreakFrame = document.getElementById("reelsBreakFrame");
	    const reelsBreakStatus = document.getElementById("reelsBreakStatus");
	    const reelsBreakHint = document.getElementById("reelsBreakHint");
	    const reelsBreakEmbedError = document.getElementById("reelsBreakEmbedError");
	    const reelsBreakAdvancedDetails = document.getElementById("reelsBreakAdvancedDetails");
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
		    let reelsBreakTimer = null;
		    let reelsBreakEndsAt = 0;
		    let reelsBreakWindow = null;
		    let reelsBreakEmbedLoadTimer = null;
		    let reelsBreakEmbedLoaded = false;
		    let reelsBreakEndHandled = false;
		    const REELS_BREAK_DURATION_MS = 5 * 60 * 1000;
		    const DEFAULT_REEL_URLS = [
		      "https://www.instagram.com/reel/C4fGJc7s7lB/",
		      "https://www.instagram.com/reel/C2yqXf1MZr1/",
		      "https://www.instagram.com/reel/C1a9kMZrH9p/"
		    ];

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

    function deriveMeterBase(prefs) {
      const cvd = prefs?.cvd || "none";
      if (cvd === "safe") {
        // Okabe-Ito inspired (avoid red/green confusion)
        return { low: "#D55E00", mid: "#E69F00", high: "#0072B2" };
      }
      if (prefs.meter === "single") {
        const c = prefs.meterSingle || "#f97373";
        return { low: c, mid: c, high: c };
      }
      if (prefs.meter === "customGradient") {
        const start = prefs.meterGradStart || "#f97373";
        const end = prefs.meterGradEnd || "#22c55e";
        const mid = mixColors(start, end, 0.5);
        return { low: start, mid, high: end };
      }
      const baseMap = {
        classic: { low: "#fb7185", mid: "#fbbf24", high: "#22c55e" },
        flat: { low: "#ef4444", mid: "#f59e0b", high: "#10b981" },
        stripe: { low: "#fb7185", mid: "#fbbf24", high: "#22c55e" }
      };
      return baseMap[prefs.meter] || baseMap.classic;
    }

    function applyStylePrefs(prefs = {}) {
      stylePrefs = { ...stylePrefs, ...prefs };
      meterBaseColors = deriveMeterBase(stylePrefs);

      const contrast = stylePrefs.contrast || "normal";
      document.documentElement.setAttribute("data-contrast", contrast);
      const cvd = stylePrefs.cvd || "none";
      document.documentElement.setAttribute("data-cvd", cvd);

      let meter = METER_STYLES[stylePrefs.meter];
      if (stylePrefs.meter === "single") {
        const c = stylePrefs.meterSingle || "#f97373";
        meter = { low: c, mid: c, high: c };
      } else if (stylePrefs.meter === "customGradient") {
        const start = stylePrefs.meterGradStart || "#f97373";
        const end = stylePrefs.meterGradEnd || "#22c55e";
        const mid = mixColors(start, end, 0.5);
        meter = {
          low: `linear-gradient(90deg, ${start}, ${mixColors(start, end, 0.25)})`,
          mid: `linear-gradient(90deg, ${start}, ${mid})`,
          high: `linear-gradient(90deg, ${mid}, ${end})`
        };
      }
      if (!meter) meter = METER_STYLES.classic;
      const bar = STUDY_BAR_STYLES[stylePrefs.studyBar] || STUDY_BAR_STYLES.rounded;
      const root = document.documentElement.style;
      root.setProperty("--meter-low", meter.low);
      root.setProperty("--meter-mid", meter.mid);
      root.setProperty("--meter-high", meter.high);
      root.setProperty("--study-bar-bg", bar.bg);
      root.setProperty("--study-bar-radius", bar.radius);
    }

    function loadLanguagePreference() {
      try {
        const raw = localStorage.getItem(LANGUAGE_KEY);
        if (!raw) return "en";
        const val = String(raw);
        return val || "en";
      } catch (e) {
        return "en";
      }
    }

    function saveLanguagePreference(lang) {
      const value = lang || "en";
      try {
        localStorage.setItem(LANGUAGE_KEY, value);
      } catch (e) {}
      document.documentElement.setAttribute("lang", value);
    }

    function loadColorPalette() {
      try {
        const raw = localStorage.getItem(COLOR_PALETTE_KEY);
        if (!raw) {
          subjectColors = [...DEFAULT_SUBJECT_COLORS];
          return;
        }
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.every((c) => typeof c === "string" && c.trim().length)) {
          subjectColors = arr;
        }
      } catch (e) {
        subjectColors = [...DEFAULT_SUBJECT_COLORS];
      }
    }

    function saveColorPalette(colors) {
      subjectColors = colors && Array.isArray(colors) && colors.length ? colors : [...DEFAULT_SUBJECT_COLORS];
      try {
        localStorage.setItem(COLOR_PALETTE_KEY, JSON.stringify(subjectColors));
      } catch (e) {}
    }

    function getThemeById(themeId) {
      return THEMES.find((t) => t.id === themeId) || THEMES[0];
    }

    function renderThemeMenu() {
      if (!themeMenu) return;
      themeMenu.innerHTML = "";
      THEMES.forEach((theme) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "theme-option" + (theme.id === activeTheme ? " theme-option-active" : "");
        btn.dataset.theme = theme.id;
        btn.innerHTML =
          '<span class="theme-option-dot" style="background:' +
          theme.swatch +
          '"></span><span><span class="theme-option-name">' +
          escapeHtml(theme.name) +
          '</span><span class="theme-option-subtitle">' +
          escapeHtml(theme.subtitle) +
          "</span></span>";
        btn.addEventListener("click", () => {
          applyTheme(theme.id);
          closeThemeMenu();
          themeToggleBtn?.focus();
        });
        themeMenu.appendChild(btn);
      });
    }

    function applyTheme(themeId, options = {}) {
      const theme = getThemeById(themeId);
      activeTheme = theme.id;
      document.documentElement.setAttribute("data-theme", activeTheme);
      if (themeLabel) themeLabel.textContent = theme.name;
      if (themeDot) themeDot.style.background = theme.swatch;
      if (themeMenu) {
        themeMenu.querySelectorAll(".theme-option").forEach((btn) => {
          btn.classList.toggle("theme-option-active", btn.dataset.theme === activeTheme);
        });
      }
      if (!options.skipSave) {
        try {
          localStorage.setItem(THEME_KEY, activeTheme);
        } catch (e) {}
      }
    }

    function openThemeMenu() {
      if (!themeMenu) return;
      renderThemeMenu();
      themeMenu.hidden = false;
      themeMenu.style.display = "grid";
      themeMenuOpen = true;
      if (themeToggleBtn) {
        themeToggleBtn.setAttribute("aria-expanded", "true");
      }
    }

    function closeThemeMenu() {
      themeMenuOpen = false;
      if (!themeMenu) return;
      themeMenu.hidden = true;
      themeMenu.style.display = "none";
      if (themeToggleBtn) {
        themeToggleBtn.setAttribute("aria-expanded", "false");
      }
    }

    function loadThemePreference() {
      let stored = null;
      try {
        stored = localStorage.getItem(THEME_KEY);
      } catch (e) {}
      const fallback =
        document.documentElement.getAttribute("data-theme") || activeTheme || "breeze";
      applyTheme(stored || fallback, { skipSave: true });
      renderThemeMenu();
    }

    function createId() {
      return Math.random().toString(36).slice(2, 10);
    }

    function confidenceClass(value) {
      if (value < 40) return "conf-low";
      if (value < 75) return "conf-mid";
      return "conf-high";
    }

    function confidenceLabel(value) {
      if (value < 40) return "Low";
      if (value < 75) return "Medium";
      return "High";
    }

    function meterClass(value) {
      if (value < 40) return "meter-low";
      if (value < 75) return "meter-mid";
      return "meter-high";
    }

    function meterGradient(value) {
      const clamped = Math.max(0, Math.min(100, value));
      const base = meterBaseColors || { low: "#fb7185", mid: "#fbbf24", high: "#22c55e" };
      const low = base.low || "#fb7185";
      const mid = base.mid || low;
      const high = base.high || mid;
      const color =
        clamped < 50
          ? mixColors(low, mid, clamped / 50)
          : mixColors(mid, high, (clamped - 50) / 50);
      return `linear-gradient(90deg, ${color}, ${color})`;
    }

    function mixColors(a, b, t = 0.5) {
      const parse = (hex) => {
        if (typeof hex !== "string") return [0, 0, 0];
        const h = hex.replace("#", "");
        const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
        const int = parseInt(v, 16);
        if (Number.isNaN(int)) return [0, 0, 0];
        return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
      };
      const c1 = parse(a);
      const c2 = parse(b);
      const mix = (i) => Math.round(c1[i] + (c2[i] - c1[i]) * t);
      return (
        "#" +
        mix(0).toString(16).padStart(2, "0") +
        mix(1).toString(16).padStart(2, "0") +
        mix(2).toString(16).padStart(2, "0")
      );
    }

    function formatLocalDateKey(date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    function getTodayKey() {
      return formatLocalDateKey(new Date());
    }

    function dateToKey(date) {
      if (!(date instanceof Date)) return null;
      return formatLocalDateKey(date);
    }

    function getWeekStart(date) {
      const d = new Date(date);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day; // Monday as start
      d.setDate(d.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      return d;
    }

    function parseCalendarDate(key) {
      const [y, m, d] = (key || "").split("-").map((v) => parseInt(v, 10));
      if (!y || !m || !d) return null;
      const date = new Date(y, m - 1, d);
      if (Number.isNaN(date.getTime())) return null;
      date.setHours(0, 0, 0, 0);
      return date;
    }

    function loadCalendarEvents() {
      try {
        const raw = localStorage.getItem(CALENDAR_KEY);
        if (!raw) {
          calendarEvents = [];
          return;
        }
        const parsed = JSON.parse(raw);
        calendarEvents = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        calendarEvents = [];
      }
    }

    function getUpcomingCalendarEvents(windowDays = 5) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const horizon = new Date(now);
      horizon.setDate(horizon.getDate() + windowDays);
      return (calendarEvents || [])
        .filter((evt) => {
          if (!evt || evt.done) return false;
          const date = parseCalendarDate(evt.date);
          if (!date) return false;
          return date >= now && date <= horizon;
        })
        .map((evt) => {
          const date = parseCalendarDate(evt.date);
          const diffDays = date
            ? Math.round((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
            : null;
          return { ...evt, dueInDays: diffDays };
        })
        .sort((a, b) => {
          const ad = a.dueInDays ?? 999;
          const bd = b.dueInDays ?? 999;
          if (ad === bd) {
            const pa = a.priority || "normal";
            const pb = b.priority || "normal";
            if (pa === pb) return (a.title || "").localeCompare(b.title || "");
            const order = { critical: 0, important: 1, normal: 2 };
            return (order[pa] ?? 2) - (order[pb] ?? 2);
          }
          return ad - bd;
        });
    }

    function reviewIntervalDays(confidence) {
      const c = Number(confidence) || 0;
      if (c < 30) return 1;
      if (c < 50) return 2;
      if (c < 70) return 4;
      if (c < 85) return 7;
      return 12;
    }

    function computeSpacedQueue() {
      const results = [];
      const dayMs = 24 * 60 * 60 * 1000;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      subjects.forEach((subj, subjIndex) => {
        (subj.files || []).forEach((file) => {
          const interval = reviewIntervalDays(file.confidence);
          const last = file.lastReviewed ? new Date(file.lastReviewed) : null;
          const next =
            last && !Number.isNaN(last.getTime())
              ? new Date(last.getTime() + interval * dayMs)
              : today;
          const dueInDays = Math.floor((next.getTime() - today.getTime()) / dayMs);
          const idleDays =
            last && !Number.isNaN(last.getTime())
              ? Math.floor((today.getTime() - last.getTime()) / dayMs)
              : null;
          results.push({
            subj,
            subjIndex,
            file,
            dueInDays,
            idleDays,
            nextDate: next
          });
        });
      });

      results.sort((a, b) => {
        if (a.dueInDays !== b.dueInDays) return a.dueInDays - b.dueInDays;
        const ac = Number(a.file.confidence) || 0;
        const bc = Number(b.file.confidence) || 0;
        return ac - bc;
      });
      return results;
    }

    function computeDailyCapCount() {
      if (!weeklyTargetMinutes || !Number.isFinite(weeklyTargetMinutes)) return null;
      const dailyMinutes = weeklyTargetMinutes / 7;
      const perItem = Math.max(10, Number(pomoConfig.study) || 25);
      const cap = Math.max(1, Math.round(dailyMinutes / perItem));
      return cap;
    }

    function isInTodayList(subjectId, fileId) {
      return todayTodos.some(
        (t) => t.subjectId === subjectId && t.fileId === fileId
      );
    }

    function addDailyStudyForFile(file, ms) {
      if (!ms || ms <= 0) return;
      ensureDailyPacked(file);
      const dayId = getTodayDayId();
      if (dayId === null) return;
      if (file.dailyMsPacked) {
        file.dailyMsPacked = packedAdd(file.dailyMsPacked, dayId, ms);
      } else if (file.dailyMs && typeof file.dailyMs === "object") {
        const key = getTodayKey();
        file.dailyMs[key] = (file.dailyMs[key] || 0) + ms;
      } else {
        // In case history was never initialized and we don't want an object.
        file.dailyMsPacked = packedAdd("", dayId, ms);
      }
    }

    function addDailySessionForFile(file) {
      if (!file) return;
      ensureDailyPacked(file);
      const dayId = getTodayDayId();
      if (dayId === null) return;
      if (file.dailySessionsPacked) {
        file.dailySessionsPacked = packedAdd(file.dailySessionsPacked, dayId, 1);
      } else if (file.dailySessions && typeof file.dailySessions === "object") {
        const key = getTodayKey();
        file.dailySessions[key] = (file.dailySessions[key] || 0) + 1;
      } else {
        file.dailySessionsPacked = packedAdd("", dayId, 1);
      }
    }

    function formatTimeAgo(isoString) {
      if (!isoString) return "Never revised";
      const t = new Date(isoString).getTime();
      if (Number.isNaN(t)) return "Never revised";

      let diff = Date.now() - t;
      if (diff < 0) diff = 0;

      const minute = 60 * 1000;
      const hour = 60 * minute;
      const day = 24 * hour;
      const week = 7 * day;
      const month = 30 * day;
      const year = 365 * day;

      if (diff < minute) return "just now";
      if (diff < hour) {
        const m = Math.floor(diff / minute);
        return m + " min ago";
      }
      if (diff < day) {
        const h = Math.floor(diff / hour);
        return h + " h ago";
      }
      if (diff < week) {
        const d = Math.floor(diff / day);
        return d + " d ago";
      }
      if (diff < month) {
        const w = Math.floor(diff / week);
        return w + " w ago";
      }
      if (diff < year) {
        const mo = Math.floor(diff / month);
        return mo + " mo ago";
      }
      const y = Math.floor(diff / year);
      return y + " y ago";
    }

    function formatDuration(ms) {
      if (!ms || ms <= 0) return "0 min";
      const totalSec = Math.floor(ms / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const parts = [];
      if (h > 0) parts.push(h + " h");
      if (m > 0) parts.push(m + " min");
      if (parts.length === 0) return "less than 1 min";
      return parts.join(" ");
    }

    function formatHMS(ms) {
      const totalSec = Math.max(0, Math.floor(ms / 1000));
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const ss = String(s).padStart(2, "0");
      return `${hh}:${mm}:${ss}`;
    }

    function formatHoursCompact(ms) {
      if (!ms || ms <= 0) return "0h";
      const hours = ms / (60 * 60 * 1000);
      if (hours >= 10) return Math.round(hours) + "h";
      if (hours >= 1) return Math.round(hours * 10) / 10 + "h";
      const minutes = Math.round(ms / (60 * 1000));
      return minutes + " min";
    }

    function getDailyTotalsMap(includeActiveToday = false) {
      const totals = {};
      subjects.forEach((subj) => {
        (subj.files || []).forEach((file) => {
          if (file.dailyMsPacked) {
            const map = parsePackedPairs(file.dailyMsPacked);
            map.forEach((val, dayId) => {
              const key = dayIdToDateKey(dayId);
              if (!key) return;
              totals[key] = (totals[key] || 0) + (Number(val) || 0);
            });
          } else if (file.dailyMs && typeof file.dailyMs === "object") {
            for (const [key, val] of Object.entries(file.dailyMs)) {
              const v = Number(val) || 0;
              if (v <= 0) continue;
              totals[key] = (totals[key] || 0) + v;
            }
          } 
        });
      });

      if (
        includeActiveToday &&
        activeStudy &&
        activeStudy.kind === "study" &&
        activeStudy.startTimeMs
      ) {
        const key = getTodayKey();
        totals[key] = (totals[key] || 0) + computeElapsedMs(activeStudy);
      }

      return totals;
    }

    function sumLastNDays(totals, days) {
      if (!totals || typeof totals !== "object") return 0;
      let sum = 0;
      const today = new Date();
      for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = dateToKey(d);
        sum += Number(totals[key]) || 0;
      }
      return sum;
    }

    function computeStreakStats(totals, thresholdMinutes = STREAK_THRESHOLD_MINUTES) {
      const thresholdMs = Math.max(1, thresholdMinutes) * 60 * 1000;
      const dayMs = 24 * 60 * 60 * 1000;
      const activeDays = [];
      Object.entries(totals || {}).forEach(([key, val]) => {
        const ts = dateKeyToMs(key);
        if (ts === null) return;
        if ((Number(val) || 0) >= thresholdMs) {
          activeDays.push(ts);
        }
      });

      if (!activeDays.length) return { current: 0, best: 0 };

      activeDays.sort((a, b) => a - b);
      let best = 0;
      let streak = 0;
      let prev = null;
      activeDays.forEach((ts) => {
        if (prev !== null && Math.abs(ts - prev - dayMs) <= 1000) {
          streak += 1;
        } else {
          streak = 1;
        }
        if (streak > best) best = streak;
        prev = ts;
      });

      let current = 0;
      const todayStart = dateKeyToMs(getTodayKey());
      if (todayStart !== null) {
        let cursor = todayStart;
        while (true) {
          const key = dateToKey(new Date(cursor));
          const val = totals ? totals[key] || 0 : 0;
          if (val >= thresholdMs) {
            current += 1;
            cursor -= dayMs;
          } else {
            break;
          }
        }
      }

      return { current, best };
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function computeElapsedMs(session) {
      if (!session) return 0;
      let elapsed = session.baseMs || 0;
      if (!session.paused && session.startTimeMs) {
        elapsed += Date.now() - session.startTimeMs;
      }
      if (elapsed < 0) elapsed = 0;
      return elapsed;
    }

    function isActiveStudy(subjId, fileId) {
      return (
        activeStudy &&
        activeStudy.kind === "study" &&
        activeStudy.subjectId === subjId &&
        activeStudy.fileId === fileId
      );
    }

    function resolveFileRef(subjectId, fileId) {
      const subj = subjects.find((s) => s.id === subjectId) || null;
      if (!subj) return { subj: null, file: null };
      const file = subj.files.find((f) => f.id === fileId) || null;
      return { subj, file };
    }

    function computePerceivedConfidence(file) {
      if (!file) return 0;
      const base = Number(file.confidence) || 0;
      const totalMs = Number(file.totalMs) || 0;
      const sessions = Number(file.sessions) || 0;
      const last = file.lastReviewed ? new Date(file.lastReviewed).getTime() : null;
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const idleDays = last ? Math.max(0, (now - last) / dayMs) : 30;
      const effortBoost = Math.min(25, Math.log1p(totalMs / (30 * 60 * 1000)) * 15); // up to ~25 pts
      const sessionBoost = Math.min(15, Math.log1p(sessions) * 6); // up to ~15 pts
      const decay = Math.min(30, Math.log1p(idleDays) * 6); // penalty up to ~30
      const perceived = base + effortBoost + sessionBoost - decay;
      return Math.max(0, Math.min(100, Math.round(perceived)));
    }

    function displayConfidence(file) {
      return confidenceMode === "perceived" ? computePerceivedConfidence(file) : Number(file.confidence) || 0;
    }

    function computeTodayStudyBySubject() {
      const key = getTodayKey();
      const dayId = dateKeyToDayId(key);
      const results = [];

      subjects.forEach((subj, subjIndex) => {
        let ms = 0;
        (subj.files || []).forEach((file) => {
          if (dayId !== null && file.dailyMsPacked) {
            ms += packedGet(file.dailyMsPacked, dayId);
          } else if (file.dailyMs && file.dailyMs[key]) {
            ms += file.dailyMs[key];
          } 
        });
        results.push({ subj, subjIndex, ms });
      });

      if (activeStudy && activeStudy.kind === "study" && activeStudy.subjectId) {
        const idx = subjects.findIndex((s) => s.id === activeStudy.subjectId);
        if (idx !== -1) {
          results[idx].ms += computeElapsedMs(activeStudy);
        }
      }

      const perSubject = results.filter((r) => r.ms > 0);
      const totalMs = perSubject.reduce((sum, r) => sum + r.ms, 0);
      return { perSubject, totalMs };
    }

    function enforceTodayHeight() {
      if (!todaySidebar) return;
      if (layoutRow && layoutRow.classList.contains("today-full")) {
        todaySidebar.style.maxHeight = "";
        todaySidebar.style.height = "";
        const list = document.getElementById("todayList");
        if (list) {
          list.style.maxHeight = "";
          list.style.overflowY = "";
        }
        return;
      }
      const tableH = tableWrapper ? (tableWrapper.clientHeight || tableWrapper.offsetHeight || 0) : 0;
      const mainH = mainArea ? (mainArea.clientHeight || mainArea.offsetHeight || 0) : 0;
      const layoutH = layoutRow ? (layoutRow.clientHeight || layoutRow.offsetHeight || 0) : 0;
      const available =
        (tableH && mainH ? Math.min(tableH, mainH) : tableH || mainH) || layoutH || 0;
      if (!available) return;
      todaySidebar.style.maxHeight = available + "px";
      todaySidebar.style.height = available + "px";
      const list = document.getElementById("todayList");
      const header = todaySidebar.querySelector(".today-header");
      const drop = document.getElementById("todayDropZone");
      const headerH = header ? header.offsetHeight : 0;
      const dropH = drop ? drop.offsetHeight : 0;
      const padding = 60;
      if (list) {
        const listAvailable = available - headerH - dropH - padding;
        list.style.maxHeight = Math.max(180, listAvailable) + "px";
        list.style.overflowY = "auto";
      }
    }

    function updateTodayStudyUI() {
      if (!summaryStudyTodayLabel || !summaryStudyBar || !summaryStudyLegend) return;

      const { perSubject, totalMs } = computeTodayStudyBySubject();

      summaryStudyTodayLabel.textContent = totalMs
        ? formatDuration(totalMs)
        : "0 min";

      summaryStudyBar.innerHTML = "";
      summaryStudyLegend.innerHTML = "";

      if (!totalMs || !perSubject.length) {
        const emptyBar = document.createElement("div");
        emptyBar.style.width = "100%";
        emptyBar.style.height = "100%";
        emptyBar.style.background = "#e5e7eb";
        summaryStudyBar.appendChild(emptyBar);
        return;
      }

	      perSubject.forEach(({ subj, subjIndex, ms }) => {
	        const width = (ms * 100) / totalMs;
	        const subjectColor = getSubjectColorById(subj?.id) || getSubjectColor(subjIndex);

	        const seg = document.createElement("div");
	        seg.className = "summary-study-segment";
	        seg.style.width = width + "%";
	        seg.style.background = subjectColor;
	        summaryStudyBar.appendChild(seg);

        const legendItem = document.createElement("div");
	        legendItem.className = "summary-study-legend-item";
	        const swatch = document.createElement("span");
	        swatch.className = "summary-study-legend-swatch";
	        swatch.style.backgroundColor = subjectColor;
	        const label = document.createElement("span");
	        label.textContent = subj.name;
	        legendItem.appendChild(swatch);
        legendItem.appendChild(label);
        summaryStudyLegend.appendChild(legendItem);
      });
    }

    function updateGoalsAndStreaks() {
      if (
        !weeklyGoalProgressLabel ||
        !weeklyGoalTotalLabel ||
        !weeklyGoalFill ||
        !weeklyGoalHint ||
        !streakCurrentLabel ||
        !streakBestLabel
      )
        return;

      const totals = getDailyTotalsMap(true);
      const weekMs = sumLastNDays(totals, 7);
      const goalMs = Math.max(0, weeklyTargetMinutes || 0) * 60 * 1000;
      const pct = goalMs > 0 ? Math.min(100, (weekMs * 100) / goalMs) : 0;

      weeklyGoalProgressLabel.textContent = formatHoursCompact(weekMs);
      weeklyGoalTotalLabel.textContent = goalMs ? formatHoursCompact(goalMs) : "0h";
      weeklyGoalFill.style.width = goalMs ? pct + "%" : "0%";
      const remaining = goalMs - weekMs;
      if (!goalMs) {
        weeklyGoalHint.textContent = "Set a target to get a weekly rhythm.";
      } else if (remaining > 0) {
        weeklyGoalHint.textContent = formatDuration(remaining) + " left this week.";
      } else {
        weeklyGoalHint.textContent = "Goal met—keep compounding time!";
      }

      const { current, best } = computeStreakStats(totals);
      streakCurrentLabel.textContent = current + " day" + (current === 1 ? "" : "s");
      streakBestLabel.textContent = "Best " + (best || 0);
    }

    function updateSummary() {
      const totalSubjects = subjects.length;
      let totalFiles = 0;
      let lowCount = 0;
      let sumConf = 0;

      for (const subj of subjects) {
        for (const file of subj.files || []) {
          totalFiles++;
          const c = displayConfidence(file);
          sumConf += c;
          if (c < 40) lowCount++;
        }
      }

      const avg = totalFiles ? Math.round(sumConf / totalFiles) : 0;

      summarySubjects.textContent = totalSubjects;
      summaryFiles.textContent = totalFiles;
      summaryLow.textContent = lowCount;
      summaryConfLabel.textContent = avg + "%";

      summaryConfFill.classList.remove("meter-low", "meter-mid", "meter-high");
      const targetClass = meterClass(avg);
      summaryConfFill.classList.add(targetClass);
      summaryConfFill.style.width = (totalFiles ? avg : 0) + "%";
      summaryConfFill.style.background = meterGradient(avg);

      updateTodayStudyUI();
      updateGoalsAndStreaks();
    }

    function matchFileForEvent(evt) {
      if (!evt || !evt.title) return null;
      const text = (evt.title || "").toLowerCase();
      let best = null;
      subjects.forEach((subj, subjIndex) => {
        const subjName = (subj.name || "").toLowerCase();
        const subjHit = subjName && text.includes(subjName);
        (subj.files || []).forEach((file) => {
          const name = (file.name || "").toLowerCase();
          let score = 0;
          if (name && text.includes(name)) score += 3;
          if (subjHit) score += 2;
          if (!score && name) {
            const tokenHit = name
              .split(/\s+/)
              .filter((w) => w.length >= 4)
              .some((w) => text.includes(w));
            if (tokenHit) score += 1;
          }
          if (score > 0 && (!best || score > best.score)) {
            best = { subj, subjIndex, file, score };
          }
        });
      });
      return best;
    }

    function buildSmartSuggestions() {
      const suggestions = [];
      const queue = computeSpacedQueue();
      const dayMs = 24 * 60 * 60 * 1000;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      queue.forEach((item) => {
        if (!item || !item.subj || !item.file) return;
        if (isInTodayList(item.subj.id, item.file.id)) return;
        const conf = Number(item.file.confidence) || 0;
        const last = item.file.lastReviewed ? new Date(item.file.lastReviewed) : null;
        const idle =
          last && !Number.isNaN(last.getTime())
            ? Math.floor((today.getTime() - last.getTime()) / dayMs)
            : null;
        const needsSoon = item.dueInDays <= 1 || idle === null;
        if (conf < 45 || needsSoon) {
          suggestions.push({
            kind: "low",
            subjectId: item.subj.id,
            fileId: item.file.id,
            subjectName: item.subj.name,
            title: item.file.name || "Untitled file",
            confidence: conf,
            dueInDays: item.dueInDays,
            subjIndex: item.subjIndex
          });
        }
      });

      getUpcomingCalendarEvents(7).forEach((evt) => {
        const match = matchFileForEvent(evt);
        if (!match || !match.subj || !match.file) return;
        if (isInTodayList(match.subj.id, match.file.id)) return;
        suggestions.push({
          kind: "deadline",
          subjectId: match.subj.id,
          fileId: match.file.id,
          subjectName: match.subj.name,
          title: match.file.name || evt.title || "Calendar item",
          dueInDays: evt.dueInDays,
          eventTitle: evt.title,
          subjIndex: match.subjIndex,
          confidence: Number(match.file.confidence) || 0
        });
      });

      suggestions.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "deadline" ? -1 : 1;
        if (a.kind === "deadline") {
          const ad = a.dueInDays ?? 999;
          const bd = b.dueInDays ?? 999;
          if (ad === bd) return (a.confidence || 0) - (b.confidence || 0);
          return ad - bd;
        }
        return (a.confidence || 0) - (b.confidence || 0);
      });

      return suggestions.slice(0, 3);
    }

    function renderSmartSuggestions() {
      if (!suggestionsList) return;

      const cap = computeDailyCapCount();
      if (suggestionsCapNote) {
        if (cap) {
          const weeklyMs = Math.max(0, weeklyTargetMinutes || 0) * 60 * 1000;
          suggestionsCapNote.textContent =
            "Daily cap: " +
            cap +
            " items (" +
            todayTodos.length +
            "/" +
            cap +
            " today, weekly target " +
            formatHoursCompact(weeklyMs) +
            ").";
        } else {
          suggestionsCapNote.textContent = "";
        }
      }

      const items = buildSmartSuggestions();
      suggestionsList.innerHTML = "";

      if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "suggestion-empty";
        empty.textContent = "No smart suggestions right now.";
        suggestionsList.appendChild(empty);
        return;
      }

      const capReached = cap && todayTodos.length >= cap;

      items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "suggestion-card";

        const left = document.createElement("div");
        left.className = "suggestion-left";

        const dot = document.createElement("span");
        dot.className = "suggestion-dot";
        dot.style.backgroundColor = getSubjectColorById(item.subjectId);

        const text = document.createElement("div");
        text.className = "suggestion-text";

        const title = document.createElement("div");
        title.className = "suggestion-title";
        title.textContent = item.title;

        const meta = document.createElement("div");
        meta.className = "suggestion-meta";
        const dueLabel =
          typeof item.dueInDays === "number"
            ? item.dueInDays < 0
              ? Math.abs(item.dueInDays) + "d overdue"
              : item.dueInDays === 0
              ? "due today"
              : "in " + item.dueInDays + "d"
            : null;
        const baseMeta =
          (item.subjectName || "Subject") +
          " · " +
          (typeof item.confidence === "number"
            ? (confidenceMode === "perceived"
                ? computePerceivedConfidence(item.file || { confidence: item.confidence, totalMs: 0, sessions: 0, lastReviewed: null })
                : item.confidence) + "% conf"
            : "");
        meta.textContent = dueLabel ? baseMeta + " · " + dueLabel : baseMeta;

        text.appendChild(title);
        text.appendChild(meta);

        left.appendChild(dot);
        left.appendChild(text);

        const actions = document.createElement("div");
        actions.className = "suggestion-actions";

        const badge = document.createElement("div");
        badge.className = "suggestion-badge";
        badge.textContent = item.kind === "deadline" ? "Calendar" : "Low confidence";

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "chip-btn chip-btn-primary";
        const already = isInTodayList(item.subjectId, item.fileId);
        addBtn.textContent = already ? "In Today" : capReached ? "Cap reached" : "Add";
        addBtn.disabled = already || capReached;
        addBtn.addEventListener("click", () => {
          if (cap && todayTodos.length >= cap) {
            showNotice("Daily cap reached based on your weekly target.", "warn");
            return;
          }
          const added = addTodoForFile(item.subjectId, item.fileId);
          if (added) {
            showToast("Added to Today.", "success");
          } else {
            showNotice("Already in Today's focus.", "info");
          }
        });

        actions.appendChild(badge);
        actions.appendChild(addBtn);

        card.appendChild(left);
        card.appendChild(actions);
        suggestionsList.appendChild(card);
      });
    }

    function renderDueSoonLane() {
      if (!dueSoonList) return;

      const queue = computeSpacedQueue();
      const items = queue.filter((item) => item && item.dueInDays <= 3).slice(0, 4);
      dueSoonList.innerHTML = "";
      if (dueSoonHint) {
        dueSoonHint.textContent = items.length
          ? "Next " + items.length + " due"
          : "Clear for now";
      }

      if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "due-soon-empty";
        empty.textContent = "No spaced-review items due soon.";
        dueSoonList.appendChild(empty);
        return;
      }

      const cap = computeDailyCapCount();
      const capReached = cap && todayTodos.length >= cap;

      items.forEach((item) => {
        const chip = document.createElement("div");
        chip.className = "due-chip";

        const dot = document.createElement("span");
        dot.className = "due-chip-dot";
        dot.style.backgroundColor = getSubjectColor(item.subjIndex);

        const text = document.createElement("div");
        text.className = "due-chip-text";

        const label = document.createElement("div");
        label.className = "due-chip-label";
        label.textContent = item.file.name || "Untitled file";

        const meta = document.createElement("div");
        meta.className = "due-chip-meta";
        const dueBadge = document.createElement("span");
        dueBadge.className = "due-chip-due";
        const dueLabel =
          item.dueInDays < 0
            ? Math.abs(item.dueInDays) + "d overdue"
            : item.dueInDays === 0
            ? "Due today"
            : "In " + item.dueInDays + "d";
        dueBadge.textContent = dueLabel;
        meta.textContent =
          (item.subj && item.subj.name ? item.subj.name : "Subject") +
          " · " +
          (typeof item.file.confidence === "number" ? item.file.confidence + "% conf" : "");
        meta.appendChild(dueBadge);

        text.appendChild(label);
        text.appendChild(meta);

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "due-chip-add";
        const already = isInTodayList(item.subj.id, item.file.id);
        addBtn.textContent = already ? "In Today" : capReached ? "Cap reached" : "Add";
        addBtn.disabled = already || capReached;
        addBtn.addEventListener("click", () => {
          if (cap && todayTodos.length >= cap) {
            showNotice("Daily cap reached based on your weekly target.", "warn");
            return;
          }
          const added = addTodoForFile(item.subj.id, item.file.id);
          if (added) showToast("Added to Today.", "success");
        });

        chip.appendChild(dot);
        chip.appendChild(text);
        chip.appendChild(addBtn);
        dueSoonList.appendChild(chip);
      });
    }

    function openSuggestionModal() {
      if (!suggestionModalBackdrop) return;
      loadCalendarEvents();
      renderSmartSuggestions();
      renderDueSoonLane();
      suggestionModalBackdrop.hidden = false;
      suggestionModalBackdrop.style.display = "flex";
    }

	    function closeSuggestionModal() {
	      if (!suggestionModalBackdrop) return;
	      suggestionModalBackdrop.hidden = true;
	      suggestionModalBackdrop.style.display = "none";
	    }

		    function isReelsBreakOpen() {
		      return Boolean(reelsBreakModalBackdrop && reelsBreakModalBackdrop.hidden === false);
		    }

		    function setReelsBreakStatus(message) {
		      if (!reelsBreakStatus) return;
		      reelsBreakStatus.textContent = message;
		    }

		    function setReelsBreakHint(message) {
		      if (!reelsBreakHint) return;
		      reelsBreakHint.textContent = message || "";
		      reelsBreakHint.hidden = !message;
		    }

		    function formatClockMMSS(totalSeconds) {
		      const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
		      const minutes = Math.floor(safe / 60);
		      const seconds = safe % 60;
		      return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
		    }

		    function stopReelsBreakTimer() {
		      if (!reelsBreakTimer) return;
		      clearInterval(reelsBreakTimer);
		      reelsBreakTimer = null;
		    }

		    function clearReelsEmbed() {
		      reelsBreakEmbedLoaded = false;
		      if (reelsBreakEmbedLoadTimer) {
		        clearTimeout(reelsBreakEmbedLoadTimer);
		        reelsBreakEmbedLoadTimer = null;
		      }
		      if (reelsBreakIframe) reelsBreakIframe.src = "";
		      reelsBreakFrame?.classList.remove("reels-loaded");
		      if (reelsBreakFrame) reelsBreakFrame.hidden = true;
		      if (reelsBreakEmbedError) reelsBreakEmbedError.hidden = true;
		    }

		    function extractInstagramShortcode(rawInput) {
		      const input = (rawInput || "").trim();
		      if (!input) return null;

		      const looksLikeShortcode = /^[A-Za-z0-9_-]{5,40}$/.test(input);
		      if (looksLikeShortcode) return input;

		      let url;
		      try {
		        url = new URL(
		          input.startsWith("http://") || input.startsWith("https://") ? input : "https://" + input
		        );
		      } catch {
		        return null;
		      }

		      if (!/instagram\.com$/i.test(url.hostname) && !/\\.instagram\\.com$/i.test(url.hostname)) {
		        return null;
		      }

		      const parts = url.pathname.split("/").filter(Boolean);
		      if (parts.length < 2) return null;
		      const type = parts[0];
		      const shortcode = parts[1];
		      if (!["reel", "reels", "p", "tv"].includes(type)) return null;
		      if (!/^[A-Za-z0-9_-]{5,40}$/.test(shortcode)) return null;
		      return shortcode;
		    }

		    function scheduleEmbedFailureIfNoLoad() {
		      if (reelsBreakEmbedLoadTimer) clearTimeout(reelsBreakEmbedLoadTimer);
		      reelsBreakEmbedLoadTimer = window.setTimeout(() => {
		        if (reelsBreakEmbedLoaded) return;
		        if (reelsBreakEmbedError) reelsBreakEmbedError.hidden = false;
		        setReelsBreakStatus("Reel embed might be blocked. Use Instagram Reels instead.");
		      }, 10_000);
		    }

		    function loadReelsEmbedFromUrl(rawUrl, { remember = true } = {}) {
		      const shortcode = extractInstagramShortcode(rawUrl);
		      if (!shortcode) {
		        showToast("Paste a valid Instagram Reel link.", "warn");
		        return false;
		      }

		      const embedUrl = "https://www.instagram.com/reel/" + shortcode + "/embed";
		      reelsBreakEmbedLoaded = false;
		      if (reelsBreakEmbedError) reelsBreakEmbedError.hidden = true;
		      if (reelsBreakFrame) reelsBreakFrame.hidden = false;
		      reelsBreakFrame?.classList.remove("reels-loaded");
		      if (reelsBreakIframe) reelsBreakIframe.src = embedUrl;
		      scheduleEmbedFailureIfNoLoad();
		      setReelsBreakStatus("Showing embedded reel.");

		      if (remember) localStorage.setItem("reelsBreakLastUrl", rawUrl);
		      return true;
		    }

		    function loadReelsEmbedFromInput() {
		      if (!reelsBreakUrlInput) return;
		      const raw = (reelsBreakUrlInput.value || "").trim();
		      loadReelsEmbedFromUrl(raw, { remember: true });
		    }

		    // Browser limitations:
		    // - window.open can be blocked by popup blockers if not called directly from a user click.
		    // - Closing tabs/windows is only allowed for windows opened by script (and may still fail).
		    function openInstagramReelsWindow() {
		      const url = "https://www.instagram.com/reels/";
		      if (reelsBreakWindow && !reelsBreakWindow.closed) {
		        reelsBreakWindow.focus?.();
		        return true;
		      }
		      const opened = window.open(url, "_blank");
		      if (!opened) return false;
		      reelsBreakWindow = opened;
		      try {
		        reelsBreakWindow.opener = null;
		      } catch {
		        // Best-effort only.
		      }
		      return true;
		    }

		    function tryCloseInstagramReelsWindow() {
		      if (!reelsBreakWindow) return true;
		      try {
		        reelsBreakWindow.close();
		      } catch {
		        // Best-effort only.
		      }
		      const closed = Boolean(reelsBreakWindow.closed);
		      if (closed) reelsBreakWindow = null;
		      return closed;
		    }

		    function pickDefaultReelUrl() {
		      if (!Array.isArray(DEFAULT_REEL_URLS) || DEFAULT_REEL_URLS.length === 0) return "";
		      const idx = Math.floor(Math.random() * DEFAULT_REEL_URLS.length);
		      return DEFAULT_REEL_URLS[idx] || DEFAULT_REEL_URLS[0];
		    }

		    function startDefaultEmbedMode() {
		      const chosen = pickDefaultReelUrl();
		      if (reelsBreakUrlInput) reelsBreakUrlInput.value = chosen;
		      setReelsBreakHint("Popup blocked. Allow popups to use your Instagram session.");
		      clearReelsEmbed();
		      loadReelsEmbedFromUrl(chosen, { remember: false });
		    }

		    function updateReelsBreakCountdown() {
		      if (!reelsBreakCountdown) return;
		      const remainingMs = Math.max(0, reelsBreakEndsAt - Date.now());
		      const remainingSeconds = Math.ceil(remainingMs / 1000);
		      reelsBreakCountdown.textContent = formatClockMMSS(remainingSeconds);

		      if (remainingSeconds <= 10 && reelsBreakWindow && !reelsBreakWindow.closed) {
		        setReelsBreakHint("If the Instagram tab doesn’t close automatically, please close it manually.");
		      }

		      if (remainingMs <= 0) {
		        handleReelsBreakTimeout();
		      }
		    }

		    function handleReelsBreakTimeout() {
		      if (reelsBreakEndHandled) return;
		      reelsBreakEndHandled = true;
		      stopReelsBreakTimer();
		      reelsBreakEndsAt = 0;
		      if (reelsBreakCountdown) reelsBreakCountdown.textContent = "00:00";

		      const closedOk = tryCloseInstagramReelsWindow();
		      if (!closedOk && reelsBreakWindow) {
		        setReelsBreakStatus("Break finished. Please close the Instagram tab/window to end the break.");
		        setReelsBreakHint("Browsers may block closing tabs, even if they were opened by this site.");
		        return;
		      }

		      closeReelsBreakModal();
		      showToast("Reels break finished.", "info");
		    }

		    function openReelsBreakModal() {
		      if (!reelsBreakModalBackdrop) return;
		      closeHeaderMenu();

		      reelsBreakEndHandled = false;
		      setReelsBreakHint("");
		      if (reelsBreakEmbedError) reelsBreakEmbedError.hidden = true;
		      if (reelsBreakAdvancedDetails) reelsBreakAdvancedDetails.open = false;

		      reelsBreakEndsAt = Date.now() + REELS_BREAK_DURATION_MS;
		      stopReelsBreakTimer();
		      reelsBreakTimer = window.setInterval(updateReelsBreakCountdown, 250);

		      reelsBreakModalBackdrop.hidden = false;
		      reelsBreakModalBackdrop.style.display = "flex";

		      const opened = openInstagramReelsWindow();
		      if (opened) {
		        clearReelsEmbed();
		        setReelsBreakStatus("Reels break running in Instagram.");
		      } else {
		        setReelsBreakStatus("Popup blocked — showing an embedded reel instead.");
		        startDefaultEmbedMode();
		      }

		      updateReelsBreakCountdown();
		    }

		    function endReelsBreakNow() {
		      stopReelsBreakTimer();
		      reelsBreakEndsAt = 0;
		      const closedOk = tryCloseInstagramReelsWindow();
		      closeReelsBreakModal();
		      if (!closedOk && reelsBreakWindow) {
		        showToast("Please close the Instagram tab/window to end the break.", "warn");
		      }
		    }

		    function closeReelsBreakModal() {
		      if (!reelsBreakModalBackdrop) return;
		      reelsBreakModalBackdrop.hidden = true;
		      reelsBreakModalBackdrop.style.display = "none";
		      reelsBreakEndsAt = 0;
		      reelsBreakEndHandled = false;
		      stopReelsBreakTimer();
		      clearReelsEmbed();
		      setReelsBreakHint("");
		      setReelsBreakStatus("Reels break ready.");
		    }

	    function addTodoForFile(subjectId, fileId, subtaskTexts) {
	      const { subj, file } = resolveFileRef(subjectId, fileId);
	      if (!subj || !file) return false;

      const already = todayTodos.some(
        (t) => t.subjectId === subjectId && t.fileId === fileId
      );
      if (already) return false;

      const subtasks = Array.isArray(subtaskTexts)
        ? subtaskTexts
            .map((txt) => (txt || "").trim())
            .filter(Boolean)
            .map((txt) => ({ id: createId(), label: txt, done: false }))
        : [];

      todayTodos.unshift({
        id: createId(),
        subjectId,
        fileId,
        label: file.name || "Untitled file",
        subjectName: subj.name || "Subject",
        done: false,
        subtasks
      });
      saveTodayTodos();
      renderTodayTodos();
      return true;
    }

    function renderAddTodoSubtasks() {
      if (!addTodoSubtaskList || !addTodoModalState) return;
      addTodoSubtaskList.innerHTML = "";
      if (!addTodoModalState.subtasks.length) return;
      addTodoModalState.subtasks.forEach((label, idx) => {
        const chip = document.createElement("div");
        chip.className = "subtask-chip";
        const text = document.createElement("span");
        text.textContent = label;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "subtask-chip-remove";
        remove.textContent = "✕";
        remove.addEventListener("click", () => {
          addTodoModalState.subtasks.splice(idx, 1);
          renderAddTodoSubtasks();
        });
        chip.appendChild(text);
        chip.appendChild(remove);
        addTodoSubtaskList.appendChild(chip);
      });
    }

    function addSubtaskFromInput() {
      if (!addTodoModalState || !addTodoSubtaskInput) return;
      const txt = addTodoSubtaskInput.value.trim();
      if (!txt) return;
      addTodoModalState.subtasks.push(txt);
      addTodoSubtaskInput.value = "";
      renderAddTodoSubtasks();
    }

    function openAddTodoModal(subjectId, file) {
      const subj = subjects.find((s) => s.id === subjectId);
      addTodoModalState = {
        subjectId,
        fileId: file.id,
        subjectName: subj ? subj.name || "Subject" : "Subject",
        fileName: file.name || "Untitled file",
        subtasks: []
      };
      if (addTodoModalTitle) addTodoModalTitle.textContent = "Add to Today";
      if (addTodoModalSubtitle) {
        addTodoModalSubtitle.textContent = `${addTodoModalState.fileName} · ${addTodoModalState.subjectName}`;
      }
      if (addTodoSubtaskInput) addTodoSubtaskInput.value = "";
      renderAddTodoSubtasks();
      if (addTodoModalBackdrop) {
        addTodoModalBackdrop.hidden = false;
        addTodoModalBackdrop.style.display = "flex";
      }
      addTodoSubtaskInput?.focus();
    }

    function closeAddTodoModal() {
      addTodoModalState = null;
      if (addTodoModalBackdrop) {
        addTodoModalBackdrop.hidden = true;
        addTodoModalBackdrop.style.display = "none";
      }
    }

    function submitAddTodoModal() {
      if (!addTodoModalState) {
        closeAddTodoModal();
        return;
      }
      const subtasks = addTodoModalState.subtasks || [];
      const added = addTodoForFile(addTodoModalState.subjectId, addTodoModalState.fileId, subtasks);
      if (!added) {
        showNotice("Already in Today’s Focus.", "info");
      } else {
        showNotice("Added to Today’s Focus.", "success");
      }
      closeAddTodoModal();
      renderTable();
      renderTodayTodos();
    }

    function cleanupTodosForSubject(subjectId) {
      const before = todayTodos.length;
      todayTodos = todayTodos.filter((t) => t.subjectId !== subjectId);
      if (todayTodos.length !== before) {
        saveTodayTodos();
        renderTodayTodos();
      }
    }

    function cleanupTodoForFile(subjectId, fileId) {
      const before = todayTodos.length;
      todayTodos = todayTodos.filter(
        (t) => !(t.subjectId === subjectId && t.fileId === fileId)
      );
      if (todayTodos.length !== before) {
        saveTodayTodos();
        renderTodayTodos();
      }
    }

    function renameSubjectEverywhere(subjectId, newName) {
      let changed = false;
      todayTodos.forEach((t) => {
        if (t.subjectId === subjectId) {
          t.subjectName = newName;
          changed = true;
        }
      });
      Object.values(dailyFocusMap || {}).forEach((list) => {
        if (!Array.isArray(list)) return;
        list.forEach((t) => {
          if (t && t.subjectId === subjectId) {
            t.subjectName = newName;
            changed = true;
          }
        });
      });
      if (changed) {
        saveTodayTodos();
        saveDailyFocusMap();
      }
    }

    function promptConfidenceUpdateForFile(subjectId, fileId) {
      const { file } = resolveFileRef(subjectId, fileId);
      if (!file) return;
      const current = Number(file.confidence) || 0;
      openNoticePrompt("Update confidence (0–100)", String(current), (value) => {
        const raw = String(value ?? "").trim();
        if (!raw) return;
        const n = Math.round(Number(raw));
        if (!Number.isFinite(n)) {
          showNotice("Please enter a number between 0 and 100.", "warn");
          return;
        }
        const clamped = Math.max(0, Math.min(100, n));
        file.confidence = clamped;
        saveToStorage();
        renderTable();
        renderSmartSuggestions();
        updateSummary();
        renderTodayTodos();
        renderScheduleView();
      });
    }

    function toggleTodoDone(todoId, checked, { promptConfidence = false } = {}) {
      const todo = todayTodos.find((t) => t.id === todoId);
      if (!todo) return;
      const wasDone = !!todo.done;
      todo.done = checked;
      if (checked && Array.isArray(todo.subtasks)) {
        todo.subtasks.forEach((s) => {
          s.done = true;
        });
      } else if (!checked && Array.isArray(todo.subtasks)) {
        todo.subtasks.forEach((s) => {
          s.done = false;
        });
      }
      saveTodayTodos();
      renderTodayTodos();
      if (checked && !wasDone && promptConfidence) {
        promptConfidenceUpdateForFile(todo.subjectId, todo.fileId);
      }
    }

    function moveTodo(sourceId, targetId) {
      if (!sourceId || !targetId || sourceId === targetId) return;
      const sourceIndex = todayTodos.findIndex((t) => t.id === sourceId);
      const targetIndex = todayTodos.findIndex((t) => t.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return;
      const [moved] = todayTodos.splice(sourceIndex, 1);
      todayTodos.splice(targetIndex, 0, moved);
      saveTodayTodos();
      renderTodayTodos();
      renderTable();
    }

    function removeTodo(todoId) {
      todayTodos = todayTodos.filter((t) => t.id !== todoId);
      saveTodayTodos();
      renderTodayTodos();
    }

    function addSubtask(todoId, label) {
      const todo = todayTodos.find((t) => t.id === todoId);
      if (!todo) return;
      if (!todo.subtasks) todo.subtasks = [];
      todo.subtasks.push({
        id: createId(),
        label,
        done: false
      });
      saveTodayTodos();
      renderTodayTodos();
    }

    function toggleSubtask(todoId, subId, checked, { promptConfidence = false } = {}) {
      const todo = todayTodos.find((t) => t.id === todoId);
      if (!todo || !Array.isArray(todo.subtasks)) return;
      const sub = todo.subtasks.find((s) => s.id === subId);
      if (!sub) return;
      const wasDone = !!todo.done;
      sub.done = checked;
      const allDone = todo.subtasks.length > 0 && todo.subtasks.every((s) => s.done);
      if (allDone) {
        todo.done = true;
      } else {
        todo.done = false;
      }
      saveTodayTodos();
      renderTodayTodos();
      if (todo.done && !wasDone && promptConfidence) {
        promptConfidenceUpdateForFile(todo.subjectId, todo.fileId);
      }
    }

    function markTodoDoneByFile(subjectId, fileId) {
      let changed = false;
      todayTodos.forEach((t) => {
        if (t.subjectId === subjectId && t.fileId === fileId) {
          t.done = true;
          if (Array.isArray(t.subtasks)) {
            t.subtasks.forEach((s) => (s.done = true));
          }
          changed = true;
        }
      });
      if (changed) {
        saveTodayTodos();
      }
      return changed;
    }

    function removeSubtask(todoId, subId) {
      const todo = todayTodos.find((t) => t.id === todoId);
      if (!todo || !Array.isArray(todo.subtasks)) return;
      todo.subtasks = todo.subtasks.filter((s) => s.id !== subId);
      saveTodayTodos();
      renderTodayTodos();
    }

    function clearDoneTodos() {
      const before = todayTodos.length;
      todayTodos = todayTodos.filter((t) => !t.done);
      if (todayTodos.length !== before) {
        saveTodayTodos();
        renderTodayTodos();
      }
    }

    function syncTodoForFile(oldSubjectId, newSubjectId, fileId, newLabel, newSubjectName) {
      let changed = false;
      todayTodos.forEach((t) => {
        if (t.fileId === fileId && t.subjectId === oldSubjectId) {
          t.subjectId = newSubjectId;
          t.label = newLabel;
          t.subjectName = newSubjectName;
          changed = true;
        }
      });
      Object.values(dailyFocusMap || {}).forEach((list) => {
        if (!Array.isArray(list)) return;
        list.forEach((t) => {
          if (!t) return;
          if (t.fileId === fileId && t.subjectId === oldSubjectId) {
            t.subjectId = newSubjectId;
            t.label = newLabel;
            t.subjectName = newSubjectName;
            changed = true;
          }
        });
      });
      if (changed) {
        saveTodayTodos();
        saveDailyFocusMap();
        renderTodayTodos();
        renderScheduleView();
      }
    }

    function renderTodayTodos() {
      if (!todayList) return;
      todayList.innerHTML = "";

      if (!todayTodos.length) {
        const empty = document.createElement("div");
        empty.className = "today-empty";
        empty.textContent = "Drag files from subjects to build today's todo list.";
        todayList.appendChild(empty);
        return;
      }

      const isDragMode = todayExpanded && !subjectsMaximized;
      const sortedTodos = isDragMode
        ? [...todayTodos]
        : [...todayTodos].sort((a, b) => {
            if (a.done === b.done) return 0;
            return a.done ? 1 : -1;
          });

      const activeItems = [];
      const completedItems = [];

      sortedTodos.forEach((todo) => {
        const { subj, file } = resolveFileRef(todo.subjectId, todo.fileId);
        const subjColor = getSubjectColorById(todo.subjectId);
        const tintAlpha = getSubjectTintAlphaById(todo.subjectId);
        const item = document.createElement("div");
        item.className = "today-item";
        const tinted = hexToRgba(subjColor, tintAlpha);
        const borderTint = hexToRgba(subjColor, Math.max(0.2, Math.min(0.7, tintAlpha * 2.25)));
        item.style.setProperty("--todo-accent", subjColor);
        if (tinted) item.style.backgroundColor = tinted;
        if (borderTint) item.style.borderColor = borderTint;
        if (todo.done) item.classList.add("today-item-done");
        if (!file || !subj) item.classList.add("today-item-missing");
        if (isDragMode) {
          item.setAttribute("draggable", "true");
          item.dataset.todoId = todo.id;
          item.addEventListener("dragstart", (event) => {
            event.dataTransfer?.setData("text/plain", todo.id);
            item.classList.add("dragging");
            todayDragId = todo.id;
          });
          item.addEventListener("dragend", () => {
            item.classList.remove("dragging");
            todayDragId = null;
            const targets = todayList.querySelectorAll(".today-item.drop-target");
            targets.forEach((el) => el.classList.remove("drop-target"));
          });
          item.addEventListener("dragover", (event) => {
            if (!todayDragId || todayDragId === todo.id) return;
            event.preventDefault();
            item.classList.add("drop-target");
          });
          item.addEventListener("dragleave", () => {
            item.classList.remove("drop-target");
          });
          item.addEventListener("drop", (event) => {
            event.preventDefault();
            item.classList.remove("drop-target");
            if (!todayDragId || todayDragId === todo.id) return;
            moveTodo(todayDragId, todo.id);
          });
        }

        const topRow = document.createElement("div");
        topRow.className = "today-item-top";

        const left = document.createElement("div");
        left.className = "today-item-left";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !!todo.done;
        checkbox.addEventListener("change", () => {
          toggleTodoDone(todo.id, checkbox.checked, { promptConfidence: true });
        });

        const colorDot = document.createElement("span");
        colorDot.className = "today-color-dot";
        colorDot.style.backgroundColor = subjColor;

        const textWrap = document.createElement("div");
        textWrap.className = "today-text";

        const title = document.createElement("div");
        title.className = "today-title";
        title.textContent = (file && file.name) || todo.label || "Untitled";

        textWrap.appendChild(title);

        left.appendChild(checkbox);
        left.appendChild(colorDot);
        left.appendChild(textWrap);

        const actions = document.createElement("div");
        actions.className = "today-actions";

        const timerSpan = document.createElement("span");
        timerSpan.className = "today-timer";
        timerSpan.id = "today-timer-" + todo.fileId;
        timerSpan.textContent = isActiveStudy(todo.subjectId, todo.fileId)
          ? formatHMS(computeElapsedMs(activeStudy))
          : "";

        const isThisActive = isActiveStudy(todo.subjectId, todo.fileId);
        const isPaused = isThisActive && activeStudy && activeStudy.paused;

        if (!todo.done) {
          if (!isThisActive) {
            const studyBtn = document.createElement("button");
            studyBtn.type = "button";
            studyBtn.className = "chip-btn chip-btn-primary";
            studyBtn.textContent = "Study";
            studyBtn.addEventListener("click", () => {
              if (subj && file) {
                startStudy(todo.subjectId, file);
              }
            });
            actions.appendChild(timerSpan);
            actions.appendChild(studyBtn);
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "today-remove-btn";
          removeBtn.textContent = "Remove";
          removeBtn.addEventListener("click", () => {
            showNotice("Remove this item from Today's focus?", "warn", () => {
              removeTodo(todo.id);
            });
          });
          actions.appendChild(removeBtn);
          } else {
            const primaryBtn = document.createElement("button");
            primaryBtn.type = "button";
            primaryBtn.className = "chip-btn chip-btn-primary";
            primaryBtn.textContent = isPaused ? "Resume" : "Pause";
            primaryBtn.addEventListener("click", () => {
              if (!activeStudy) return;
              if (activeStudy.paused) {
                activeStudy.startTimeMs = Date.now();
                activeStudy.paused = false;
                renderFocusState();
                renderTable();
                renderTodayTodos();
                renderScheduleView();
                updateStudyTimerDisplay();
              } else {
                pauseStudy(todo.subjectId, todo.fileId);
              }
            });

            const stopBtn = document.createElement("button");
            stopBtn.type = "button";
            stopBtn.className = "chip-btn chip-btn-danger";
            stopBtn.textContent = "Stop";
            stopBtn.addEventListener("click", () => {
              stopStudy(todo.subjectId, todo.fileId);
            });

            actions.appendChild(timerSpan);
            actions.appendChild(primaryBtn);
            actions.appendChild(stopBtn);
          }
        }

        topRow.appendChild(left);
        topRow.appendChild(actions);

        // Subtasks
        const subtasksWrap = document.createElement("div");
        subtasksWrap.className = "today-subtasks";

        const subtasksList = document.createElement("div");
        subtasksList.className = "today-subtasks-list";

        const subs = Array.isArray(todo.subtasks) ? todo.subtasks : [];
        if (!subs.length) {
          const hint = document.createElement("div");
          hint.className = "today-subtasks-empty";
          hint.textContent = "No subtasks yet. Add what you want to cover for this file.";
          subtasksList.appendChild(hint);
        } else {
          subs.forEach((sub) => {
            const row = document.createElement("div");
            row.className = "today-subtask-row";
            if (sub.done) row.classList.add("today-subtask-done");

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = !!sub.done;
            cb.addEventListener("change", () => {
              toggleSubtask(todo.id, sub.id, cb.checked, { promptConfidence: true });
            });

            const label = document.createElement("div");
            label.className = "today-subtask-label";
            label.textContent = sub.label || "Untitled subtask";

            const rm = document.createElement("button");
            rm.type = "button";
            rm.className = "today-subtask-remove";
            rm.textContent = "✕";
            rm.title = "Remove subtask";
            rm.addEventListener("click", () => {
              removeSubtask(todo.id, sub.id);
            });

            row.appendChild(cb);
            row.appendChild(label);
            row.appendChild(rm);
            subtasksList.appendChild(row);
          });
        }

        const addSubRow = document.createElement("div");
        addSubRow.className = "today-subtask-add";
        const addInput = document.createElement("input");
        addInput.type = "text";
        addInput.placeholder = "Add subtask...";
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.textContent = "+";
        addBtn.className = "today-subtask-add-btn";

        function commitSubtask() {
          const text = addInput.value.trim();
          if (!text) return;
          addSubtask(todo.id, text);
        }

        addBtn.addEventListener("click", commitSubtask);
        addInput.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitSubtask();
          }
        });

        addSubRow.appendChild(addInput);
        addSubRow.appendChild(addBtn);

        subtasksWrap.appendChild(subtasksList);
        subtasksWrap.appendChild(addSubRow);
        if (todayExpanded || subs.length > 4) {
          subtasksWrap.classList.add("today-subtasks-scroll");
        }

        const toggleSubsBtn = document.createElement("button");
        toggleSubsBtn.type = "button";
        toggleSubsBtn.className = "today-subtasks-toggle";
        toggleSubsBtn.textContent = "Subtasks";
        toggleSubsBtn.setAttribute("aria-expanded", "true");

        function updateToggleLabel() {
          const isCollapsed = subtasksWrap.classList.contains("collapsed");
          const count = subs.length;
          if (isCollapsed) {
            if (!count) toggleSubsBtn.textContent = "0 subtasks";
            else toggleSubsBtn.textContent = count === 1 ? "1 subtask" : `${count} subtasks`;
          } else {
            toggleSubsBtn.textContent = "Hide";
          }
          toggleSubsBtn.setAttribute("aria-expanded", String(!isCollapsed));
        }

        toggleSubsBtn.addEventListener("click", () => {
          subtasksWrap.classList.toggle("collapsed");
          updateToggleLabel();
        });

        updateToggleLabel();

        item.appendChild(topRow);
        if (!todo.done) {
          item.appendChild(toggleSubsBtn);
          item.appendChild(subtasksWrap);
        }

        if (todo.done) {
          completedItems.push(item);
        } else {
          activeItems.push(item);
        }
      });

      if (todayExpanded) {
        activeItems.forEach((node) => todayList.appendChild(node));
        // hide completed tasks entirely in maximized view
      } else {
        activeItems.forEach((node) => todayList.appendChild(node));
        completedItems.forEach((node) => todayList.appendChild(node));
      }

      renderScheduleView();
      renderSmartSuggestions();
      renderDueSoonLane();
      requestAnimationFrame(() => enforceTodayHeight());
    }

    function formatWeekRangeLabel(start, end) {
      if (!start || !end) return "";
      const opts = { month: "short" };
      const startMonth = start.toLocaleString(undefined, opts);
      const endMonth = end.toLocaleString(undefined, opts);
      const startText = startMonth + " " + start.getDate();
      const endText =
        (start.getFullYear() !== end.getFullYear() ? end.getFullYear() + " " : "") +
        endMonth +
        " " +
        end.getDate();
      return startText + " - " + endText;
    }

    function renderScheduleView() {
      if (!scheduleGrid) return;
      const phone = isPhoneLayout();

      let start;
      let end;
      let daysToRender = 7;

      if (phone) {
        const cursor = new Date(getScheduleCursorDay());
        start = cursor;
        end = cursor;
        daysToRender = 1;
        if (scheduleRangeLabel) {
          scheduleRangeLabel.textContent = cursor.toLocaleDateString(undefined, {
            weekday: "short",
            day: "2-digit",
            month: "short"
          });
        }
        if (scheduleTodayBtn) scheduleTodayBtn.textContent = "Today";
      } else {
        if (!scheduleWeekStart) scheduleWeekStart = getWeekStart(new Date());
        start = new Date(scheduleWeekStart);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        if (scheduleRangeLabel) {
          scheduleRangeLabel.textContent = formatWeekRangeLabel(start, end);
        }
        if (scheduleTodayBtn) scheduleTodayBtn.textContent = "This week";
      }

      scheduleGrid.innerHTML = "";
      const todayKey = getTodayKey();

      for (let i = 0; i < daysToRender; i++) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        const key = dateToKey(day);
        const dayList = Array.isArray(dailyFocusMap[key]) ? dailyFocusMap[key] : [];

        const col = document.createElement("div");
        col.className = "schedule-day";
        if (key === todayKey) col.classList.add("schedule-day-today");

        const header = document.createElement("div");
        header.className = "schedule-day-header";

        const dateLabel = document.createElement("div");
        dateLabel.className = "schedule-day-date";
        dateLabel.textContent =
          day.getDate() +
          " " +
          day.toLocaleString(undefined, { month: "short" }) +
          " " +
          day.getFullYear();

        const nameLabel = document.createElement("div");
        nameLabel.className = "schedule-day-name";
        nameLabel.textContent = day.toLocaleString(undefined, { weekday: "short" });

        header.appendChild(dateLabel);
        header.appendChild(nameLabel);

        const list = document.createElement("div");
        list.className = "schedule-list";

        // Keep tasks grouped by subject in the order they appear
        const subjectOrder = [];
        const subjectGroups = {};
        dayList.forEach((item) => {
          const sid = item.subjectId || "__none";
          if (!subjectGroups[sid]) {
            subjectGroups[sid] = [];
            subjectOrder.push(sid);
          }
          subjectGroups[sid].push(item);
        });
        const orderedList = [];
        subjectOrder.forEach((sid) => {
          orderedList.push(...(subjectGroups[sid] || []));
        });

        if (!orderedList.length) {
          const empty = document.createElement("div");
          empty.className = "schedule-empty";
          empty.textContent = "No focus captured.";
          list.appendChild(empty);
        } else {
          orderedList.forEach((todo) => {
            const { subj, file } = resolveFileRef(todo.subjectId, todo.fileId);
            const chip = document.createElement("div");
            chip.className = "schedule-focus-chip schedule-chip-subject";
            const color = getSubjectColorById(todo.subjectId);
            const tintAlpha = getSubjectTintAlphaById(todo.subjectId);
            const bg = hexToRgba(color, Math.max(0.12, Math.min(0.45, tintAlpha))) || "#f4f6fb";
            const border =
              hexToRgba(color, Math.max(0.25, Math.min(0.7, tintAlpha * 2.25))) || "#dfe4f0";
            chip.style.setProperty("--chip-bg", bg);
            chip.style.setProperty("--chip-border", border);
            chip.style.setProperty("--chip-ink", "#0f172a");
            const labelText = todo.label || "Untitled";

            const label = document.createElement("div");
            label.className = "schedule-chip-label";
            label.textContent = labelText;
            label.title = labelText;

            const isToday = key === todayKey;
            const isDone = !!todo.done;
            let studyBtn = null;
            if (isToday && !isDone) {
              studyBtn = document.createElement("button");
              studyBtn.type = "button";
              studyBtn.className = "schedule-chip-study";
              studyBtn.textContent = "Study";
              studyBtn.title = "Start a study session";
              studyBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                if (subj && file) {
                  startStudy(todo.subjectId, file);
                } else {
                  showNotice("This task is missing its subject or file.", "warn");
                }
              });
            }

            if (todo.done) chip.classList.add("schedule-chip-done");

            const isActive =
              activeStudy &&
              activeStudy.kind === "study" &&
              activeStudy.subjectId === todo.subjectId &&
              activeStudy.fileId === todo.fileId;
            if (isActive && studyBtn) {
              chip.classList.add("schedule-chip-active");
              studyBtn.textContent = "Studying";
            }

            const orderControls = document.createElement("div");
            orderControls.className = "schedule-chip-order";
            const upBtn = document.createElement("button");
            upBtn.type = "button";
            upBtn.className = "schedule-chip-order-btn";
            upBtn.textContent = "↑";
            upBtn.title = "Move up within subject";
            upBtn.addEventListener("click", (event) => {
              event.stopPropagation();
              moveScheduleItem(key, todo.id, "up");
            });

            const downBtn = document.createElement("button");
            downBtn.type = "button";
            downBtn.className = "schedule-chip-order-btn";
            downBtn.textContent = "↓";
            downBtn.title = "Move down within subject";
            downBtn.addEventListener("click", (event) => {
              event.stopPropagation();
              moveScheduleItem(key, todo.id, "down");
            });

            orderControls.appendChild(upBtn);
            orderControls.appendChild(downBtn);

            chip.appendChild(label);
            if (studyBtn) chip.appendChild(studyBtn);
            chip.addEventListener("click", () => openScheduleTaskModal(todo, key));

            // Drag & drop (within same subject)
            chip.draggable = true;
            chip.addEventListener("dragstart", (event) => {
              scheduleDrag = { dayKey: key, todoId: todo.id, subjectId: todo.subjectId };
              chip.classList.add("dragging");
              if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", todo.id);
              }
            });
            chip.addEventListener("dragend", () => {
              scheduleDrag = null;
              chip.classList.remove("dragging");
              document.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
            });
            chip.addEventListener("dragover", (event) => {
              if (
                !scheduleDrag ||
                scheduleDrag.dayKey !== key ||
                scheduleDrag.subjectId !== todo.subjectId ||
                scheduleDrag.todoId === todo.id
              )
                return;
              event.preventDefault();
              chip.classList.add("drag-over");
            });
            chip.addEventListener("dragleave", () => {
              chip.classList.remove("drag-over");
            });
            chip.addEventListener("drop", (event) => {
              if (
                !scheduleDrag ||
                scheduleDrag.dayKey !== key ||
                scheduleDrag.subjectId !== todo.subjectId ||
                scheduleDrag.todoId === todo.id
              )
                return;
              event.preventDefault();
              chip.classList.remove("drag-over");
              reorderScheduleWithinSubject(key, scheduleDrag.subjectId, scheduleDrag.todoId, todo.id);
              scheduleDrag = null;
            });

            list.appendChild(chip);
          });
        }

        col.appendChild(header);
        col.appendChild(list);
        scheduleGrid.appendChild(col);
      }
    }

    function closeScheduleTaskModal() {
      scheduleModalState = null;
      if (scheduleTaskModalBackdrop) {
        scheduleTaskModalBackdrop.style.display = "none";
        scheduleTaskModalBackdrop.hidden = true;
      }
    }

    function openScheduleTaskModal(todo, dayKey) {
      if (!scheduleTaskModalBackdrop || !scheduleTaskModalTitle || !scheduleTaskModalSubtasks) return;
      const onToday = dayKey === getTodayKey();
      scheduleModalState = { todoId: todo.id, dayKey };
      const subjName = todo.subjectName || "Task";
      scheduleTaskModalTitle.textContent = todo.label || subjName || "Task";
      if (scheduleTaskModalSubtitle) {
        scheduleTaskModalSubtitle.textContent = onToday
          ? "Today's subtasks"
          : "Subtasks (read-only history)";
      }

      scheduleTaskModalSubtasks.innerHTML = "";
      const subs = Array.isArray(todo.subtasks) ? todo.subtasks : [];
      if (!subs.length) {
            const empty = document.createElement("div");
            empty.className = "schedule-task-empty";
            empty.textContent = "No subtasks for this task.";
            scheduleTaskModalSubtasks.appendChild(empty);
      } else {
        subs.forEach((sub) => {
          const row = document.createElement("div");
          row.className = "schedule-task-row";
          if (sub.done) row.classList.add("schedule-task-row-done");
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = !!sub.done;
          cb.disabled = !onToday;

          if (onToday) {
            cb.addEventListener("change", () => {
              toggleSubtask(todo.id, sub.id, cb.checked, { promptConfidence: true });
            });
          }

          const label = document.createElement("div");
          label.className = "schedule-task-label";
          label.textContent = sub.label || "Subtask";

          row.appendChild(cb);
          row.appendChild(label);
          scheduleTaskModalSubtasks.appendChild(row);
        });
      }

      if (scheduleTaskStudyBtn) {
        scheduleTaskStudyBtn.disabled = !onToday;
        scheduleTaskStudyBtn.textContent = onToday ? "Study now" : "Study (today only)";
        scheduleTaskStudyBtn.onclick = () => {
          if (!onToday) return;
          const { file, subj } = resolveFileRef(todo.subjectId, todo.fileId);
          if (subj && file) {
            startStudy(todo.subjectId, file);
            closeScheduleTaskModal();
          } else {
            showNotice("This task is missing its subject or file.", "warn");
          }
        };
      }

      scheduleTaskModalBackdrop.hidden = false;
      scheduleTaskModalBackdrop.style.display = "flex";
    }

    function reorderScheduleWithinSubject(dayKey, subjectId, sourceId, targetId) {
      if (!dailyFocusMap || !dailyFocusMap[dayKey] || !Array.isArray(dailyFocusMap[dayKey])) return;
      const list = dailyFocusMap[dayKey];
      const order = [];
      const groups = {};
      list.forEach((item) => {
        const sid = item.subjectId || "__none";
        if (!groups[sid]) {
          groups[sid] = [];
          order.push(sid);
        }
        groups[sid].push(item);
      });

      const group = groups[subjectId || "__none"];
      if (!group) return;
      const sourceIdx = group.findIndex((t) => t.id === sourceId);
      const targetIdx = group.findIndex((t) => t.id === targetId);
      if (sourceIdx === -1 || targetIdx === -1 || sourceIdx === targetIdx) return;

      const [item] = group.splice(sourceIdx, 1);
      group.splice(targetIdx, 0, item);

      const newList = [];
      order.forEach((sid) => {
        newList.push(...(groups[sid] || []));
      });
      dailyFocusMap[dayKey] = newList;

      if (dayKey === getTodayKey()) {
        todayTodos = cloneTodos(newList);
        saveTodayTodos();
        renderTodayTodos();
      } else {
        saveDailyFocusMap();
        renderScheduleView();
      }
    }

    function finalizeActiveSession(autoFinished, markComplete = true) {
      if (!activeStudy) return;
      const session = activeStudy;
      const rawElapsed = computeElapsedMs(session);
      const elapsed =
        typeof session.targetMs === "number"
          ? Math.min(rawElapsed, session.targetMs)
          : rawElapsed;

      if (
        session.kind === "study" &&
        session.subjectId &&
        session.fileId
      ) {
        const minMs = 3 * 60 * 1000;
        if (elapsed < minMs) {
          activeStudy = null;
          clearActiveSession();
          renderFocusState();
          renderTable();
          renderTodayTodos();
          renderScheduleView();
          updateStudyTimerDisplay();
          showNotice("Session shorter than 3 minutes was not counted.", "warn");
          return;
        }
        const subj = subjects.find((s) => s.id === session.subjectId);
        if (subj) {
          const file = subj.files.find((f) => f.id === session.fileId);
          if (file) {
            file.totalMs = (file.totalMs || 0) + elapsed;
            file.sessions = (file.sessions || 0) + 1;
            file.lastSessionMs = elapsed;
            file.lastReviewed = new Date().toISOString();
            addDailyStudyForFile(file, elapsed);
            addDailySessionForFile(file);
            if (markComplete) {
              markTodoDoneByFile(session.subjectId, session.fileId);
            }
          }
        }
      }

      activeStudy = null;
      clearActiveSession();
      saveToStorage();
      renderFocusState();
      renderTable();
      renderTodayTodos();
      renderScheduleView();
      updateStudyTimerDisplay();
      if (autoFinished) {
        showNotice("Session finished.", "success");
      }
    }

    function startStudy(subjectId, file) {
      // Resume if same file paused
      if (
        activeStudy &&
        activeStudy.kind === "study" &&
        activeStudy.subjectId === subjectId &&
        activeStudy.fileId === file.id
      ) {
        if (activeStudy.paused) {
          resumeActiveSession({ clearNavFlags: true });
          renderFocusState();
          updateStudyTimerDisplay();
        }
        return;
      }

      if (activeStudy) {
        // directly stop current session and start new study (no confirm)
        finalizeActiveSession(false);
      }

      const minutes = pomoConfig.study || 25;
      const targetMs = minutes * 60 * 1000;

      activeStudy = {
        kind: "study",
        subjectId,
        fileId: file.id,
        startTimeMs: Date.now(),
        baseMs: 0,
        targetMs,
        paused: false,
        timerMode: timerModePref || "countdown",
        pausedReason: null,
        autoResume: false,
        pausedAtMs: null
      };
      saveActiveSession();

      renderFocusState();
      renderTable();
      renderTodayTodos();
      renderScheduleView();
      updateStudyTimerDisplay();
    }

    function pauseStudy(subjectId, fileId) {
      if (
        !activeStudy ||
        activeStudy.kind !== "study" ||
        activeStudy.subjectId !== subjectId ||
        activeStudy.fileId !== fileId ||
        activeStudy.paused
      ) {
        return;
      }
      pauseActiveSession("manual", { autoResume: false });
      renderFocusState();
      renderTable();
      renderTodayTodos();
      updateStudyTimerDisplay();
    }

    function stopStudy(subjectId, fileId) {
      if (
        !activeStudy ||
        activeStudy.kind !== "study" ||
        activeStudy.subjectId !== subjectId ||
        activeStudy.fileId !== fileId
      ) {
        return;
      }
      finalizeActiveSession(false, false);
    }

    function startBreak(kind) {
      // No confirmation: just stop current session and start break
      if (activeStudy) {
        finalizeActiveSession(false, false);
      }

      const minutes =
        kind === "short" ? pomoConfig.short : pomoConfig.long;
      const targetMs = minutes * 60 * 1000;

      activeStudy = {
        kind: "break",
        breakKind: kind,
        subjectId: null,
        fileId: null,
        startTimeMs: Date.now(),
        baseMs: 0,
        targetMs,
        paused: false,
        pausedReason: null,
        autoResume: false,
        pausedAtMs: null
      };
      saveActiveSession();

      renderFocusState();
      renderTable();
      renderTodayTodos();
      renderScheduleView();
      updateStudyTimerDisplay();
    }

    function updateStudyTimerDisplay() {
      const currentKey =
        activeStudy && activeStudy.kind === "study"
          ? activeStudy.subjectId + "|" + activeStudy.fileId
          : null;
      const currentPaused =
        activeStudy && activeStudy.kind === "study" ? !!activeStudy.paused : null;
      if (currentKey !== lastActiveStudyKey || currentPaused !== lastActiveStudyPaused) {
        lastActiveStudyKey = currentKey;
        lastActiveStudyPaused = currentPaused;
        renderTable();
        renderTodayTodos();
        renderScheduleView();
      }

      if (!focusTimerDisplay) return;

      if (!activeStudy) {
        focusTimerDisplay.textContent = "00:00:00";
        document
          .querySelectorAll(".today-timer")
          .forEach((el) => (el.textContent = ""));
        return;
      }

      const elapsed = computeElapsedMs(activeStudy);
      const targetMs =
        typeof activeStudy.targetMs === "number"
          ? activeStudy.targetMs
          : 0;

      const useCountdown = activeStudy.timerMode !== "stopwatch";

      if (useCountdown) {
        let remaining = targetMs - elapsed;
        if (remaining <= 0) {
          focusTimerDisplay.textContent = "00:00:00";
          finalizeActiveSession(true, true);
          return;
        }
        const text = formatHMS(remaining);
        focusTimerDisplay.textContent = text;
        if (activeStudy.kind === "study" && activeStudy.fileId) {
          const span = document.getElementById("timer-" + activeStudy.fileId);
          if (span) span.textContent = text;
          const spanToday = document.getElementById("today-timer-" + activeStudy.fileId);
          if (spanToday) spanToday.textContent = text;
        }
      } else {
        const text = formatHMS(elapsed);
        focusTimerDisplay.textContent = text;
        if (activeStudy.kind === "study" && activeStudy.fileId) {
          const span = document.getElementById("timer-" + activeStudy.fileId);
          if (span) span.textContent = text;
          const spanToday = document.getElementById("today-timer-" + activeStudy.fileId);
          if (spanToday) spanToday.textContent = text;
        }
      }
    }

    setInterval(function () {
      if (activeStudy && !activeStudy.paused && activeStudy.startTimeMs) {
        const now = Date.now();
        const lastSaved = Number(activeStudy.savedAtMs) || 0;
        if (now - lastSaved >= 5000) {
          const delta = now - Number(activeStudy.startTimeMs || 0);
          if (Number.isFinite(delta) && delta > 0) {
            activeStudy.baseMs = (Number(activeStudy.baseMs) || 0) + delta;
          }
          activeStudy.startTimeMs = now;
          saveActiveSession();
        }
      }
      updateStudyTimerDisplay();
      updateTodayStudyUI();
      updateGoalsAndStreaks();
    }, 1000);

    function renderFocusState() {
      focusCard.classList.remove(
        "focus-study-active",
        "focus-study-paused",
        "focus-break-active"
      );

      if (!activeStudy) {
        focusSessionTitle.textContent = "No active session";
        focusSessionSubtitle.textContent =
          "Click “Study” on a file or start a break below.";
        focusSessionControls.innerHTML =
          '<span style="font-size:0.75rem;color:#9ca3af;">No controls – start a session.</span>';
        focusTimerDisplay.textContent = "00:00:00";
        updateTimerModeButtons(timerModePref);
        return;
      }

      if (activeStudy.kind === "study") {
        const subj = subjects.find((s) => s.id === activeStudy.subjectId);
        const file =
          subj && subj.files.find((f) => f.id === activeStudy.fileId);
        focusSessionTitle.textContent = file ? file.name : "Study session";
        const subjName = subj ? subj.name : "Unknown subject";
        focusSessionSubtitle.textContent = subjName + " · Study session";

        if (activeStudy.paused) {
          focusCard.classList.add("focus-study-paused");
        } else {
          focusCard.classList.add("focus-study-active");
        }
        updateTimerModeButtons(activeStudy.timerMode || timerModePref);
      } else {
        const label =
          activeStudy.breakKind === "short"
            ? "Short break"
            : activeStudy.breakKind === "long"
            ? "Long break"
            : "Break";
        focusSessionTitle.textContent = label;
        focusSessionSubtitle.textContent = "Break";
        focusCard.classList.add("focus-break-active");
        updateTimerModeButtons(timerModePref);
      }

      focusSessionControls.innerHTML = "";
      const isPaused = !!activeStudy.paused;

      const pauseBtn = document.createElement("button");
      pauseBtn.className = "focus-main-btn focus-main-btn-primary";
      pauseBtn.textContent = isPaused ? "Resume" : "Pause";
      pauseBtn.addEventListener("click", () => {
        if (!activeStudy) return;
        if (activeStudy.paused) {
          resumeActiveSession({ clearNavFlags: true });
          renderFocusState();
          updateStudyTimerDisplay();
        } else {
          pauseActiveSession("manual", { autoResume: false });
          renderFocusState();
          renderTable();
          updateStudyTimerDisplay();
        }
      });

      const stopBtn = document.createElement("button");
      stopBtn.className = "focus-main-btn focus-main-btn-danger";
      stopBtn.textContent = "Stop";
      stopBtn.addEventListener("click", () => {
        finalizeActiveSession(false, false);
      });

      focusSessionControls.appendChild(pauseBtn);
      focusSessionControls.appendChild(stopBtn);
    }

    function createAddSubjectColumn() {
      const col = document.createElement("div");
      col.className = "subject-column subject-add-column";

      const box = document.createElement("div");
      box.className = "subject-add-box";

      const inline = document.createElement("div");
      inline.className = "subject-add-inline";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn subject-add-btn";
      btn.textContent = "+";

      btn.addEventListener("click", () => {
        openNoticePrompt("Add subject", "", (value) => {
          const trimmed = (value || "").trim();
          if (!trimmed) return;
          subjects.push({
            id: createId(),
            name: trimmed,
            files: [],
            sortMode: "manual",
            manualOrder: []
          });
          saveToStorage();
          renderSubjectOptions();
          renderTable();
          renderFocusState();
          renderScheduleView();
        });
      });

      inline.appendChild(btn);
      box.appendChild(inline);
      col.appendChild(box);

      return col;
    }

    function updateManualOrder(subj) {
      subj.manualOrder = Array.isArray(subj.files)
        ? subj.files.map((f) => f.id)
        : [];
    }

    function applySortToSubject(subj) {
      if (!Array.isArray(subj.manualOrder)) {
        subj.manualOrder = subj.files.map((f) => f.id);
      }

      const mode = subj.sortMode || "manual";
      if (!Array.isArray(subj.files)) return;
      if (mode === "manual") {
        const idSet = new Set(subj.files.map((f) => f.id));
        const ordered = [];
        subj.manualOrder.forEach((id) => {
          if (idSet.has(id)) {
            const f = subj.files.find((x) => x.id === id);
            if (f) ordered.push(f);
          }
        });
        subj.files.forEach((f) => {
          if (!subj.manualOrder.includes(f.id)) {
            ordered.push(f);
            subj.manualOrder.push(f.id);
          }
        });
        subj.files = ordered;
        return;
      }

      // Preserve current manual ordering before applying other sorts
      subj.manualOrder = subj.files.map((f) => f.id);

      if (mode === "confidence") {
        subj.files.sort((a, b) => {
          const ac = Number(a.confidence) || 0;
          const bc = Number(b.confidence) || 0;
          if (ac === bc) return (a.name || "").localeCompare(b.name || "");
          // low confidence first
          return ac - bc;
        });
      } else if (mode === "staleness") {
        // Longest time not studied: never reviewed first, then oldest lastReviewed
        function stalenessValue(file) {
          if (!file.lastReviewed) return 0; // "never" group
          const t = new Date(file.lastReviewed).getTime();
          if (Number.isNaN(t)) return 0;
          return t;
        }
        subj.files.sort((a, b) => {
          const av = stalenessValue(a);
          const bv = stalenessValue(b);
          const aNever = !a.lastReviewed;
          const bNever = !b.lastReviewed;
          if (aNever && !bNever) return -1;
          if (!aNever && bNever) return 1;
          if (av === bv) return (a.name || "").localeCompare(b.name || "");
          // older date (smaller timestamp) is more stale
          return av - bv;
        });
      } else if (mode === "total") {
        // Total amount spent in total studying: most studied first
        subj.files.sort((a, b) => {
          const at = Number(a.totalMs) || 0;
          const bt = Number(b.totalMs) || 0;
          if (at === bt) return (a.name || "").localeCompare(b.name || "");
          return bt - at;
        });
      }
    }

    function renderTable() {
      subjectTable.innerHTML = "";

      if (!subjects.length) {
        emptyHint.textContent =
          "No subjects yet. Use “Add subject” on the right to create your first subject.";
        emptyHint.style.display = "block";
      } else {
        emptyHint.style.display = "none";
      }

      subjects.forEach((subj, subjIndex) => {
        if (!subj.sortMode) subj.sortMode = "manual";
        applySortToSubject(subj);

        const col = document.createElement("div");
        col.className = "subject-column";
        const subjColor = isHexColor(subj.color) ? subj.color : getSubjectColor(subjIndex);
        col.style.borderTop = "3px solid " + subjColor;

        const header = document.createElement("div");
        header.className = "subject-header";
        header.addEventListener("click", (event) => {
          if (event.target && event.target.closest && event.target.closest(".subject-delete-btn")) return;
          openSubjectSettingsModal(subj.id);
        });

        const headerLeft = document.createElement("div");
        headerLeft.style.display = "flex";
        headerLeft.style.alignItems = "center";
        headerLeft.style.gap = "6px";

        const colorDot = document.createElement("span");
        colorDot.className = "subject-color-dot";
        colorDot.style.backgroundColor = subjColor;
        colorDot.title = "Subject settings";
        colorDot.setAttribute("role", "button");
        colorDot.setAttribute("tabindex", "0");
        colorDot.addEventListener("click", (event) => {
          event.stopPropagation();
          openSubjectSettingsModal(subj.id);
        });
        colorDot.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          openSubjectSettingsModal(subj.id);
        });

        const titleSpan = document.createElement("span");
        titleSpan.textContent = subj.name;

        headerLeft.appendChild(colorDot);
        headerLeft.appendChild(titleSpan);

        const countSpan = document.createElement("small");
        const totalFiles = subj.files.length;
        let avg = 0;
        if (totalFiles) {
          const sum = subj.files.reduce(
            (acc, f) => acc + (Number(f.confidence) || 0),
            0
          );
          avg = Math.round(sum / totalFiles);
          countSpan.textContent =
            totalFiles + " file" + (totalFiles === 1 ? "" : "s") + " · " + avg + "%";
        } else {
          countSpan.textContent = "no files";
        }

        const deleteSubjectBtn = document.createElement("button");
        deleteSubjectBtn.className = "subject-delete-btn";
        deleteSubjectBtn.title = "Delete subject";
        deleteSubjectBtn.textContent = "✕";
        deleteSubjectBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          if (
            !confirm(
              `Delete subject "${subj.name}" and all its files? This cannot be undone.`
            )
          ) {
            return;
          }
          if (
            activeStudy &&
            activeStudy.kind === "study" &&
            activeStudy.subjectId === subj.id
          ) {
            activeStudy = null;
            clearActiveSession();
          }
          subjects = subjects.filter((s) => s.id !== subj.id);
          cleanupTodosForSubject(subj.id);
          saveToStorage();
          renderSubjectOptions();
          renderFocusState();
          renderTable();
        });

        const headerRight = document.createElement("div");
        headerRight.style.display = "flex";
        headerRight.style.alignItems = "center";
        headerRight.style.gap = "6px";
        headerRight.appendChild(countSpan);
        headerRight.appendChild(deleteSubjectBtn);

        header.appendChild(headerLeft);
        header.appendChild(headerRight);

        const meter = document.createElement("div");
        meter.className = "subject-meter";
        const meterFill = document.createElement("div");
        meterFill.className = "subject-meter-fill";
        if (totalFiles) {
          meterFill.style.width = avg + "%";
          meterFill.classList.add(meterClass(avg));
          meterFill.style.background = meterGradient(avg);
        } else {
          meterFill.style.width = "0%";
          meterFill.classList.add("meter-low");
          meterFill.style.background = meterGradient(0);
        }
        meter.appendChild(meterFill);

        // Sort controls
        const sortWrapper = document.createElement("div");
        sortWrapper.className = "subject-sort";
        const sortSelect = document.createElement("select");
        sortSelect.className = "subject-sort-select";

        const sortOptions = [
          { value: "manual", label: "Order: manual" },
          { value: "confidence", label: "Confidence (low → high)" },
          { value: "staleness", label: "Longest not studied" },
          { value: "total", label: "Most studied" }
        ];

        sortOptions.forEach((opt) => {
          const optionEl = document.createElement("option");
          optionEl.value = opt.value;
          optionEl.textContent = opt.label;
          sortSelect.appendChild(optionEl);
        });

        sortSelect.value = subj.sortMode || "manual";
        sortSelect.addEventListener("change", () => {
          subj.sortMode = sortSelect.value;
          applySortToSubject(subj);
          saveToStorage();
          renderTable();
        });

        sortWrapper.appendChild(sortSelect);

        const fileList = document.createElement("div");
        fileList.className = "file-list";

        const filter = currentSearch;

        const sourceFiles = subj.files;
        const visibleFiles = filter
          ? sourceFiles.filter((f) =>
              (f.name || "")
                .toLowerCase()
                .includes(filter.toLowerCase())
            )
          : sourceFiles;

        // Allow dropping at end of list (reorder only within same subject)
        fileList.addEventListener("dragover", (event) => {
          if (!dragState) return;
          event.preventDefault();
        });

        fileList.addEventListener("drop", (event) => {
          event.preventDefault();
          if (!dragState) return;

          const sourceSubject = subjects.find(
            (s) => s.id === dragState.subjectId
          );
          if (!sourceSubject) return;

          const sourceIndex = sourceSubject.files.findIndex(
            (f) => f.id === dragState.fileId
          );
          if (sourceIndex === -1) return;

          const [movedFile] = sourceSubject.files.splice(sourceIndex, 1);
          if (sourceSubject.id === subj.id) {
            subj.files.push(movedFile);
            subj.sortMode = "manual"; // manual override after drag
            updateManualOrder(subj);
          } else {
            // Move across subjects
            subj.files.push(movedFile);
            sourceSubject.sortMode = "manual";
            subj.sortMode = "manual";
            updateManualOrder(sourceSubject);
            updateManualOrder(subj);
            syncTodoForFile(sourceSubject.id, subj.id, movedFile.id, movedFile.name, subj.name);
            if (
              activeStudy &&
              activeStudy.kind === "study" &&
              activeStudy.subjectId === sourceSubject.id &&
              activeStudy.fileId === movedFile.id
            ) {
              activeStudy.subjectId = subj.id;
              saveActiveSession();
            }
          }
          saveToStorage();
          renderTable();
        });

        if (!visibleFiles.length) {
          const hint = document.createElement("div");
          hint.className = "empty-hint";
          hint.textContent = subj.files.length
            ? "No files match filter in this subject."
            : "Add a file to this subject.";
          fileList.appendChild(hint);
        } else {
          for (const file of visibleFiles) {
            const row = document.createElement("div");
            row.className = "file-row";
            row.setAttribute("draggable", "true");

            const inToday = todayTodos.some(
              (t) => t.subjectId === subj.id && t.fileId === file.id
            );
            if ((subjectsMaximized || isPhoneTodayPicker()) && inToday) {
              row.classList.add("in-today");
            }

            if (isActiveStudy(subj.id, file.id)) {
              row.classList.add("studying");
            }

            // Drag handlers
            row.addEventListener("dragstart", (event) => {
              dragState = { subjectId: subj.id, fileId: file.id };
              row.classList.add("dragging");
              if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "copyMove";
                // setData required for some browsers to allow drop
                event.dataTransfer.setData("text/plain", file.id);
              }
            });

            row.addEventListener("dragend", () => {
              row.classList.remove("dragging");
              dragState = null;
            });

            row.addEventListener("dragenter", (event) => {
              if (!dragState) return;
              event.preventDefault();
              row.classList.add("drag-over");
            });

            row.addEventListener("dragover", (event) => {
              if (!dragState) return;
              event.preventDefault();
            });

            row.addEventListener("dragleave", () => {
              row.classList.remove("drag-over");
            });

            row.addEventListener("drop", (event) => {
              event.preventDefault();
              row.classList.remove("drag-over");
              if (!dragState) return;

              const sourceSubject = subjects.find(
                (s) => s.id === dragState.subjectId
              );
              if (!sourceSubject) return;

              const sourceIndex = sourceSubject.files.findIndex(
                (f) => f.id === dragState.fileId
              );
              if (sourceIndex === -1) return;

              const targetIndex = subj.files.findIndex(
                (f) => f.id === file.id
              );
              if (targetIndex === -1) return;

              const [movedFile] = sourceSubject.files.splice(sourceIndex, 1);
              if (sourceSubject.id === subj.id) {
                let insertIndex = targetIndex;
                if (sourceIndex < targetIndex) {
                  insertIndex = targetIndex - 1;
                }
                subj.files.splice(insertIndex, 0, movedFile);
                subj.sortMode = "manual"; // manual override after drag
                updateManualOrder(subj);
              } else {
                subj.files.splice(targetIndex, 0, movedFile);
                sourceSubject.sortMode = "manual";
                subj.sortMode = "manual";
                updateManualOrder(sourceSubject);
                updateManualOrder(subj);
                syncTodoForFile(sourceSubject.id, subj.id, movedFile.id, movedFile.name, subj.name);
                if (
                  activeStudy &&
                  activeStudy.kind === "study" &&
                  activeStudy.subjectId === sourceSubject.id &&
                  activeStudy.fileId === movedFile.id
                ) {
                  activeStudy.subjectId = subj.id;
                  saveActiveSession();
                }
              }

              dragState = null;
              saveToStorage();
              renderTable();
            });

            const nameDiv = document.createElement("div");
            nameDiv.className = "file-name";
            nameDiv.textContent = file.name;
            row.appendChild(nameDiv);

            if (file.notes) {
              const notesDiv = document.createElement("div");
              notesDiv.className = "file-notes";
              notesDiv.textContent = file.notes;
              row.appendChild(notesDiv);
            }

            const timeDiv = document.createElement("div");
            timeDiv.className = "file-time";
            timeDiv.textContent = file.lastReviewed
              ? "Revised " + formatTimeAgo(file.lastReviewed)
              : "Never revised";
            row.appendChild(timeDiv);

            const metaDiv = document.createElement("div");
            metaDiv.className = "file-meta";

            const leftMeta = document.createElement("div");
            leftMeta.style.display = "flex";
            leftMeta.style.alignItems = "center";
            leftMeta.style.gap = "4px";

            const badge = document.createElement("span");
            const confValue = displayConfidence(file);
            badge.className =
              "confidence-badge " + confidenceClass(confValue);
            badge.textContent = confValue + "%";

            // Click badge to change confidence
            badge.addEventListener("click", (event) => {
              event.stopPropagation();
              openFileModalEdit(subj.id, file);
            });

            leftMeta.appendChild(badge);

            const rightMeta = document.createElement("div");
            rightMeta.className = "file-actions";

            const isThisActive = isActiveStudy(subj.id, file.id);
            const isPaused =
              isThisActive && activeStudy && activeStudy.paused;

            if (!subjectsMaximized && !isPhoneTodayPicker()) {
              if (!isThisActive) {
                const studyBtn = document.createElement("button");
                studyBtn.className = "chip-btn chip-btn-primary";
                studyBtn.textContent = "Study";
                studyBtn.addEventListener("click", (event) => {
                  event.stopPropagation();
                  startStudy(subj.id, file);
                });
                rightMeta.appendChild(studyBtn);
              } else {
                const primaryBtn = document.createElement("button");
                primaryBtn.className = "chip-btn chip-btn-primary";
                primaryBtn.textContent = isPaused ? "Resume" : "Pause";
                primaryBtn.addEventListener("click", (event) => {
                  event.stopPropagation();
                  if (activeStudy.paused) {
                    activeStudy.startTimeMs = Date.now();
                    activeStudy.paused = false;
                    renderFocusState();
                    renderTable();
                    renderTodayTodos();
                    renderScheduleView();
                    updateStudyTimerDisplay();
                  } else {
                    pauseStudy(subj.id, file.id);
                  }
                });

                const stopBtn = document.createElement("button");
                stopBtn.className = "chip-btn chip-btn-danger";
                stopBtn.textContent = "Stop";
                stopBtn.addEventListener("click", (event) => {
                  event.stopPropagation();
                  stopStudy(subj.id, file.id);
                });

                rightMeta.appendChild(primaryBtn);
                rightMeta.appendChild(stopBtn);
              }
            }

            // Add-to-today controls:
            // - desktop: only show in Subjects maximized mode (existing behavior)
            // - phone Today picker: show a simple "Add" action on every file (no Study button)
            const picker = isPhoneTodayPicker();
            if (subjectsMaximized || picker) {
              const addTodayBtn = document.createElement("button");
              addTodayBtn.className = picker ? "chip-btn chip-btn-primary" : "chip-btn chip-btn-ghost";
              addTodayBtn.textContent = inToday ? (picker ? "Added" : "In Today") : picker ? "Add" : "To Today";
              addTodayBtn.title = inToday
                ? "Already in Today’s Focus"
                : "Add this file to Today’s Focus";

              if (inToday) {
                if (picker) {
                  addTodayBtn.disabled = true;
                  addTodayBtn.classList.add("chip-btn-success");
                  const removeBtn = document.createElement("button");
                  removeBtn.className = "chip-btn chip-btn-danger";
                  removeBtn.textContent = "Remove";
                  removeBtn.title = "Remove from Today’s Focus";
                  removeBtn.addEventListener("click", (event) => {
                    event.stopPropagation();
                    cleanupTodoForFile(subj.id, file.id);
                    renderTable();
                  });
                  rightMeta.appendChild(addTodayBtn);
                  rightMeta.appendChild(removeBtn);
                } else {
                  addTodayBtn.disabled = true;
                  addTodayBtn.classList.add("chip-btn-success");
                  const removeBtn = document.createElement("button");
                  removeBtn.className = "chip-btn chip-btn-danger";
                  removeBtn.textContent = "Remove";
                  removeBtn.title = "Remove from Today’s Focus";
                  removeBtn.addEventListener("click", (event) => {
                    event.stopPropagation();
                    showNotice("Remove this file from Today's focus?", "warn", () => {
                      cleanupTodoForFile(subj.id, file.id);
                      renderTodayTodos();
                      renderScheduleView();
                      renderTable();
                    });
                  });
                  rightMeta.appendChild(addTodayBtn);
                  rightMeta.appendChild(removeBtn);
                }
              } else if (picker) {
                addTodayBtn.addEventListener("click", (event) => {
                  event.stopPropagation();
                  const added = addTodoForFile(subj.id, file.id);
                  if (added) {
                    showToast("Added to Today.", "success");
                    renderTable();
                  }
                });
                rightMeta.appendChild(addTodayBtn);
              } else {
                addTodayBtn.addEventListener("click", (event) => {
                  event.stopPropagation();
                  openAddTodoModal(subj.id, file);
                });
                rightMeta.appendChild(addTodayBtn);
              }
            }

            metaDiv.appendChild(leftMeta);
            metaDiv.appendChild(rightMeta);

            row.appendChild(metaDiv);

            // Click row to edit in modal
            row.addEventListener("click", () => {
              openFileModalEdit(subj.id, file);
            });

            fileList.appendChild(row);
          }
        }

        // Add file slot at the bottom of each column
        const addSlot = document.createElement("button");
        addSlot.type = "button";
        addSlot.className = "add-file-slot";
        addSlot.textContent = "+ Add file";
        addSlot.addEventListener("click", () => {
          openFileModalAdd(subj.id);
        });
        fileList.appendChild(addSlot);

        col.appendChild(header);
        col.appendChild(meter);
        col.appendChild(sortWrapper);
        col.appendChild(fileList);
        subjectTable.appendChild(col);
      });

      // Add subject column at the right
      subjectTable.appendChild(createAddSubjectColumn());

      applyDesktopSubjectSizing();
      ensureSubjectScrollButtons();

      updateSummary();
      renderDueSoonLane();
      renderSmartSuggestions();
      updateStudyTimerDisplay();
    }

    function renderSubjectOptions(selectedId) {
      modalSubjectSelect.innerHTML = "";
      if (!subjects.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No subjects yet";
        modalSubjectSelect.appendChild(opt);
        return;
      }

      for (const subj of subjects) {
        const opt = document.createElement("option");
        opt.value = subj.id;
        opt.textContent = subj.name;
        modalSubjectSelect.appendChild(opt);
      }

      if (selectedId && subjects.some((s) => s.id === selectedId)) {
        modalSubjectSelect.value = selectedId;
      } else {
        modalSubjectSelect.selectedIndex = 0;
      }
    }

    function openFileModalAdd(subjectId) {
      fileModalState = { mode: "add", subjectId };
      fileModalTitle.textContent = "Add file";
      fileModalSubtitle.textContent = "Add a new file to your study planner.";
      modalDeleteBtn.hidden = true;

      renderSubjectOptions(subjectId);
      modalFileNameInput.value = "";
      modalFileNotesInput.value = "";
      modalConfidenceRange.value = "50";
      modalConfidenceValue.textContent = "50%";

      fileModalBackdrop.style.display = "flex";
      modalFileNameInput.focus();
    }

    function openFileModalEdit(subjectId, file) {
      fileModalState = { mode: "edit", subjectId, fileId: file.id };
      fileModalTitle.textContent = "Edit file";
      fileModalSubtitle.textContent = "Update file information or move it to another subject.";
      modalDeleteBtn.hidden = false;

      renderSubjectOptions(subjectId);
      modalFileNameInput.value = file.name;
      modalFileNotesInput.value = file.notes || "";
      modalConfidenceRange.value = file.confidence;
      modalConfidenceValue.textContent = file.confidence + "%";

      fileModalBackdrop.style.display = "flex";
      modalFileNameInput.focus();
    }

    function closeFileModal() {
      fileModalState = null;
      fileModalBackdrop.style.display = "none";
    }

    // Stats modal
    function renderStatsModalContent() {
      const rangeLabels = {
        day: "Today",
        week: "Last 7 days",
        month: "Last 30 days",
        all: "All time"
      };

      const entries = [];
      const perSubject = [];
      const confidenceBuckets = { low: 0, mid: 0, high: 0 };
      let totalMsRange = 0;
      let totalSessionsRange = 0;
      let trackedFiles = 0;
      const includesToday = msInRange(Date.now(), statsRange);

      const totalsMap = getDailyTotalsMap(true);
      const weekMs = sumLastNDays(totalsMap, 7);
      const goalMs = Math.max(0, weeklyTargetMinutes || 0) * 60 * 1000;
      const goalPct = goalMs ? Math.min(100, Math.round((weekMs * 100) / goalMs)) : 0;
      const { current: streakCurrent, best: streakBest } = computeStreakStats(totalsMap);

      let bestDay = null;
      Object.entries(totalsMap || {}).forEach(([key, val]) => {
        const ms = Number(val) || 0;
        const ts = dateKeyToMs(key);
        if (ts === null || ms <= 0) return;
        if (!bestDay || ms > bestDay.ms) {
          bestDay = { key, ms, ts };
        }
      });

      const daySeries = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = dateToKey(d);
        daySeries.push({
          key,
          label: d.toLocaleString(undefined, { weekday: "short" }),
          ms: totalsMap[key] || 0
        });
      }
      const maxDayMs = daySeries.reduce((max, d) => (d.ms > max ? d.ms : max), 0);

      subjects.forEach((subj) => {
        let subjMs = 0;
        let subjSessions = 0;
        (subj.files || []).forEach((file) => {
          let totalMs = totalMsForRange(file, statsRange);
          if (
            includesToday &&
            activeStudy &&
            activeStudy.kind === "study" &&
            activeStudy.subjectId === subj.id &&
            activeStudy.fileId === file.id
          ) {
            totalMs += computeElapsedMs(activeStudy);
          }
          const sessions = totalSessionsForRange(file, statsRange);
          const conf = Number(file.confidence) || 0;
          if (totalMs > 0) {
            trackedFiles += 1;
            entries.push({
              subjectName: subj.name,
              fileName: file.name,
              totalMs,
              sessions,
              confidence: conf
            });
            subjMs += totalMs;
            subjSessions += sessions;
            totalMsRange += totalMs;
            totalSessionsRange += sessions;
          }
          if (conf < 40) confidenceBuckets.low += 1;
          else if (conf < 75) confidenceBuckets.mid += 1;
          else confidenceBuckets.high += 1;
        });
        if (subjMs > 0) {
          perSubject.push({
            name: subj.name,
            totalMs: subjMs,
            sessions: subjSessions
          });
        }
      });

      const confidenceTotal =
        confidenceBuckets.low + confidenceBuckets.mid + confidenceBuckets.high;
      const confPct = (count) =>
        confidenceTotal ? Math.round((count * 100) / confidenceTotal) : 0;

      const activeDaysInRange = Object.entries(totalsMap || {}).reduce(
        (count, [key, val]) => {
          const ts = dateKeyToMs(key);
          if (ts !== null && msInRange(ts, statsRange) && (Number(val) || 0) > 0) {
            return count + 1;
          }
          return count;
        },
        0
      );
      const avgPerDayMs = activeDaysInRange ? totalMsRange / activeDaysInRange : 0;
      const avgSessionMs =
        totalSessionsRange > 0 ? totalMsRange / Math.max(totalSessionsRange, 1) : 0;

      entries.sort((a, b) => b.totalMs - a.totalMs);
      perSubject.sort((a, b) => b.totalMs - a.totalMs);
      const topFiles = entries.slice(0, 5);
      const maxMs = entries.reduce((max, e) => (e.totalMs > max ? e.totalMs : max), 0);
      const maxSubMs = perSubject.reduce(
        (max, e) => (e.totalMs > max ? e.totalMs : max),
        0
      );

      const rangeLabel = rangeLabels[statsRange] || "Range";
      const heroCard = (title, value, subtitle, extraClass = "") =>
        '<div class="stats-hero-card' +
        (extraClass ? " " + extraClass : "") +
        '">' +
        '<div class="stats-hero-title">' +
        title +
        "</div>" +
        '<div class="stats-hero-value">' +
        value +
        "</div>" +
        (subtitle ? '<div class="stats-hero-sub">' + subtitle + "</div>" : "") +
        "</div>";

      let html = "";

      html += '<div class="stats-range-row">';
      html += '<div class="stats-range">';
      ["day", "week", "month", "all"].forEach((range) => {
        html +=
          '<button class="stats-range-btn' +
          (statsRange === range ? " stats-range-btn-active" : "") +
          '" data-range="' +
          range +
          '">' +
          (range === "day"
            ? "Today"
            : range === "week"
            ? "Last 7 days"
            : range === "month"
            ? "Last 30 days"
            : "All time") +
          "</button>";
      });
      html += "</div>";
      html += "</div>";

      html += '<div class="stats-hero">';
      html += heroCard(
        "Tracked time",
        formatDuration(totalMsRange),
        rangeLabel + (avgPerDayMs ? " · avg " + formatDuration(avgPerDayMs) + "/day" : "")
      );
      html += heroCard(
        "Daily streak",
        streakCurrent + " day" + (streakCurrent === 1 ? "" : "s"),
        "Best " + (streakBest || 0)
      );
      html += heroCard(
        "Avg session",
        avgSessionMs ? formatDuration(avgSessionMs) : "—",
        (totalSessionsRange || 0) + " sessions"
      );
      html +=
        '<div class="stats-hero-card stats-hero-goal">' +
        '<div class="stats-hero-title">Weekly goal</div>' +
        '<div class="stats-hero-value">' +
        (goalMs ? goalPct + "%" : "—") +
        "</div>" +
        '<div class="stats-hero-sub">' +
        formatHoursCompact(weekMs) +
        " / " +
        (goalMs ? formatHoursCompact(goalMs) : "no target") +
        "</div>" +
        '<div class="stats-hero-progress"><span style="width:' +
        (goalMs ? Math.min(goalPct, 100) : 0) +
        '%"></span></div>' +
        "</div>";
      html += "</div>";

      html +=
        '<div class="stats-meta-row">' +
        trackedFiles +
        " files · " +
        perSubject.length +
        " subjects · " +
        (totalSessionsRange || 0) +
        " sessions" +
        "</div>";

      html += '<div class="stats-grid stats-grid-balanced">';
      html += '<div class="stats-card stats-chart-card">';
      html += '<div class="stats-card-title">Last 7 days</div>';
      html += '<div class="stats-chart">';
      html += '<div class="stats-chart-bars">';
      daySeries.forEach((d) => {
        const height = maxDayMs > 0 ? Math.max(6, (d.ms * 100) / maxDayMs) : 0;
        html +=
          '<div class="stats-bar" title="' +
          escapeHtml(d.label) +
          ": " +
          formatDuration(d.ms) +
          '">' +
          '<div class="stats-bar-fill-vertical" style="height:' +
          height +
          '%"></div>' +
          '<div class="stats-bar-label">' +
          d.label +
          "</div>" +
          "</div>";
      });
      html += "</div>";
      html +=
        '<div class="stats-chart-footer">' +
        (weekMs ? formatDuration(weekMs) : "0 min") +
        " in the last 7 days" +
        "</div>";
      html += "</div></div>";

      html += '<div class="stats-card">';
      html += '<div class="stats-card-title">Confidence & highlights</div>';
      html += '<div class="stats-conf-bars">';
      html +=
        '<div class="stats-conf-row"><span class="conf-dot conf-low"></span><span>Low</span><div class="stats-conf-track"><div class="stats-conf-fill conf-low" style="width:' +
        confPct(confidenceBuckets.low) +
        '%;"></div></div><span class="stats-conf-num">' +
        confidenceBuckets.low +
        "</span></div>";
      html +=
        '<div class="stats-conf-row"><span class="conf-dot conf-mid"></span><span>Medium</span><div class="stats-conf-track"><div class="stats-conf-fill conf-mid" style="width:' +
        confPct(confidenceBuckets.mid) +
        '%;"></div></div><span class="stats-conf-num">' +
        confidenceBuckets.mid +
        "</span></div>";
      html +=
        '<div class="stats-conf-row"><span class="conf-dot conf-high"></span><span>High</span><div class="stats-conf-track"><div class="stats-conf-fill conf-high" style="width:' +
        confPct(confidenceBuckets.high) +
        '%;"></div></div><span class="stats-conf-num">' +
        confidenceBuckets.high +
        "</span></div>";
      html += "</div>";
      if (bestDay) {
        const dateLabel = new Date(bestDay.ts).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric"
        });
        html +=
          '<div class="stats-highlight">Best day: ' +
          dateLabel +
          " · " +
          formatDuration(bestDay.ms) +
          "</div>";
      }
      html += "</div>";
      html += "</div>";

      html += '<div class="stats-grid stats-grid-balanced">';
      html += '<div class="stats-card">';
      html += '<div class="stats-card-title">By subject</div>';
      if (!perSubject.length) {
        html += '<div class="stats-empty">No study time in this range yet.</div>';
      } else {
        html += '<div class="stats-list">';
        perSubject.forEach((s) => {
          const width = maxSubMs > 0 ? (s.totalMs * 100) / maxSubMs : 0;
          html +=
            '<div class="stats-row">' +
            '<div class="stats-row-header">' +
            '<div>' +
            '<div class="stats-row-title">' +
            escapeHtml(s.name) +
            "</div>" +
            '<div class="stats-row-subtitle">' +
            (s.sessions || 0) +
            " sessions" +
            "</div>" +
            "</div>" +
            '<div class="stats-row-time">' +
            formatDuration(s.totalMs) +
            "</div>" +
            "</div>" +
            '<div class="stats-bar-track">' +
            '<div class="stats-bar-fill" style="width:' +
            width +
            '%;"></div>' +
            "</div>" +
            "</div>";
        });
        html += "</div>";
      }
      html += "</div>";

      html += '<div class="stats-card">';
      html += '<div class="stats-card-title">Top files</div>';
      if (!topFiles.length) {
        html += '<div class="stats-empty">No sessions to rank yet.</div>';
      } else {
        html += '<div class="stats-list">';
        topFiles.forEach((e) => {
          const width = maxMs > 0 ? (e.totalMs * 100) / maxMs : 0;
          const sessionsLabel =
            (e.sessions || 0) +
            " session" +
            ((e.sessions || 0) === 1 ? "" : "s");
          html +=
            '<div class="stats-row">' +
            '<div class="stats-row-header">' +
            '<div>' +
            '<div class="stats-row-title">' +
            escapeHtml(e.fileName) +
            "</div>" +
            '<div class="stats-row-subtitle">' +
            escapeHtml(e.subjectName) +
            " · " +
            sessionsLabel +
            " · " +
            e.confidence +
            "% conf</div>" +
            "</div>" +
            '<div class="stats-row-time">' +
            formatDuration(e.totalMs) +
            "</div>" +
            "</div>" +
            '<div class="stats-bar-track">' +
            '<div class="stats-bar-fill" style="width:' +
            width +
            '%;"></div>' +
            "</div>" +
            "</div>";
        });
        html += "</div>";
      }
      html += "</div>";
      html += "</div>";

      if (!entries.length && totalMsRange === 0) {
        html =
          '<p class="stats-summary">No study sessions tracked yet. Start a timer on a file to collect data.</p>' +
          html;
      }

      statsBody.innerHTML = html;

      const rangeButtons = statsBody.querySelectorAll(".stats-range-btn");
      rangeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const r = btn.getAttribute("data-range");
          if (!r) return;
          statsRange = r;
          renderStatsModalContent();
        });
      });

      requestAnimationFrame(() => enforceTodayHeight());
    }

    function openStatsModal() {
      renderStatsModalContent();
      statsBackdrop.style.display = "flex";
    }

    function closeStatsModal() {
      statsBackdrop.style.display = "none";
    }

    // Timer settings modal helpers
    function clampMinutes(value, fallback) {
      const v = Number(value);
      if (!Number.isFinite(v) || v <= 0) return fallback;
      return Math.round(v);
    }

    function toggleInlineTimerPanel(show) {
      if (!timerInlinePanel) return;
      const visible = typeof show === "boolean" ? show : timerInlinePanel.hidden;
      if (visible) {
        timerInlinePanel.hidden = false;
        timerInlinePanel.style.display = "flex";
        if (timerInlineStudy) timerInlineStudy.value = pomoConfig.study || 25;
        if (timerInlineShort) timerInlineShort.value = pomoConfig.short || 5;
        if (timerInlineLong) timerInlineLong.value = pomoConfig.long || 15;
        if (focusCard) focusCard.classList.add("settings-open");
      } else {
        timerInlinePanel.hidden = true;
        timerInlinePanel.style.display = "none";
        if (focusCard) focusCard.classList.remove("settings-open");
      }
    }

    function applyTodayExpandedLayout() {
      if (!layoutRow) return;
      layoutRow.classList.toggle("today-full", todayExpanded || subjectsMaximized);
      if (todayList) {
        todayList.classList.toggle("today-list-grid", todayExpanded && !subjectsMaximized);
        // Only show a visible scrollbar in the compact (non-maximized) sidebar layout.
        todayList.classList.toggle("today-scroll-visible", !todayExpanded && !subjectsMaximized);
      }
      if (todaySidebar) {
        todaySidebar.classList.toggle("today-sidebar-full", todayExpanded && !subjectsMaximized);
      }
      if (todayDropZone) {
        todayDropZone.style.display = todayExpanded && !subjectsMaximized ? "none" : "";
      }
      if (todayHeaderActions && todayHeaderActions.firstChild) {
        const btn = todayHeaderActions.firstChild;
        btn.setAttribute("aria-pressed", todayExpanded ? "true" : "false");
        btn.dataset.state = todayExpanded ? "restore" : "maximize";
        btn.dataset.icon = todayExpanded ? "⤡" : "⤢";
      }
      const maxSubjectBtn = document.getElementById("maximizeSubjectsBtn");
      if (maxSubjectBtn) {
        maxSubjectBtn.setAttribute("aria-pressed", subjectsMaximized ? "true" : "false");
        maxSubjectBtn.textContent = subjectsMaximized ? "⤡" : "⤢";
      }
      renderTodayTodos();
      requestAnimationFrame(() => enforceTodayHeight());
    }

    function setActiveView(view) {
      activeView = view;
      if (layoutRow) {
        layoutRow.hidden = view !== "board";
        layoutRow.style.display = view === "board" ? "" : "none";
      }
      if (scheduleView) {
        scheduleView.hidden = view !== "schedule";
        scheduleView.style.display = view === "schedule" ? "block" : "none";
      }

      if (appRoot) {
        appRoot.classList.toggle("view-board", view === "board");
        appRoot.classList.toggle("view-schedule", view === "schedule");
      }

      if (viewBoardBtn) {
        viewBoardBtn.classList.toggle("view-toggle-active", view === "board");
        viewBoardBtn.setAttribute("aria-selected", view === "board" ? "true" : "false");
      }
      if (viewScheduleBtn) {
        viewScheduleBtn.classList.toggle("view-toggle-active", view === "schedule");
        viewScheduleBtn.setAttribute("aria-selected", view === "schedule" ? "true" : "false");
      }

      if (view === "schedule") {
        renderScheduleView();
        if (scheduleView) {
          scheduleView.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } else {
        applyTodayExpandedLayout();
      }
    }

    // Events

    if (todayHeaderActions) {
      const expandBtn = document.createElement("button");
      expandBtn.type = "button";
      expandBtn.className = "icon-btn today-maximize-btn";
      expandBtn.title = "Toggle focus width";
      expandBtn.dataset.icon = "⤢";
      expandBtn.addEventListener("click", () => {
        todayExpanded = !todayExpanded;
        applyTodayExpandedLayout();
      });
      todayHeaderActions.appendChild(expandBtn);

      const pickBtn = document.createElement("button");
      pickBtn.type = "button";
      pickBtn.className = "btn btn-secondary mobile-menu-only";
      pickBtn.id = "todayPickToggleBtn";
      pickBtn.textContent = "Add";
      pickBtn.addEventListener("click", () => {
        const open = !document.body.classList.contains("today-picker-open");
        document.body.classList.toggle("today-picker-open", open);
        pickBtn.textContent = open ? "Done" : "Add";
        renderTable();

        const target = open
          ? document.querySelector("#layoutRow .main-area")
          : document.querySelector("#layoutRow .today-sidebar");
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      todayHeaderActions.appendChild(pickBtn);

      applyTodayExpandedLayout();
    }

    if (editGoalBtn) {
      editGoalBtn.addEventListener("click", () => {
        const hoursValue = Math.max(1, Math.round((weeklyTargetMinutes || DEFAULT_WEEKLY_TARGET_MINUTES) / 60));
        openNoticePrompt("Set weekly target (hours)", String(hoursValue), (value) => {
          const hours = Number(value);
          if (!Number.isFinite(hours) || hours <= 0) {
            showNotice("Please enter hours greater than zero.", "warn");
            return;
          }
          weeklyTargetMinutes = Math.round(hours * 60);
          saveFocusConfig();
          updateGoalsAndStreaks();
          renderStatsModalContent();
          renderSmartSuggestions();
          renderDueSoonLane();
          showToast("Weekly target updated.", "success");
        });
      });

      applySubjectPaging();
    }

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (themeMenu && !themeMenu.hidden) {
          closeThemeMenu();
        } else {
          openThemeMenu();
        }
      });
    }
    let quickJumpTimer = null;
    function openQuickJump() {
      quickJumpDropdown?.classList.add("quick-open");
      quickJumpTrigger?.setAttribute("aria-expanded", "true");
    }
    function closeQuickJump() {
      quickJumpDropdown?.classList.remove("quick-open");
      quickJumpTrigger?.setAttribute("aria-expanded", "false");
    }
    quickJumpTrigger?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (quickJumpDropdown?.classList.contains("quick-open")) {
        closeQuickJump();
      } else {
        openQuickJump();
      }
    });
    quickJumpDropdown?.addEventListener("mouseenter", () => {
      if (quickJumpTimer) clearTimeout(quickJumpTimer);
      openQuickJump();
    });
    quickJumpDropdown?.addEventListener("mouseleave", () => {
      quickJumpTimer = window.setTimeout(closeQuickJump, 80);
    });
    quickJumpPanel?.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;
      closeQuickJump();
    });
    document.addEventListener("click", (event) => {
      if (quickJumpDropdown && quickJumpDropdown.contains(event.target)) return;
      closeQuickJump();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeQuickJump();
      }
    });

	    if (openSuggestionsBtn) {
	      openSuggestionsBtn.addEventListener("click", () => {
	        openSuggestionModal();
	      });
	    }

	    if (openReelsBreakBtn) {
	      openReelsBreakBtn.addEventListener("click", () => {
	        openReelsBreakModal();
	      });
	    }

	    if (suggestionModalCloseBtn) {
	      suggestionModalCloseBtn.addEventListener("click", () => {
	        closeSuggestionModal();
	      });
	    }

    if (suggestionModalCloseBtn2) {
      suggestionModalCloseBtn2.addEventListener("click", () => {
        closeSuggestionModal();
      });
    }

	    if (suggestionModalBackdrop) {
	      suggestionModalBackdrop.addEventListener("mousedown", (event) => {
	        if (event.target === suggestionModalBackdrop) {
	          closeSuggestionModal();
	        }
	      });
	    }

		    reelsBreakCloseBtn?.addEventListener("click", () => {
		      endReelsBreakNow();
		    });

		    reelsBreakEndBtn?.addEventListener("click", () => {
		      endReelsBreakNow();
		    });

		    function handleReelsOpenInstagramClick() {
		      const opened = openInstagramReelsWindow();
		      if (!opened) {
		        showToast("Popup blocked. Please allow popups for this site.", "warn");
		        setReelsBreakHint("If popups are blocked, use the embedded reel below.");
		        if (reelsBreakFrame && reelsBreakFrame.hidden) startDefaultEmbedMode();
		        return;
		      }
		      clearReelsEmbed();
		      setReelsBreakHint("");
		      setReelsBreakStatus("Reels break running in Instagram.");
		    }

		    reelsBreakOpenInstagramBtn?.addEventListener("click", handleReelsOpenInstagramClick);
		    reelsBreakOpenInstagramBtn2?.addEventListener("click", handleReelsOpenInstagramClick);

		    reelsBreakLoadBtn?.addEventListener("click", () => {
		      loadReelsEmbedFromInput();
		    });

		    reelsBreakUrlInput?.addEventListener("keydown", (event) => {
		      if (event.key !== "Enter") return;
		      event.preventDefault();
		      loadReelsEmbedFromInput();
		    });

		    reelsBreakModalBackdrop?.addEventListener("mousedown", (event) => {
		      if (event.target === reelsBreakModalBackdrop) {
		        endReelsBreakNow();
		      }
		    });

		    document.addEventListener("keydown", (event) => {
		      if (event.key === "Escape" && isReelsBreakOpen()) {
		        endReelsBreakNow();
		      }
		    });

		    reelsBreakIframe?.addEventListener("load", () => {
		      if (!reelsBreakIframe?.src || !reelsBreakIframe.src.includes("instagram.com")) return;
		      reelsBreakEmbedLoaded = true;
		      if (reelsBreakEmbedLoadTimer) {
		        clearTimeout(reelsBreakEmbedLoadTimer);
		        reelsBreakEmbedLoadTimer = null;
		      }
		      reelsBreakFrame?.classList.add("reels-loaded");
		      if (reelsBreakEmbedError) reelsBreakEmbedError.hidden = true;
		    });

	    if (tableWrapper) {
	      const blockDragSelector =
	        "button, input, select, textarea, option, .chip-btn, .file-row, .add-file-slot, .subject-add-box";
      let isPanning = false;
      let startX = 0;
      let startScroll = 0;

      tableWrapper.addEventListener(
        "wheel",
        (event) => {
          const prefersX = Math.abs(event.deltaX) > Math.abs(event.deltaY);
          if (event.shiftKey) {
            tableWrapper.scrollLeft += event.deltaY;
            event.preventDefault();
          } else if (prefersX && event.deltaX !== 0) {
            tableWrapper.scrollLeft += event.deltaX;
            event.preventDefault();
          }
        },
        { passive: false }
      );

      tableWrapper.addEventListener("mousedown", (event) => {
        if (event.button !== 0) return;
        if (event.target.closest(blockDragSelector)) return;
        isPanning = true;
        startX = event.pageX;
        startScroll = tableWrapper.scrollLeft;
        tableWrapper.classList.add("dragging-scroll");
      });

      document.addEventListener("mousemove", (event) => {
        if (!isPanning) return;
        const dx = event.pageX - startX;
        tableWrapper.scrollLeft = startScroll - dx;
      });

      document.addEventListener("mouseup", () => {
        if (!isPanning) return;
        isPanning = false;
        tableWrapper.classList.remove("dragging-scroll");
      });

      tableWrapper.addEventListener("mouseleave", () => {
        if (!isPanning) return;
        isPanning = false;
        tableWrapper.classList.remove("dragging-scroll");
      });
    }

    document.addEventListener("click", (event) => {
      if (!themeMenuOpen) return;
      if (themeSwitcher && event.target && themeSwitcher.contains(event.target)) return;
      closeThemeMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeThemeMenu();
        closeHeaderMenu();
      }
    });

    if (headerMenu) {
      headerMenu.addEventListener("mouseenter", openHeaderMenu);
      headerMenu.addEventListener("mouseleave", scheduleCloseHeaderMenu);
    }
    headerMenuToggle?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (headerMenu?.classList.contains("header-menu-open")) {
        closeHeaderMenu();
      } else {
        openHeaderMenu();
      }
    });
    headerMenuPanel?.addEventListener("mouseenter", openHeaderMenu);
    headerMenuPanel?.addEventListener("mouseleave", scheduleCloseHeaderMenu);
    document.addEventListener("click", (event) => {
      if (headerMenu && headerMenu.contains(event.target)) return;
      closeHeaderMenu();
    });
    headerSettingsBtn?.addEventListener("click", () => {
      closeHeaderMenu();
      openSettingsModal();
      setActiveSettingsPanel("settingsThemePanel");
    });
    headerProfileBtn?.addEventListener("click", () => {
      closeHeaderMenu();
      window.location.href = "./account.html";
    });

    // Phone navigation is handled via index.html?mode=... links.
    // Additional settings entry points removed in favor of a single Settings button
    settingsModalBackdrop?.addEventListener("click", closeSettingsModal);
    settingsModalCloseBtn?.addEventListener("click", closeSettingsModal);
    settingsNav?.addEventListener("click", (event) => {
      const btn = event.target.closest(".settings-nav-item");
      if (!btn) return;
      const target = btn.dataset.panel;
      if (target) setActiveSettingsPanel(target);
    });
    const settingsColorsSaveBtn = document.getElementById("settingsColorsSaveBtn");
    const settingsColorsResetBtn = document.getElementById("settingsColorsResetBtn");
    settingsColorsSaveBtn?.addEventListener("click", () => {
      const trimmed = subjectColors.filter(Boolean);
      saveColorPalette(trimmed.length ? [...trimmed] : [...DEFAULT_SUBJECT_COLORS]);
      const meterSelect = document.getElementById("settingsMeterStyleSelect");
      const barSelect = document.getElementById("settingsStudyBarStyleSelect");
      const meterSingle = document.getElementById("settingsMeterSingleInput");
      const meterGradStart = document.getElementById("settingsMeterGradStartInput");
      const meterGradEnd = document.getElementById("settingsMeterGradEndInput");
      const updates = {};
      if (meterSelect) updates.meter = meterSelect.value;
      if (barSelect) updates.studyBar = barSelect.value;
      if (meterSingle) updates.meterSingle = meterSingle.value;
      if (meterGradStart) updates.meterGradStart = meterGradStart.value;
      if (meterGradEnd) updates.meterGradEnd = meterGradEnd.value;
      applyStylePrefs(updates);
      saveStylePrefs();
      renderTable();
      renderTodayTodos();
      renderScheduleView();
      renderSmartSuggestions();
      updateTodayStudyUI();
      renderSettingsPreview();
      showNotice("Colors and styles saved.", "success");
    });

    ["settingsMeterSingleInput", "settingsMeterGradStartInput", "settingsMeterGradEndInput"].forEach((id) => {
      document.getElementById(id)?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        settingsColorsSaveBtn?.click();
      });
    });

    settingsColorsResetBtn?.addEventListener("click", () => {
      saveColorPalette([...DEFAULT_SUBJECT_COLORS]);
      renderSettingsColorsList();
      populateSettingsColorsControls();
      applyStylePrefs({ meter: "classic", studyBar: "rounded" });
      saveStylePrefs();
      renderTable();
      renderTodayTodos();
      renderScheduleView();
      renderSmartSuggestions();
      updateTodayStudyUI();
      renderSettingsPreview();
      showNotice("Palette reset to default.", "info");
    });
    const meterControls = [
      "settingsMeterStyleSelect",
      "settingsMeterSingleInput",
      "settingsMeterGradStartInput",
      "settingsMeterGradEndInput",
      "settingsStudyBarStyleSelect"
    ];
    meterControls.forEach((id) => {
      const el = document.getElementById(id);
      el?.addEventListener("input", () => {
        renderSettingsPreview();
      });
      el?.addEventListener("change", () => {
        renderSettingsPreview();
      });
    });
    timerModeCountdownBtn?.addEventListener("click", () => {
      if (!activeStudy) return;
      activeStudy.timerMode = "countdown";
      saveActiveSession();
      timerModeCountdownBtn.classList.add("focus-timer-active");
      timerModeStopwatchBtn?.classList.remove("focus-timer-active");
    });
    timerModeStopwatchBtn?.addEventListener("click", () => {
      if (!activeStudy) return;
      activeStudy.timerMode = "stopwatch";
      saveActiveSession();
      timerModeStopwatchBtn.classList.add("focus-timer-active");
      timerModeCountdownBtn?.classList.remove("focus-timer-active");
    });
    manualConfBtn?.addEventListener("click", () => {
      confidenceMode = "manual";
      localStorage.setItem(CONF_MODE_KEY, confidenceMode);
      manualConfBtn.classList.add("confidence-toggle-active");
      perceivedConfBtn?.classList.remove("confidence-toggle-active");
      renderTable();
      renderSmartSuggestions();
      updateSummary();
      renderTodayTodos();
    });
    perceivedConfBtn?.addEventListener("click", () => {
      confidenceMode = "perceived";
      localStorage.setItem(CONF_MODE_KEY, confidenceMode);
      perceivedConfBtn.classList.add("confidence-toggle-active");
      manualConfBtn?.classList.remove("confidence-toggle-active");
      renderTable();
      renderSmartSuggestions();
      updateSummary();
      renderTodayTodos();
    });
    function updateTimerModeButtons(mode) {
      if (mode === "stopwatch") {
        timerModeStopwatchBtn?.classList.add("focus-timer-active");
        timerModeCountdownBtn?.classList.remove("focus-timer-active");
        if (focusTimerLabel) focusTimerLabel.textContent = "Stopwatch";
      } else {
        timerModeCountdownBtn?.classList.add("focus-timer-active");
        timerModeStopwatchBtn?.classList.remove("focus-timer-active");
        if (focusTimerLabel) focusTimerLabel.textContent = "Countdown";
      }
    }
    timerModeCountdownBtn?.addEventListener("click", () => {
      timerModePref = "countdown";
      if (!activeStudy) {
        updateTimerModeButtons("countdown");
        return;
      }
      activeStudy.timerMode = "countdown";
      saveActiveSession();
      updateTimerModeButtons("countdown");
    });
    timerModeStopwatchBtn?.addEventListener("click", () => {
      timerModePref = "stopwatch";
      if (!activeStudy) {
        updateTimerModeButtons("stopwatch");
        return;
      }
      activeStudy.timerMode = "stopwatch";
      saveActiveSession();
      updateTimerModeButtons("stopwatch");
    });
    const maximizeSubjectsBtn = document.getElementById("maximizeSubjectsBtn");
    maximizeSubjectsBtn?.addEventListener("click", () => {
      toggleSubjectsMaximize();
    });
    expandPageBtn?.addEventListener("click", toggleExpand);
    window.addEventListener("resize", () => {
      enforceTodayHeight();
      applyDesktopSubjectSizing();
    });
    const settingsPrefsSaveBtn = document.getElementById("settingsPrefsSaveBtn");
    settingsPrefsSaveBtn?.addEventListener("click", () => {
      const langSelect = document.getElementById("settingsLanguageSelect");
      const contrastSelect = document.getElementById("settingsContrastSelect");
      const cvdSelect = document.getElementById("settingsCvdSelect");
      const study = document.getElementById("settingsStudyMinutes");
      const short = document.getElementById("settingsShortMinutes");
      const long = document.getElementById("settingsLongMinutes");
      if (langSelect) {
        saveLanguagePreference(langSelect.value);
      }
      if (contrastSelect) {
        applyStylePrefs({ contrast: contrastSelect.value });
        saveStylePrefs();
      }
      if (cvdSelect) {
        applyStylePrefs({ cvd: cvdSelect.value });
        saveStylePrefs();
        renderSettingsPreview();
        renderTable();
        renderTodayTodos();
        renderScheduleView();
        renderDueSoonLane();
        renderSmartSuggestions();
        updateTodayStudyUI();
        updateSummary();
      }
      const studyVal = Number(study?.value || pomoConfig.study);
      const shortVal = Number(short?.value || pomoConfig.short);
      const longVal = Number(long?.value || pomoConfig.long);
      if (!Number.isNaN(studyVal) && studyVal > 0) pomoConfig.study = studyVal;
      if (!Number.isNaN(shortVal) && shortVal > 0) pomoConfig.short = shortVal;
      if (!Number.isNaN(longVal) && longVal > 0) pomoConfig.long = longVal;
      saveFocusConfig();
      showNotice("Preferences saved.", "success");
    });

    ["settingsStudyMinutes", "settingsShortMinutes", "settingsLongMinutes"].forEach((id) => {
      document.getElementById(id)?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        settingsPrefsSaveBtn?.click();
      });
    });

    settingsThemePickerBtn?.addEventListener("click", () => {
      closeSettingsModal();
      openHeaderMenu();
      themeToggleBtn?.focus();
    });
    document.addEventListener("mousemove", (event) => {
      if (!headerMenu) return;
      const rect = headerMenu.getBoundingClientRect();
      if (
        event.clientX < rect.left - 20 ||
        event.clientX > rect.right + 200 ||
        event.clientY < rect.top - 20 ||
        event.clientY > rect.bottom + 80
      ) {
        scheduleCloseHeaderMenu();
      }
    });

    if (viewBoardBtn) {
      viewBoardBtn.addEventListener("click", () => setActiveView("board"));
    }

    if (viewScheduleBtn) {
      viewScheduleBtn.addEventListener("click", () => setActiveView("schedule"));
    }

    // Filter removed

    if (schedulePrevWeekBtn) {
      schedulePrevWeekBtn.addEventListener("click", () => {
        if (isPhoneLayout()) {
          const cursor = getScheduleCursorDay();
          cursor.setDate(cursor.getDate() - 1);
          scheduleCursorDay = cursor;
        } else {
          if (!scheduleWeekStart) scheduleWeekStart = getWeekStart(new Date());
          scheduleWeekStart.setDate(scheduleWeekStart.getDate() - 7);
        }
        renderScheduleView();
      });
    }

    if (scheduleNextWeekBtn) {
      scheduleNextWeekBtn.addEventListener("click", () => {
        if (isPhoneLayout()) {
          const cursor = getScheduleCursorDay();
          cursor.setDate(cursor.getDate() + 1);
          scheduleCursorDay = cursor;
        } else {
          if (!scheduleWeekStart) scheduleWeekStart = getWeekStart(new Date());
          scheduleWeekStart.setDate(scheduleWeekStart.getDate() + 7);
        }
        renderScheduleView();
      });
    }

    if (scheduleTodayBtn) {
      scheduleTodayBtn.addEventListener("click", () => {
        if (isPhoneLayout()) {
          scheduleCursorDay = new Date();
        } else {
          scheduleWeekStart = getWeekStart(new Date());
        }
        renderScheduleView();
      });
    }

    if (scheduleTaskCloseBtn) {
      scheduleTaskCloseBtn.addEventListener("click", () => {
        closeScheduleTaskModal();
      });
    }

    if (noticeModalCancelBtn) {
      noticeModalCancelBtn.addEventListener("click", closeNotice);
    }

    if (noticeModalConfirmBtn) {
      noticeModalConfirmBtn.addEventListener("click", () => {
        if (noticeResolver) {
          noticeResolver(null);
          noticeResolver = null;
        }
        if (noticeConfirmHandler) {
          const handler = noticeConfirmHandler;
          noticeConfirmHandler = null;
          handler();
        }
        closeNotice();
      });
    }

    if (addTodoModalCancel) {
      addTodoModalCancel.addEventListener("click", () => {
        closeAddTodoModal();
      });
    }
    addTodoSubtaskAdd?.addEventListener("click", addSubtaskFromInput);
    addTodoSubtaskInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addSubtaskFromInput();
      }
    });
    addTodoModalClose?.addEventListener("click", () => closeAddTodoModal());
    addTodoModalSave?.addEventListener("click", () => submitAddTodoModal());
    addTodoModalBackdrop?.addEventListener("mousedown", (event) => {
      if (event.target === addTodoModalBackdrop) {
        closeAddTodoModal();
      }
    });

    if (noticeModalBackdrop) {
    noticeModalBackdrop.addEventListener("mousedown", (event) => {
      if (event.target === noticeModalBackdrop) {
        closeNotice();
      }
    });
    }

    if (subjectSettingsBackdrop) {
      subjectSettingsBackdrop.addEventListener("mousedown", (event) => {
        if (event.target === subjectSettingsBackdrop) closeSubjectSettingsModal();
      });
    }
    subjectSettingsCloseBtn?.addEventListener("click", closeSubjectSettingsModal);
    subjectSettingsCancelBtn?.addEventListener("click", closeSubjectSettingsModal);

    subjectSettingsCustomColor?.addEventListener("input", () => {
      const v = String(subjectSettingsCustomColor.value || "").trim();
      if (isHexColor(v)) {
        subjectSettingsTempColor = v;
        renderSubjectSettingsSwatches(v);
        updateSubjectSettingsPreview();
      }
    });

    subjectSettingsSaveBtn?.addEventListener("click", () => {
      if (!subjectSettingsState) return;
      const subj = subjects.find((s) => s.id === subjectSettingsState.subjectId);
      if (!subj) return closeSubjectSettingsModal();

      const nextName = String(subjectSettingsNameInput?.value || "").trim();
      if (nextName) {
        subj.name = nextName;
        renameSubjectEverywhere(subj.id, nextName);
      }

      if (subjectSettingsTempColor && isHexColor(subjectSettingsTempColor)) {
        subj.color = subjectSettingsTempColor;
      }

      const alpha = Number(subjectSettingsStrength?.value);
      if (Number.isFinite(alpha)) {
        subj.tintAlpha = Math.max(0.05, Math.min(0.6, alpha));
      }

      saveToStorage();
      renderSubjectOptions();
      renderTable();
      renderTodayTodos();
      renderScheduleView();
      closeSubjectSettingsModal();
    });

    if (scheduleTaskModalBackdrop) {
      scheduleTaskModalBackdrop.addEventListener("mousedown", (event) => {
        if (event.target === scheduleTaskModalBackdrop) {
          closeScheduleTaskModal();
        }
      });
    }

    if (todayDropZone) {
      todayDropZone.addEventListener("dragenter", (event) => {
        if (!dragState) return;
        event.preventDefault();
        todayDropZone.classList.add("today-dropzone-active");
      });
      todayDropZone.addEventListener("dragover", (event) => {
        if (!dragState) return;
        event.preventDefault();
        todayDropZone.classList.add("today-dropzone-active");
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      });
      todayDropZone.addEventListener("dragleave", () => {
        todayDropZone.classList.remove("today-dropzone-active");
      });
      todayDropZone.addEventListener("drop", (event) => {
        event.preventDefault();
        todayDropZone.classList.remove("today-dropzone-active");
        if (!dragState) return;
        addTodoForFile(dragState.subjectId, dragState.fileId);
        dragState = null;
      });
    }

    modalConfidenceRange.addEventListener("input", () => {
      modalConfidenceValue.textContent = modalConfidenceRange.value + "%";
    });

    modalCancelBtn.addEventListener("click", () => {
      closeFileModal();
    });

    fileModalCloseBtn.addEventListener("click", () => {
      closeFileModal();
    });

    fileModalBackdrop.addEventListener("mousedown", (event) => {
      if (event.target === fileModalBackdrop) {
        closeFileModal();
      }
    });

    const clickFileSaveOnEnter = (input) => {
      input?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        modalSaveBtn?.click();
      });
    };
    clickFileSaveOnEnter(modalFileNameInput);
    clickFileSaveOnEnter(modalFileNotesInput);

    modalSaveBtn.addEventListener("click", () => {
      if (!fileModalState) return;

      const fileName = modalFileNameInput.value.trim();
      const notes = modalFileNotesInput.value.trim();
      const conf = Number(modalConfidenceRange.value);
      const selectedSubjectId = modalSubjectSelect.value;

      if (!subjects.length) {
        showNotice("Please create a subject first.", "warn");
        return;
      }

      if (!fileName) {
        showNotice("Please enter a file or topic name.", "warn");
        return;
      }

      const targetSubject =
        subjects.find((s) => s.id === selectedSubjectId) || subjects[0];

      if (fileModalState.mode === "add") {
        const newFile = {
          id: createId(),
          name: fileName,
          notes,
          confidence: conf,
          lastReviewed: null,
          totalMs: 0,
          sessions: 0,
          lastSessionMs: 0
        };
        targetSubject.files.push(newFile);
        updateManualOrder(targetSubject);
      } else {
        const originalSubject = subjects.find(
          (s) => s.id === fileModalState.subjectId
        );
        if (!originalSubject) {
          closeFileModal();
          renderTable();
          return;
        }
        const file = originalSubject.files.find(
          (f) => f.id === fileModalState.fileId
        );
        if (!file) {
          closeFileModal();
          renderTable();
          return;
        }

        if (originalSubject.id === targetSubject.id) {
          file.name = fileName;
          file.notes = notes;
          file.confidence = conf;
          updateManualOrder(originalSubject);
          syncTodoForFile(
            originalSubject.id,
            originalSubject.id,
            file.id,
            fileName,
            originalSubject.name
          );
        } else {
            originalSubject.files = originalSubject.files.filter(
              (f) => f.id !== fileModalState.fileId
            );
            updateManualOrder(originalSubject);
            const movedFile = {
              id: fileModalState.fileId,
              name: fileName,
              notes,
              confidence: conf,
              lastReviewed: file.lastReviewed || null,
              totalMs: file.totalMs || 0,
              sessions: file.sessions || 0,
              lastSessionMs: file.lastSessionMs || 0,
              dailyMsPacked: file.dailyMsPacked || packLegacyDayObject(file.dailyMs),
              dailySessionsPacked: file.dailySessionsPacked || packLegacyDayObject(file.dailySessions)
            };
            targetSubject.files.push(movedFile);
            updateManualOrder(targetSubject);
            syncTodoForFile(
              originalSubject.id,
              targetSubject.id,
              fileModalState.fileId,
            fileName,
            targetSubject.name
          );
        }
      }

      saveToStorage();
      closeFileModal();
      renderTable();
    });

    modalDeleteBtn.addEventListener("click", () => {
      if (!fileModalState || fileModalState.mode !== "edit") {
        closeFileModal();
        return;
      }
      const subj = subjects.find((s) => s.id === fileModalState.subjectId);
      if (!subj) {
        closeFileModal();
        return;
      }
      const file = subj.files.find((f) => f.id === fileModalState.fileId);
      if (!file) {
        closeFileModal();
        return;
      }
      if (
        !confirm(
          `Delete file "${file.name}" from subject "${subj.name}"?`
        )
      ) {
        return;
      }

      if (
        activeStudy &&
        activeStudy.kind === "study" &&
        activeStudy.subjectId === subj.id &&
        activeStudy.fileId === file.id
      ) {
        activeStudy = null;
        clearActiveSession();
      }

      subj.files = subj.files.filter((f) => f.id !== fileModalState.fileId);
      cleanupTodoForFile(subj.id, file.id);
      saveToStorage();
      closeFileModal();
      renderTable();
      renderFocusState();
    });

    // Timer settings modal
    openTimerSettingsBtn.addEventListener("click", () => {
      toggleInlineTimerPanel(true);
    });

    if (timerInlineCancel) {
      timerInlineCancel.addEventListener("click", () => {
        toggleInlineTimerPanel(false);
      });
    }

    if (timerInlineSave) {
      timerInlineSave.addEventListener("click", () => {
        const newStudy = clampMinutes(timerInlineStudy.value, pomoConfig.study || 25);
        const newShort = clampMinutes(timerInlineShort.value, pomoConfig.short || 5);
        const newLong = clampMinutes(timerInlineLong.value, pomoConfig.long || 15);

        pomoConfig.study = newStudy;
        pomoConfig.short = newShort;
        pomoConfig.long = newLong;
        saveFocusConfig();
        renderSmartSuggestions();
        renderDueSoonLane();
        toggleInlineTimerPanel(false);
      });

      const clickTimerInlineSaveOnEnter = (input) => {
        input?.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          timerInlineSave.click();
        });
      };
      clickTimerInlineSaveOnEnter(timerInlineStudy);
      clickTimerInlineSaveOnEnter(timerInlineShort);
      clickTimerInlineSaveOnEnter(timerInlineLong);
    }

    // Break buttons
    startShortBreakBtn.addEventListener("click", () => {
      startBreak("short");
    });

    startLongBreakBtn.addEventListener("click", () => {
      startBreak("long");
    });

    // Stats modal
    openStatsBtn.addEventListener("click", () => {
      openStatsModal();
    });

    statsCloseBtn.addEventListener("click", () => {
      closeStatsModal();
    });

    statsCloseBtn2.addEventListener("click", () => {
      closeStatsModal();
    });

    statsBackdrop.addEventListener("mousedown", (event) => {
      if (event.target === statsBackdrop) {
        closeStatsModal();
      }
    });

    const subjectPrevBtn = document.getElementById("subjectPrevBtn");
    const subjectNextBtn = document.getElementById("subjectNextBtn");
    const subjectBackBtn = document.getElementById("subjectBackBtn");
    subjectPrevBtn?.addEventListener("click", () => {
      subjectCursorIndex = Math.max(0, subjectCursorIndex - 1);
      applySubjectPaging();
    });
    subjectNextBtn?.addEventListener("click", () => {
      subjectCursorIndex = subjectCursorIndex + 1;
      applySubjectPaging();
    });
    subjectBackBtn?.addEventListener("click", () => {
      if (
        document.body.dataset.mode === "today" &&
        document.body.classList.contains("today-picker-open")
      ) {
        document.body.classList.remove("today-picker-open");
        const pickBtn = document.getElementById("todayPickToggleBtn");
        if (pickBtn) pickBtn.textContent = "Add";
        renderTable();
        const sidebar = document.querySelector("#layoutRow .today-sidebar");
        sidebar?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    function getPageMode() {
      const mode = new URLSearchParams(window.location.search).get("mode");
      if (mode === "subjects" || mode === "today" || mode === "schedule") return mode;
      return "board";
    }

	    function applyPageMode() {
	      const mode = getPageMode();
	      document.body.dataset.mode = mode;
	      applySubjectPaging();
	    }

	    function applySyncedStateFromStorage() {
	      loadThemePreference();
	      loadColorPalette();
	      loadStylePrefs();
	      applyStylePrefs();

	      const savedConfMode = localStorage.getItem(CONF_MODE_KEY);
	      confidenceMode = savedConfMode === "perceived" ? "perceived" : "manual";
	      if (confidenceMode === "perceived") {
	        perceivedConfBtn?.classList.add("confidence-toggle-active");
	        manualConfBtn?.classList.remove("confidence-toggle-active");
	      } else {
	        manualConfBtn?.classList.add("confidence-toggle-active");
	        perceivedConfBtn?.classList.remove("confidence-toggle-active");
	      }

	      saveLanguagePreference(loadLanguagePreference());
	      loadFromStorage();
	      loadDailyFocusMap();
	      loadTodayTodos();
	      loadFocusConfig();
	      loadCalendarEvents();

	      if (activeStudy && activeStudy.kind === "study") {
	        const { subj, file } = resolveFileRef(activeStudy.subjectId, activeStudy.fileId);
	        if (!subj || !file) {
	          activeStudy = null;
	          clearActiveSession();
	        }
	      }

	      renderSubjectOptions();
	      renderFocusState();
	      renderTodayTodos();
	      applyPageMode();
	      renderTable();
	      if (activeView === "schedule") {
	        renderScheduleView();
	      } else {
	        applyTodayExpandedLayout();
	      }
	      updateHeaderProfileLabel();
	    }

	    window.addEventListener("study:state-replaced", () => {
	      applySyncedStateFromStorage();
	    });

	    function maybeAutoResumeNavPausedSession() {
	      if (
	        activeStudy &&
	        activeStudy.paused &&
        activeStudy.pausedReason === "nav" &&
        activeStudy.autoResume === true
      ) {
        resumeActiveSession({ clearNavFlags: true });
      }
    }

    // Initial load
    loadThemePreference();
    loadColorPalette();
    loadStylePrefs();
    applyStylePrefs();
    const savedConfMode = localStorage.getItem(CONF_MODE_KEY);
    if (savedConfMode === "perceived") confidenceMode = "perceived";
    if (confidenceMode === "perceived") {
      perceivedConfBtn?.classList.add("confidence-toggle-active");
      manualConfBtn?.classList.remove("confidence-toggle-active");
    }
    saveLanguagePreference(loadLanguagePreference());
    loadFromStorage();
    activeStudy = loadActiveSession();
    maybeAutoResumeNavPausedSession();
    loadDailyFocusMap();
    loadTodayTodos();
    loadFocusConfig();
    loadCalendarEvents();
    saveToStorage();
    scheduleWeekStart = getWeekStart(new Date());
    renderSubjectOptions();
    renderFocusState();
    renderTodayTodos();
    renderTable();
    applyPageMode();
    setActiveView(getPageMode() === "schedule" ? "schedule" : "board");
    updateHeaderProfileLabel();

    // If the user navigates away (calendar, schedule, etc.), pause the timer and
    // auto-resume when coming back to the main page.
    window.addEventListener("pagehide", () => {
      pauseActiveSession("nav", { autoResume: true });
    });

    // BFCache restore: auto-resume again when returning to this page.
    window.addEventListener("pageshow", (event) => {
      if (!event.persisted) return;
      maybeAutoResumeNavPausedSession();
      renderFocusState();
      updateStudyTimerDisplay();
    });
