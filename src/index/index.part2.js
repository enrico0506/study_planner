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

