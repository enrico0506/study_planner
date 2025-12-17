(() => {
  const DOCS_KEY = "studyDocsRich_v1";
  const ACTIVE_ID_KEY = "studyDocsRichActiveId_v1";
  const ACTIVE_SESSION_KEY = "studyActiveSession_v1";
  const SUBJECTS_KEY = "studySubjects_v1";
  const AUTOSAVE_MS = 300;

  const docListEl = document.getElementById("docList");
  const newDocBtn = document.getElementById("newDocBtn");
  const titleInput = document.getElementById("docTitleInput");
  const editorEl = document.getElementById("docEditor");
  const saveStatusEl = document.getElementById("saveStatus");
  const deleteBtn = document.getElementById("deleteDocBtn");
  const deleteConfirm = document.getElementById("deleteConfirm");
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  const toolbar = document.getElementById("notesToolbar");
  const timerLabelEl = document.getElementById("timerLabel");
  const timerTimeEl = document.getElementById("timerTime");
  const timerMetaEl = document.getElementById("timerMeta");
  const timerWrapper = document.getElementById("timerMirror");

  const linkModal = document.getElementById("linkModal");
  const linkInput = document.getElementById("linkInput");
  const linkModalBackdrop = document.getElementById("linkModalBackdrop");
  const closeLinkModalBtn = document.getElementById("closeLinkModalBtn");
  const cancelLinkBtn = document.getElementById("cancelLinkBtn");
  const insertLinkBtn = document.getElementById("insertLinkBtn");

  if (!docListEl || !editorEl || !toolbar) return;

  let docs = [];
  let activeId = null;
  let saveTimer = null;
  let savedStatusTimer = null;
  let storedRange = null;
  let subjectsCache = [];
  let subjectsDirty = true;

  function safeParse(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function sanitizeHtml(html) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html || "";
    wrapper.querySelectorAll("script").forEach((el) => el.remove());
    wrapper.querySelectorAll("*").forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on")) {
          el.removeAttribute(attr.name);
          return;
        }
        if (name === "href") {
          const val = String(attr.value || "");
          if (/^\s*javascript:/i.test(val)) {
            el.removeAttribute(attr.name);
          }
        }
      });
    });
    return wrapper.innerHTML;
  }

  function formatUpdated(iso) {
    if (!iso) return "Never";
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "Never";
    let diff = Date.now() - t;
    if (diff < 0) diff = 0;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) return "Just now";
    if (diff < hour) return Math.floor(diff / minute) + " min ago";
    if (diff < day) return Math.floor(diff / hour) + " h ago";
    return Math.floor(diff / day) + " d ago";
  }

  function generateId() {
    return "doc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  }

  function createDefaultDoc(title = "Notizen") {
    const now = new Date().toISOString();
    return {
      id: generateId(),
      title,
      html: "<p></p>",
      createdAt: now,
      updatedAt: now
    };
  }

  function loadState() {
    const rawDocs = safeParse(localStorage.getItem(DOCS_KEY));
    docs = Array.isArray(rawDocs) ? rawDocs.filter((d) => d && d.id) : [];
    const savedActive = localStorage.getItem(ACTIVE_ID_KEY);
    activeId = savedActive || null;
    if (!docs.length) {
      const doc = createDefaultDoc();
      docs = [doc];
      activeId = doc.id;
      persistState();
    }
    if (!activeId || !docs.find((d) => d.id === activeId)) {
      const first = getSortedDocs()[0];
      activeId = first ? first.id : null;
      persistActiveId();
    }
  }

  function persistDocs() {
    try {
      localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
    } catch {}
  }

  function persistActiveId() {
    try {
      if (activeId) localStorage.setItem(ACTIVE_ID_KEY, activeId);
      else localStorage.removeItem(ACTIVE_ID_KEY);
    } catch {}
  }

  function persistState() {
    persistDocs();
    persistActiveId();
  }

  function getActiveDoc() {
    return docs.find((d) => d.id === activeId) || null;
  }

  function getSortedDocs() {
    return [...docs].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }

  function renderDocList() {
    docListEl.innerHTML = "";
    const list = getSortedDocs();
    list.forEach((doc) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "notes-doc-item" + (doc.id === activeId ? " notes-doc-item-active" : "");
      btn.dataset.id = doc.id;

      const title = document.createElement("div");
      title.className = "notes-doc-title";
      title.textContent = doc.title || "Untitled";

      const meta = document.createElement("div");
      meta.className = "notes-doc-meta";
      meta.textContent = "Updated " + formatUpdated(doc.updatedAt);

      btn.append(title, meta);
      btn.addEventListener("click", () => {
        if (doc.id === activeId) return;
        flushPendingSave();
        activeId = doc.id;
        persistActiveId();
        loadActiveDoc();
        renderDocList();
      });
      docListEl.appendChild(btn);
    });
  }

  function loadActiveDoc() {
    const doc = getActiveDoc();
    if (!doc) return;
    titleInput.value = doc.title || "Untitled";
    const sanitized = sanitizeHtml(doc.html || "");
    editorEl.innerHTML = sanitized || "<p></p>";
    setSavedStatus("Saved");
    hideDeleteConfirm();
  }

  function setSavedStatus(text, { saving = false } = {}) {
    saveStatusEl.textContent = text;
    saveStatusEl.classList.toggle("saving", !!saving);
    if (savedStatusTimer) clearTimeout(savedStatusTimer);
    if (!saving) {
      savedStatusTimer = setTimeout(() => {
        saveStatusEl.textContent = "Saved";
        saveStatusEl.classList.remove("saving");
      }, 1200);
    }
  }

  function saveActiveDoc() {
    const doc = getActiveDoc();
    if (!doc) return;
    const title = titleInput.value.trim() || "Untitled";
    const cleanHtml = sanitizeHtml(editorEl.innerHTML);
    doc.title = title;
    doc.html = cleanHtml;
    doc.updatedAt = new Date().toISOString();
    persistState();
    renderDocList();
    setSavedStatus("Saved");
  }

  function flushPendingSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveActiveDoc();
  }

  function scheduleSave() {
    setSavedStatus("Saving...", { saving: true });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveActiveDoc();
    }, AUTOSAVE_MS);
  }

  function addDoc() {
    flushPendingSave();
    const count = docs.length + 1;
    const doc = createDefaultDoc("Notiz " + count);
    docs.unshift(doc);
    activeId = doc.id;
    persistState();
    renderDocList();
    loadActiveDoc();
    titleInput.focus();
  }

  function hideDeleteConfirm() {
    deleteConfirm.hidden = true;
  }

  function showDeleteConfirm() {
    deleteConfirm.hidden = false;
  }

  function deleteActiveDoc() {
    if (!activeId) return;
    docs = docs.filter((d) => d.id !== activeId);
    if (!docs.length) {
      const fallback = createDefaultDoc();
      docs = [fallback];
      activeId = fallback.id;
    } else {
      const next = getSortedDocs()[0];
      activeId = next ? next.id : null;
    }
    persistState();
    renderDocList();
    loadActiveDoc();
  }

  function captureSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!editorEl.contains(range.commonAncestorContainer)) return null;
    return range.cloneRange();
  }

  function restoreSelection(range) {
    if (!range) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function openLinkModal() {
    linkModal.classList.add("open");
    linkModal.setAttribute("aria-hidden", "false");
    linkInput.value = "";
    setTimeout(() => linkInput.focus(), 20);
  }

  function closeLinkModal() {
    linkModal.classList.remove("open");
    linkModal.setAttribute("aria-hidden", "true");
  }

  function sanitizeUrl(url) {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (/^\s*javascript:/i.test(trimmed)) return null;
    return trimmed;
  }

  function insertLink() {
    const url = sanitizeUrl(linkInput.value);
    if (!url) {
      linkInput.focus();
      return;
    }
    closeLinkModal();
    restoreSelection(storedRange);
    editorEl.focus();
    document.execCommand("createLink", false, url);
    scheduleSave();
  }

  function clearFormatting() {
    editorEl.focus();
    document.execCommand("removeFormat");
    document.execCommand("unlink");
    scheduleSave();
  }

  function handleToolbarClick(event) {
    const btn = event.target.closest("button");
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    const action = btn.dataset.action;
    if (action === "link") {
      storedRange = captureSelection();
      openLinkModal();
      return;
    }
    if (action === "clear") {
      clearFormatting();
      return;
    }
    if (!cmd) return;
    editorEl.focus();
    const value = btn.dataset.value || null;
    document.execCommand(cmd, false, value);
    scheduleSave();
  }

  function loadSubjects() {
    const raw = safeParse(localStorage.getItem(SUBJECTS_KEY));
    subjectsCache = Array.isArray(raw) ? raw : [];
    subjectsDirty = false;
  }

  function resolveNames(subjectId, fileId) {
    const result = { subject: null, file: null };
    const subj = subjectsCache.find((s) => s.id === subjectId);
    if (subj) result.subject = subj.name || null;
    if (subj && Array.isArray(subj.files)) {
      const file = subj.files.find((f) => f.id === fileId);
      if (file) result.file = file.name || null;
    }
    return result;
  }

  function readActiveSession() {
    const data = safeParse(localStorage.getItem(ACTIVE_SESSION_KEY));
    if (!data || typeof data !== "object") return null;
    if (data.kind !== "study" && data.kind !== "break") return null;
    if (!Number.isFinite(Number(data.baseMs))) return null;
    if (!Number.isFinite(Number(data.targetMs))) return null;
    return {
      kind: data.kind,
      breakKind: data.breakKind || null,
      subjectId: data.subjectId || null,
      fileId: data.fileId || null,
      baseMs: Number(data.baseMs) || 0,
      startTimeMs: Number(data.startTimeMs) || null,
      targetMs: Number(data.targetMs) || 0,
      paused: !!data.paused,
      timerMode: data.timerMode === "stopwatch" ? "stopwatch" : "countdown"
    };
  }

  function computeElapsed(session) {
    if (!session) return 0;
    let elapsed = Number(session.baseMs) || 0;
    if (!session.paused && session.startTimeMs) {
      elapsed += Date.now() - session.startTimeMs;
    }
    if (elapsed < 0) elapsed = 0;
    return elapsed;
  }

  function formatHMS(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  }

  function renderTimer({ forceSubjects } = {}) {
    if (forceSubjects || subjectsDirty) {
      loadSubjects();
    }
    const session = readActiveSession();
    if (!session) {
      timerLabelEl.textContent = "No active session";
      timerTimeEl.textContent = "00:00:00";
      timerMetaEl.textContent = "Start a session on the main page.";
      timerWrapper?.classList.remove("notes-timer-paused");
      return;
    }

    const label =
      session.kind === "break"
        ? session.breakKind === "short"
          ? "Short break"
          : session.breakKind === "long"
          ? "Long break"
          : "Break"
        : "Study session";

    const elapsed = computeElapsed(session);
    const useCountdown = session.targetMs > 0;
    const displayMs = useCountdown ? Math.max(0, session.targetMs - elapsed) : elapsed;

    timerLabelEl.textContent = session.paused ? label + " - Paused" : label;
    timerTimeEl.textContent = formatHMS(displayMs);

    let meta = session.paused ? "Paused" : useCountdown ? "Countdown" : "Stopwatch";
    if (session.kind === "study") {
      const names = resolveNames(session.subjectId, session.fileId);
      const parts = [];
      if (names.subject) parts.push(names.subject);
      if (names.file) parts.push(names.file);
      if (parts.length) {
        meta = parts.join(" - ") + " - " + meta;
      }
    }
    timerMetaEl.textContent = meta;
    if (timerWrapper) {
      timerWrapper.classList.toggle("notes-timer-paused", !!session.paused);
    }
  }

  function handleStorageEvent(event) {
    if (!event) return;
    if (event.key === ACTIVE_SESSION_KEY || event.key === SUBJECTS_KEY) {
      subjectsDirty = subjectsDirty || event.key === SUBJECTS_KEY;
      renderTimer({ forceSubjects: event.key === SUBJECTS_KEY });
    }
    if (event.key === DOCS_KEY || event.key === ACTIVE_ID_KEY) {
      loadState();
      renderDocList();
      loadActiveDoc();
    }
  }

  function bindEvents() {
    newDocBtn?.addEventListener("click", addDoc);
    titleInput?.addEventListener("input", scheduleSave);
    editorEl?.addEventListener("input", scheduleSave);
    deleteBtn?.addEventListener("click", showDeleteConfirm);
    cancelDeleteBtn?.addEventListener("click", hideDeleteConfirm);
    confirmDeleteBtn?.addEventListener("click", deleteActiveDoc);

    toolbar.addEventListener("click", handleToolbarClick);

    linkModalBackdrop?.addEventListener("click", closeLinkModal);
    closeLinkModalBtn?.addEventListener("click", closeLinkModal);
    cancelLinkBtn?.addEventListener("click", closeLinkModal);
    insertLinkBtn?.addEventListener("click", insertLink);
    linkInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        insertLink();
      }
    });

    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener("study:state-replaced", () => {
      subjectsDirty = true;
      loadState();
      renderDocList();
      loadActiveDoc();
      renderTimer({ forceSubjects: true });
    });
  }

  function init() {
    loadState();
    loadSubjects();
    renderDocList();
    loadActiveDoc();
    bindEvents();
    renderTimer({ forceSubjects: true });
    setInterval(renderTimer, 350);
  }

  init();
})();
