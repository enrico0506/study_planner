(() => {
  const StudyPlanner = window.StudyPlanner || (window.StudyPlanner = {});
  const Storage = StudyPlanner.Storage || null;

  const ACTIVE_KEY = "studySessionHeaderActive_v1";
  const SESSIONS_KEY = "studySessions_v1";
  const MIN_MS = 3 * 60 * 1000;

  function safeParse(raw) {
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
      const parsed = safeParse(raw);
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

  function formatHMS(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  }

  function formatDuration(ms) {
    if (!ms || ms <= 0) return "0 min";
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem ? `${h}h ${rem}m` : `${h}h`;
  }

  function loadActive() {
    const data = getJSON(ACTIVE_KEY, null);
    if (!data || typeof data !== "object") return null;
    const { running, startedAtMs, accumulatedMs } = data;
    if (running && !startedAtMs) return null;
    return {
      running: !!running,
      startedAtMs: startedAtMs || null,
      accumulatedMs: Number(accumulatedMs) || 0,
      meta: data.meta || {},
    };
  }

  function saveActive(state) {
    if (!state) {
      setJSON(ACTIVE_KEY, null, { debounceMs: 0 });
      return;
    }
    setJSON(ACTIVE_KEY, state, { debounceMs: 0 });
  }

  function computeElapsed(active) {
    if (!active) return 0;
    const base = Number(active.accumulatedMs) || 0;
    if (!active.running || !active.startedAtMs) return base;
    return base + (Date.now() - active.startedAtMs);
  }

  function loadSessions() {
    return getJSON(SESSIONS_KEY, []);
  }

  function getSessionJournal() {
    return StudyPlanner && StudyPlanner.SessionJournal ? StudyPlanner.SessionJournal : null;
  }

  function computeTotals(sessions) {
    const list = Array.isArray(sessions) ? sessions : [];
    return {
      today: sumToday(list),
      week: sumThisWeek(list),
      month: sumInRange(list, 30),
    };
  }

  function sumThisWeek(sessions) {
    const now = new Date();
    const weekdayMon0 = (now.getDay() + 6) % 7; // Monday=0
    now.setHours(0, 0, 0, 0);
    now.setDate(now.getDate() - weekdayMon0);
    const start = now.getTime();
    const end = start + 7 * 86400000;
    let total = 0;
    sessions.forEach((s) => {
      const endMs = s && s.endedAt ? new Date(s.endedAt).getTime() : null;
      if (endMs == null || Number.isNaN(endMs)) return;
      if (endMs < start || endMs >= end) return;
      total += Math.max(0, Number(s.durationMs || (s.durationMinutes || 0) * 60000) || 0);
    });
    return total;
  }

  function sumInRange(sessions, days) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const cutoff = now.getTime() - (days - 1) * 86400000;
    let total = 0;
    sessions.forEach((s) => {
      const end = s && s.endedAt ? new Date(s.endedAt).getTime() : null;
      if (end == null || Number.isNaN(end)) return;
      if (end < cutoff) return;
      total += Math.max(0, Number(s.durationMs || (s.durationMinutes || 0) * 60000) || 0);
    });
    return total;
  }

  function sumToday(sessions) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = today.getTime();
    const end = start + 86400000;
    let total = 0;
    sessions.forEach((s) => {
      const endMs = s && s.endedAt ? new Date(s.endedAt).getTime() : null;
      if (endMs == null || Number.isNaN(endMs)) return;
      if (endMs < start || endMs >= end) return;
      total += Math.max(0, Number(s.durationMs || (s.durationMinutes || 0) * 60000) || 0);
    });
    return total;
  }

  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function buildHeaderDOM(variant) {
    const root = createEl("div", "session-header");
    const stats = createEl("div", "session-stats");
    const today = createEl("div", "session-stat");
    today.append(createEl("div", "session-stat-label", "Today"), createEl("div", "session-stat-value", "0 min"));
    const week = createEl("div", "session-stat");
    week.append(createEl("div", "session-stat-label", "This week"), createEl("div", "session-stat-value", "0 min"));
    const month = createEl("div", "session-stat");
    month.append(createEl("div", "session-stat-label", "30 days"), createEl("div", "session-stat-value", "0 min"));
    stats.append(today, week, month);

    const card = createEl("div", "session-card");
    const cardLeft = createEl("div", "session-card-left");
    const label = createEl("div", "session-card-label", "Focus session");
    const title = createEl("div", "session-card-title", "Idle");
    const subtitle = createEl("div", "session-card-subtitle", "");
    cardLeft.append(label, title, subtitle);

    const cardRight = createEl("div", "session-card-right");
    const timer = createEl("div", "session-card-timer", "00:00:00");
    const controls = createEl("div", "session-card-actions");
    const startBtn = createEl("button", "focus-main-btn focus-main-btn-primary", "Start");
    startBtn.type = "button";
    const pauseBtn = createEl("button", "focus-main-btn", "Pause");
    pauseBtn.type = "button";
    const stopBtn = createEl("button", "focus-main-btn focus-main-btn-danger", "Stop");
    stopBtn.type = "button";
    controls.append(startBtn, pauseBtn, stopBtn);
    cardRight.append(timer, controls);

    card.append(cardLeft, cardRight);
    root.append(stats, card);
    if (variant === "full") {
      root.classList.add("session-header-full");
    } else {
      root.classList.add("session-header-compact");
    }
    return {
      root,
      stats: { today, week, month },
      timer,
      title,
      subtitle,
      startBtn,
      pauseBtn,
      stopBtn,
    };
  }

  function mountSessionHeader({ mountEl, variant = "full", context = {} } = {}) {
    if (!mountEl) return null;
    if (mountEl.__sessionHeaderInstance && typeof mountEl.__sessionHeaderInstance.destroy === "function") {
      mountEl.__sessionHeaderInstance.destroy();
    }
    const ui = buildHeaderDOM(variant);
    mountEl.innerHTML = "";
    mountEl.appendChild(ui.root);

    let active = loadActive();
    let sessionsCache = loadSessions();
    if (!Array.isArray(sessionsCache)) sessionsCache = [];
    let cachedTotals = computeTotals(sessionsCache);
    let lastSessionsRefreshMs = 0;

    function updateStats() {
      const baseTotals = cachedTotals || { today: 0, week: 0, month: 0 };
      const elapsed = computeElapsed(active);
      ui.stats.today.querySelector(".session-stat-value").textContent = formatDuration(baseTotals.today + elapsed);
      ui.stats.week.querySelector(".session-stat-value").textContent = formatDuration(baseTotals.week);
      ui.stats.month.querySelector(".session-stat-value").textContent = formatDuration(baseTotals.month);
    }

    function renderState() {
      const elapsed = computeElapsed(active);
      ui.timer.textContent = formatHMS(elapsed);
      if (!active || !active.running) {
        ui.title.textContent = "Paused";
        ui.subtitle.textContent = context.source ? String(context.source) : "Ready";
        ui.startBtn.textContent = active && active.accumulatedMs > 0 ? "Resume" : "Start";
      } else {
        ui.title.textContent = "Running";
        ui.subtitle.textContent = context.source ? String(context.source) : "In progress";
        ui.startBtn.textContent = "Running";
      }
      ui.startBtn.disabled = !!(active && active.running);
      ui.pauseBtn.disabled = !active || !active.running;
      ui.stopBtn.disabled = !active || (!active.running && !active.accumulatedMs);
    }

    function persist() {
      saveActive(active);
      renderState();
      updateStats();
    }

    function ensureActive() {
      if (!active) {
        active = {
          running: false,
          startedAtMs: null,
          accumulatedMs: 0,
          meta: { ...context },
        };
      }
    }

    function startOrResume() {
      ensureActive();
      if (active.running) return;
      active.running = true;
      active.startedAtMs = Date.now();
      active.meta = { ...active.meta, ...context };
      persist();
    }

    function pause(reason = "manual") {
      if (!active || !active.running) return;
      const now = Date.now();
      active.accumulatedMs += now - (active.startedAtMs || now);
      active.running = false;
      active.startedAtMs = null;
      active.meta.pausedReason = reason;
      persist();
    }

    function stop() {
      if (!active) return;
      const now = Date.now();
      const elapsed = computeElapsed(active);
      const startedAt = active.startedAtMs ? active.startedAtMs : now - Math.max(elapsed, 0);
      active.running = false;
      active.startedAtMs = null;
      active.accumulatedMs = elapsed;
      const minMs = typeof active.meta?.minMs === "number" ? Math.max(0, active.meta.minMs) : MIN_MS;
      const journal = getSessionJournal();
      if (elapsed >= minMs && journal && typeof journal.appendSession === "function") {
        journal.appendSession({
          id: `sess_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
          startedAt: new Date(startedAt).toISOString(),
          endedAt: new Date(startedAt + elapsed).toISOString(),
          durationMs: elapsed,
          durationMinutes: Math.max(1, Math.round(elapsed / 60000)),
          source: active.meta?.source || context.source || "focus",
          deckId: active.meta?.deckId || null,
          mode: active.meta?.mode || null,
        });
      }
      active = null;
      saveActive(null);
      renderState();
      updateStats();
    }

    const handleStartClick = () => startOrResume();
    const handlePauseClick = () => pause("manual");
    const handleStopClick = () => stop();

    ui.startBtn.addEventListener("click", handleStartClick);
    ui.pauseBtn.addEventListener("click", handlePauseClick);
    ui.stopBtn.addEventListener("click", handleStopClick);

    const handleVisibilityChange = () => {
      if (document.hidden) pause("hidden");
    };
    const handleBeforeUnload = () => pause("nav");

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    const handleSessionsUpdated = () => refreshSessionsFromStorage();
    const handleStorage = (event) => {
      if (event && event.key && event.key !== SESSIONS_KEY) return;
      refreshSessionsFromStorage();
    };
    const handleStateReplaced = () => refreshSessionsFromStorage();

    window.addEventListener("study:sessions-updated", handleSessionsUpdated);
    window.addEventListener("study:sessions-changed", handleSessionsUpdated);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("study:state-replaced", handleStateReplaced);

    let tickHandle = null;
    function tick() {
      renderState();
      const now = Date.now();
      if (now - lastSessionsRefreshMs > 60000) {
        refreshSessionsFromStorage();
      } else {
        updateStats();
      }
    }
    tickHandle = setInterval(tick, 1000);

    function refreshSessionsFromStorage() {
      const next = loadSessions();
      sessionsCache = Array.isArray(next) ? next : [];
      cachedTotals = computeTotals(sessionsCache);
      lastSessionsRefreshMs = Date.now();
      updateStats();
    }

    refreshSessionsFromStorage();
    tick();
    const instance = {
      start: startOrResume,
      pause,
      stop,
      setContext(meta) {
        context = { ...context, ...meta };
        if (active && active.meta) active.meta = { ...active.meta, ...meta };
        persist();
      },
      destroy() {
        if (tickHandle) clearInterval(tickHandle);
        ui.startBtn.removeEventListener("click", handleStartClick);
        ui.pauseBtn.removeEventListener("click", handlePauseClick);
        ui.stopBtn.removeEventListener("click", handleStopClick);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("beforeunload", handleBeforeUnload);
        window.removeEventListener("study:sessions-updated", handleSessionsUpdated);
        window.removeEventListener("study:sessions-changed", handleSessionsUpdated);
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener("study:state-replaced", handleStateReplaced);
        mountEl.__sessionHeaderInstance = null;
      },
    };

    mountEl.__sessionHeaderInstance = instance;
    return instance;
  }

  StudyPlanner.mountSessionHeader = mountSessionHeader;
})();
