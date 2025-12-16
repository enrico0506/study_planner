(() => {
  const existing = window.StudyPlanner && typeof window.StudyPlanner === "object" ? window.StudyPlanner : {};
  const StudyPlanner = (window.StudyPlanner = existing);
  const Storage = StudyPlanner.Storage || null;

  const SESSIONS_KEY = "studySessions_v1";

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

  function setJSON(key, value, { debounceMs = 150 } = {}) {
    if (Storage) return Storage.setJSON(key, value, { debounceMs });
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function appendSession(entry) {
    const list = getJSON(SESSIONS_KEY, []);
    const next = Array.isArray(list) ? list.slice() : [];
    next.push(entry);
    while (next.length > 2500) next.shift();
    setJSON(SESSIONS_KEY, next, { debounceMs: 0 });
    try {
      window.dispatchEvent(new CustomEvent("study:sessions-changed"));
      window.dispatchEvent(new CustomEvent("study:sessions-updated"));
    } catch {}
  }

  function isoFromMs(ms) {
    return new Date(ms).toISOString();
  }

  function showToastSafe(message, tone = "info") {
    if (typeof window.showToast === "function") return window.showToast(message, tone);
    try {
      const div = document.createElement("div");
      div.style.position = "fixed";
      div.style.bottom = "16px";
      div.style.left = "16px";
      div.style.padding = "10px 12px";
      div.style.borderRadius = "12px";
      div.style.background = "rgba(15,23,42,0.9)";
      div.style.color = "white";
      div.style.zIndex = "9999";
      div.textContent = message;
      document.body.appendChild(div);
      setTimeout(() => div.remove(), 2200);
    } catch {}
  }

  const ui = {
    backdrop: document.getElementById("sessionRecapBackdrop"),
    closeBtn: document.getElementById("sessionRecapCloseBtn"),
    skipBtn: document.getElementById("sessionRecapSkipBtn"),
    saveBtn: document.getElementById("sessionRecapSaveBtn"),
    subtitle: document.getElementById("sessionRecapSubtitle"),
    text: document.getElementById("sessionRecapText"),
    rating: document.getElementById("sessionRecapRating"),
    conf: document.getElementById("sessionRecapConfidence"),
    confValue: document.getElementById("sessionRecapConfidenceValue"),
    tags: document.getElementById("sessionRecapTags"),
    meta: document.getElementById("sessionRecapMeta"),
  };

  if (!ui.backdrop || !ui.saveBtn) {
    StudyPlanner.SessionJournal = Object.assign(StudyPlanner.SessionJournal || {}, { SESSIONS_KEY, appendSession });
    return;
  }

  let pending = null; // { kind, subjectId, fileId, assignmentId, elapsedMs, endedAtMs, startedAtMs, confidenceBefore }

  function openModal() {
    ui.backdrop.hidden = false;
    ui.backdrop.style.display = "flex";
    ui.text?.focus();
  }

  function closeModal() {
    ui.backdrop.style.display = "none";
    ui.backdrop.hidden = true;
  }

  function setConfidenceUi(value, enabled) {
    if (!ui.conf || !ui.confValue) return;
    ui.conf.disabled = !enabled;
    ui.conf.value = String(value == null ? 50 : value);
    ui.confValue.textContent = `${ui.conf.value}%`;
  }

  function resetUi() {
    if (ui.text) ui.text.value = "";
    if (ui.rating) ui.rating.value = "";
    if (ui.tags) ui.tags.value = "";
    if (ui.meta) ui.meta.textContent = "";
    setConfidenceUi(50, false);
  }

  function applyConfidenceUpdate() {
    if (!pending || !pending.subjectId || !pending.fileId) return { changed: false };
    if (!window.subjects || !Array.isArray(window.subjects)) return { changed: false };
    const subj = window.subjects.find((s) => s && s.id === pending.subjectId);
    const file = subj && Array.isArray(subj.files) ? subj.files.find((f) => f && f.id === pending.fileId) : null;
    if (!file) return { changed: false };
    const after = Number(ui.conf?.value);
    if (!Number.isFinite(after)) return { changed: false };
    const before = Number(file.confidence);
    if (Number.isFinite(before) && before === after) return { changed: false };
    file.confidence = after;
    try {
      if (typeof window.saveToStorage === "function") window.saveToStorage();
    } catch {}
    return { changed: true, after, before: Number.isFinite(before) ? before : null };
  }

  function saveRecap() {
    if (!pending) return closeModal();
    const endedAtMs = pending.endedAtMs || Date.now();
    const startedAtMs = pending.startedAtMs || Math.max(0, endedAtMs - (pending.elapsedMs || 0));
    const durationMinutes = Math.max(1, Math.round((pending.elapsedMs || 0) / 60000));

    const confUpdate = applyConfidenceUpdate();
    const entry = {
      id: `sess_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      startedAt: isoFromMs(startedAtMs),
      endedAt: isoFromMs(endedAtMs),
      durationMinutes,
      kind: pending.kind || "study",
      subjectId: pending.subjectId || null,
      fileId: pending.fileId || null,
      assignmentId: pending.assignmentId || null,
      recapText: String(ui.text?.value || "").trim(),
      effectivenessRating: ui.rating?.value ? Number(ui.rating.value) : null,
      tag: ui.tags?.value || "",
      confidenceBefore: pending.confidenceBefore == null ? null : pending.confidenceBefore,
      confidenceAfter: confUpdate.changed ? confUpdate.after : null
    };

    appendSession(entry);
    pending = null;
    closeModal();
    showToastSafe("Recap saved.", "success");
  }

  function skipRecap() {
    pending = null;
    closeModal();
  }

  ui.conf?.addEventListener("input", () => {
    if (ui.confValue) ui.confValue.textContent = `${ui.conf.value}%`;
  });

  ui.closeBtn?.addEventListener("click", skipRecap);
  ui.skipBtn?.addEventListener("click", skipRecap);
  ui.saveBtn?.addEventListener("click", saveRecap);
  ui.backdrop?.addEventListener("mousedown", (event) => {
    if (event.target === ui.backdrop) skipRecap();
  });

  function openRecap(payload) {
    pending = payload && typeof payload === "object" ? payload : null;
    if (!pending) return;
    resetUi();

    const linked = pending.subjectId && pending.fileId;
    setConfidenceUi(pending.confidenceBefore == null ? 50 : pending.confidenceBefore, !!linked);
    if (ui.subtitle) {
      const min = Math.max(1, Math.round((pending.elapsedMs || 0) / 60000));
      ui.subtitle.textContent = linked ? `Study session · ${min} min` : `Session · ${min} min`;
    }
    if (ui.meta) {
      ui.meta.textContent = pending.assignmentId ? "Linked to an assignment." : linked ? "Linked to a file/topic." : "";
    }
    openModal();
  }

  StudyPlanner.SessionJournal = Object.assign(StudyPlanner.SessionJournal || {}, {
    SESSIONS_KEY,
    appendSession,
    openRecap
  });
})();
