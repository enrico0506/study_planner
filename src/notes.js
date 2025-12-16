(() => {
  const existing = window.StudyPlanner && typeof window.StudyPlanner === "object" ? window.StudyPlanner : {};
  const StudyPlanner = (window.StudyPlanner = existing);
  const Storage = StudyPlanner.Storage || null;

  const NOTES_KEY = "studyNotes_v1";

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
      const v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }

  function setJSON(key, value, { debounceMs = 250 } = {}) {
    if (Storage) return Storage.setJSON(key, value, { debounceMs });
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function noteKey(scope, scopeId) {
    return `${String(scope || "").trim()}:${String(scopeId || "").trim()}`;
  }

  function loadNotesMap() {
    const raw = getRaw(NOTES_KEY, "");
    if (!raw) return {};
    const parsed = safeJsonParse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  }

  function saveNotesMap(map, { debounceMs = 250 } = {}) {
    setJSON(NOTES_KEY, map && typeof map === "object" ? map : {}, { debounceMs });
  }

  function getNote(scope, scopeId) {
    const key = noteKey(scope, scopeId);
    const map = loadNotesMap();
    return map[key] || null;
  }

  function setNote(scope, scopeId, contentMd) {
    const key = noteKey(scope, scopeId);
    const map = loadNotesMap();
    map[key] = {
      scope: String(scope || ""),
      scopeId: String(scopeId || ""),
      contentMd: String(contentMd || ""),
      updatedAt: nowIso()
    };
    saveNotesMap(map);
    return map[key];
  }

  function isSafeHref(href) {
    const raw = String(href || "").trim();
    if (!raw) return false;
    if (raw.startsWith("#")) return true;
    if (raw.startsWith("sp://")) return true;
    try {
      const url = new URL(raw, window.location.href);
      return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:";
    } catch {
      return false;
    }
  }

  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = String(text);
    return el;
  }

  function appendInlines(parent, text) {
    const s = String(text || "");
    let i = 0;
    const pushText = (t) => {
      if (!t) return;
      parent.appendChild(document.createTextNode(t));
    };

    while (i < s.length) {
      const rest = s.slice(i);

      const codeMatch = rest.match(/^`([^`]+)`/);
      if (codeMatch) {
        const code = createEl("code", "", codeMatch[1]);
        parent.appendChild(code);
        i += codeMatch[0].length;
        continue;
      }

      const boldMatch = rest.match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        const strong = createEl("strong", "", boldMatch[1]);
        parent.appendChild(strong);
        i += boldMatch[0].length;
        continue;
      }

      const italicMatch = rest.match(/^\*([^*]+)\*/);
      if (italicMatch) {
        const em = createEl("em", "", italicMatch[1]);
        parent.appendChild(em);
        i += italicMatch[0].length;
        continue;
      }

      const linkMatch = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        const label = linkMatch[1];
        const href = linkMatch[2];
        if (isSafeHref(href)) {
          const a = createEl("a", "", label);
          a.href = href;
          a.rel = "noreferrer noopener";
          if (!href.startsWith("sp://") && !href.startsWith("#")) a.target = "_blank";
          parent.appendChild(a);
        } else {
          pushText(linkMatch[0]);
        }
        i += linkMatch[0].length;
        continue;
      }

      // Plain text: consume up to next special token start.
      const nextIdx = (() => {
        const specials = ["`", "*", "["];
        let best = -1;
        for (const ch of specials) {
          const idx = rest.indexOf(ch);
          if (idx === -1) continue;
          best = best === -1 ? idx : Math.min(best, idx);
        }
        return best;
      })();
      if (nextIdx === -1) {
        pushText(rest);
        break;
      }
      if (nextIdx > 0) {
        pushText(rest.slice(0, nextIdx));
        i += nextIdx;
      } else {
        pushText(rest[0]);
        i += 1;
      }
    }
  }

  function renderMarkdownTo(container, markdown) {
    container.replaceChildren();
    const lines = String(markdown || "").split(/\r?\n/);
    let i = 0;
    let inCode = false;
    let codeLines = [];
    let listEl = null;

    const flushList = () => {
      if (listEl) container.appendChild(listEl);
      listEl = null;
    };

    while (i < lines.length) {
      const line = lines[i];

      if (line.trim().startsWith("```")) {
        if (!inCode) {
          flushList();
          inCode = true;
          codeLines = [];
        } else {
          inCode = false;
          const pre = createEl("pre");
          const code = createEl("code");
          code.textContent = codeLines.join("\n");
          pre.appendChild(code);
          container.appendChild(pre);
          codeLines = [];
        }
        i += 1;
        continue;
      }

      if (inCode) {
        codeLines.push(line);
        i += 1;
        continue;
      }

      if (!line.trim()) {
        flushList();
        i += 1;
        continue;
      }

      const heading = line.match(/^(#{1,3})\s+(.*)$/);
      if (heading) {
        flushList();
        const level = heading[1].length;
        const h = createEl(`h${level}`);
        appendInlines(h, heading[2]);
        container.appendChild(h);
        i += 1;
        continue;
      }

      const quote = line.match(/^>\s?(.*)$/);
      if (quote) {
        flushList();
        const block = createEl("blockquote");
        const p = createEl("p");
        appendInlines(p, quote[1]);
        block.appendChild(p);
        container.appendChild(block);
        i += 1;
        continue;
      }

      const ul = line.match(/^[-*]\s+(.*)$/);
      const ol = line.match(/^(\d+)\.\s+(.*)$/);
      if (ul || ol) {
        const isOrdered = !!ol;
        const text = isOrdered ? ol[2] : ul[1];
        if (!listEl || listEl.tagName !== (isOrdered ? "OL" : "UL")) {
          flushList();
          listEl = createEl(isOrdered ? "ol" : "ul");
        }
        const li = createEl("li");
        appendInlines(li, text);
        listEl.appendChild(li);
        i += 1;
        continue;
      }

      flushList();
      const p = createEl("p");
      appendInlines(p, line);
      container.appendChild(p);
      i += 1;
    }
    flushList();
  }

  function applyKatex(el) {
    if (!el || !window.renderMathInElement) return;
    const delimiters = [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false },
      { left: "\\[", right: "\\]", display: true }
    ];
    try {
      window.renderMathInElement(el, { delimiters, throwOnError: false });
    } catch {}
  }

  function parseSpLink(href) {
    const raw = String(href || "");
    if (!raw.startsWith("sp://")) return null;
    const path = raw.slice("sp://".length);
    const parts = path.split("/").filter(Boolean);
    const kind = parts[0] || "";
    if (kind === "subject" && parts[1]) return { kind: "subject", subjectId: parts[1] };
    if (kind === "file" && parts[1] && parts[2]) return { kind: "file", subjectId: parts[1], fileId: parts[2] };
    if (kind === "assignment" && parts[1]) return { kind: "assignment", assignmentId: parts[1] };
    return null;
  }

  const ui = {
    modal: null,
    backdrop: null,
    title: null,
    subtitle: null,
    closeBtn: null,
    saveHint: null,
    editor: null,
    preview: null,
    search: null,
    searchBtn: null,
    insertSelect: null,
    insertBtn: null
  };

  const openState = {
    scope: null,
    scopeId: null,
    label: "",
    lastSavedAt: null,
    saveTimer: null,
    searchCursor: 0
  };

  function bindUi() {
    ui.modal = document.getElementById("notesModal");
    ui.backdrop = document.getElementById("notesModalBackdrop");
    ui.title = document.getElementById("notesModalTitle");
    ui.subtitle = document.getElementById("notesModalSubtitle");
    ui.closeBtn = document.getElementById("closeNotesModalBtn");
    ui.saveHint = document.getElementById("notesSaveHint");
    ui.editor = document.getElementById("notesEditor");
    ui.preview = document.getElementById("notesPreview");
    ui.search = document.getElementById("notesSearchInput");
    ui.searchBtn = document.getElementById("notesSearchBtn");
    ui.insertSelect = document.getElementById("notesInsertSelect");
    ui.insertBtn = document.getElementById("notesInsertBtn");

    if (!ui.modal || !ui.editor || !ui.preview) return false;

    const close = () => closeModal();
    ui.closeBtn?.addEventListener("click", close);
    ui.backdrop?.addEventListener("click", (e) => {
      if (e.target === ui.backdrop) close();
    });

    ui.preview.addEventListener("click", (event) => {
      const link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (!link) return;
      const info = parseSpLink(link.getAttribute("href"));
      if (!info) return;
      event.preventDefault();
      try {
        window.dispatchEvent(new CustomEvent("study:open-entity", { detail: info }));
      } catch {}
    });

    ui.editor.addEventListener("input", () => {
      renderMarkdownTo(ui.preview, ui.editor.value);
      applyKatex(ui.preview);
      scheduleSave();
      setSaveHint("Editing…");
    });

    ui.editor.addEventListener("keydown", (event) => {
      const isSave = (event.ctrlKey || event.metaKey) && (event.key === "s" || event.key === "S");
      if (!isSave) return;
      event.preventDefault();
      flushSave(true);
    });

    ui.searchBtn?.addEventListener("click", () => runSearch());
    ui.search?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runSearch();
      }
    });

    ui.insertBtn?.addEventListener("click", () => insertSelectedLink());

    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!ui.modal || !ui.modal.classList.contains("is-open")) return;
      event.preventDefault();
      closeModal();
    });

    return true;
  }

  function openModal() {
    if (!ui.modal) return;
    ui.modal.classList.add("is-open");
    ui.modal.setAttribute("aria-hidden", "false");
    ui.editor.focus();
  }

  function closeModal() {
    if (!ui.modal || !ui.modal.classList.contains("is-open")) return;
    flushSave(true);
    ui.modal.classList.remove("is-open");
    ui.modal.setAttribute("aria-hidden", "true");
  }

  function setSaveHint(text) {
    if (!ui.saveHint) return;
    ui.saveHint.textContent = String(text || "");
  }

  function scheduleSave() {
    if (openState.saveTimer) clearTimeout(openState.saveTimer);
    openState.saveTimer = setTimeout(() => flushSave(false), 450);
  }

  function flushSave(forceImmediate) {
    if (!openState.scope || !openState.scopeId) return;
    if (openState.saveTimer) {
      clearTimeout(openState.saveTimer);
      openState.saveTimer = null;
    }
    const content = ui.editor ? ui.editor.value : "";
    if (openState.scope === "assignment" && StudyPlanner.Assignments) {
      const a = StudyPlanner.Assignments.getById(openState.scopeId);
      if (a) StudyPlanner.Assignments.upsert({ ...a, notesMd: content });
    } else {
      setNote(openState.scope, openState.scopeId, content);
    }
    openState.lastSavedAt = Date.now();
    const label = new Date(openState.lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setSaveHint(forceImmediate ? `Saved · ${label}` : `Saved · ${label}`);
  }

  function runSearch() {
    if (!ui.search || !ui.editor) return;
    const q = String(ui.search.value || "");
    if (!q) return;
    const text = ui.editor.value || "";
    let start = openState.searchCursor || 0;
    if (start >= text.length) start = 0;
    const idx = text.toLowerCase().indexOf(q.toLowerCase(), start);
    const hit = idx >= 0 ? idx : text.toLowerCase().indexOf(q.toLowerCase(), 0);
    if (hit < 0) {
      setSaveHint("No matches.");
      return;
    }
    ui.editor.focus();
    ui.editor.setSelectionRange(hit, hit + q.length);
    openState.searchCursor = hit + q.length;
    setSaveHint("Match selected.");
  }

  function loadSubjectsForInsert() {
    try {
      const raw = localStorage.getItem("studySubjects_v1");
      if (!raw) return [];
      const parsed = safeJsonParse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function buildInsertOptions() {
    if (!ui.insertSelect) return;
    ui.insertSelect.replaceChildren();

    const addOpt = (label, href, disabled = false) => {
      const opt = document.createElement("option");
      opt.value = href || "";
      opt.textContent = label;
      if (disabled) opt.disabled = true;
      ui.insertSelect.appendChild(opt);
    };

    addOpt("Insert link…", "", true);

    const subjects = loadSubjectsForInsert();
    if (subjects.length) {
      addOpt("— Subjects —", "", true);
      subjects.forEach((s) => addOpt(s.name || "Subject", `sp://subject/${s.id}`));
      addOpt("— Files —", "", true);
      subjects.forEach((s) => {
        (Array.isArray(s.files) ? s.files : []).forEach((f) => {
          addOpt(`${s.name || "Subject"} · ${f.name || "File"}`, `sp://file/${s.id}/${f.id}`);
        });
      });
    }

    if (StudyPlanner.Assignments) {
      const list = StudyPlanner.Assignments.loadAll();
      if (list.length) {
        addOpt("— Assignments —", "", true);
        list.slice(0, 40).forEach((a) => addOpt(a.title, `sp://assignment/${a.id}`));
      }
    }

    ui.insertSelect.selectedIndex = 0;
  }

  function insertSelectedLink() {
    if (!ui.insertSelect || !ui.editor) return;
    const href = ui.insertSelect.value;
    if (!href) return;
    const label = ui.insertSelect.options[ui.insertSelect.selectedIndex]?.textContent || "Link";
    const markdown = `[${label}](${href})`;
    const start = ui.editor.selectionStart || 0;
    const end = ui.editor.selectionEnd || start;
    const value = ui.editor.value || "";
    ui.editor.value = value.slice(0, start) + markdown + value.slice(end);
    const nextCursor = start + markdown.length;
    ui.editor.focus();
    ui.editor.setSelectionRange(nextCursor, nextCursor);
    renderMarkdownTo(ui.preview, ui.editor.value);
    applyKatex(ui.preview);
    scheduleSave();
  }

  function open({ scope, scopeId, label }) {
    if (!ui.modal && !bindUi()) return;
    openState.scope = String(scope || "");
    openState.scopeId = String(scopeId || "");
    openState.label = String(label || "");
    openState.searchCursor = 0;
    buildInsertOptions();

    const titleText = openState.label || "Notes";
    if (ui.title) ui.title.textContent = titleText;
    if (ui.subtitle) {
      ui.subtitle.textContent =
        "Markdown + KaTeX. Autosave enabled. Ctrl/Cmd+S saves immediately.";
    }

    let content = "";
    if (openState.scope === "assignment" && StudyPlanner.Assignments) {
      const a = StudyPlanner.Assignments.getById(openState.scopeId);
      content = a ? a.notesMd || "" : "";
    } else {
      const note = getNote(openState.scope, openState.scopeId);
      content = note ? note.contentMd || "" : "";
    }
    ui.editor.value = content;
    renderMarkdownTo(ui.preview, content);
    applyKatex(ui.preview);
    setSaveHint("Ready.");
    openModal();
  }

  StudyPlanner.Notes = Object.assign(StudyPlanner.Notes || {}, {
    NOTES_KEY,
    loadNotesMap,
    saveNotesMap,
    getNote,
    setNote,
    renderMarkdownTo,
    open
  });
})();

