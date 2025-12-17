(() => {
  const DOCS_KEY = "studyDocsRich_v1";
  const ACTIVE_ID_KEY = "studyDocsRichActiveId_v1";
  const ACTIVE_SESSION_KEY = "studyActiveSession_v1";
  const SUBJECTS_KEY = "studySubjects_v1";
  const FOLDERS_KEY = "studyDocsRichFolders_v1";
  const CONFIG_KEY = "studyFocusConfig_v1";
  const AUTOSAVE_MS = 300;
  const FOLDER_ALL = "__all__";
  const JSZIP_SRC = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";

  const docListEl = document.getElementById("docList");
  const folderListEl = document.getElementById("folderList");
  const newFolderToggleBtn = document.getElementById("newFolderToggleBtn");
  const newFolderForm = document.getElementById("newFolderForm");
  const newFolderInput = document.getElementById("newFolderInput");
  const saveFolderBtn = document.getElementById("saveFolderBtn");
  const cancelFolderBtn = document.getElementById("cancelFolderBtn");
  const folderSubjectSelect = document.getElementById("folderSubjectSelect");
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
  const docFolderSelect = document.getElementById("docFolderSelect");
  const docSubjectSelect = document.getElementById("docSubjectSelect");
  const docFileSelect = document.getElementById("docFileSelect");
  const startStudyBtn = document.getElementById("startStudyBtn");
  const pauseStudyBtn = document.getElementById("pauseStudyBtn");
  const statusEl = document.getElementById("notesStatus");
  const importInput = document.getElementById("importInput");

  const linkModal = document.getElementById("linkModal");
  const linkInput = document.getElementById("linkInput");
  const linkModalBackdrop = document.getElementById("linkModalBackdrop");
  const closeLinkModalBtn = document.getElementById("closeLinkModalBtn");
  const cancelLinkBtn = document.getElementById("cancelLinkBtn");
  const insertLinkBtn = document.getElementById("insertLinkBtn");

  if (!docListEl || !editorEl || !toolbar) return;

  let docs = [];
  let folders = [];
  let selectedFolderId = FOLDER_ALL;
  let activeId = null;
  let editingFolderId = null;
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
      updatedAt: now,
      folderId: null,
      subjectId: null,
      fileId: null
    };
  }

  function loadFolders() {
    const raw = safeParse(localStorage.getItem(FOLDERS_KEY));
    folders = Array.isArray(raw)
      ? raw
          .filter((f) => f && f.id && f.name)
          .map((f) => ({ ...f, subjectId: f.subjectId || null }))
      : [];
  }

  function persistFolders() {
    try {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    } catch {}
  }

  function loadState() {
    const rawDocs = safeParse(localStorage.getItem(DOCS_KEY));
    docs = Array.isArray(rawDocs)
      ? rawDocs
          .filter((d) => d && d.id)
          .map((d) => ({
            ...d,
            folderId: d.folderId || null,
            subjectId: d.subjectId || null,
            fileId: d.fileId || null
          }))
      : [];
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
    loadFolders();
    if (selectedFolderId !== FOLDER_ALL && !folders.find((f) => f.id === selectedFolderId)) {
      selectedFolderId = FOLDER_ALL;
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

  function filteredDocs() {
    if (selectedFolderId === FOLDER_ALL) return getSortedDocs();
    return getSortedDocs().filter((d) => (d.folderId || null) === selectedFolderId);
  }

  function folderName(folderId) {
    if (!folderId) return null;
    const f = folders.find((x) => x.id === folderId);
    return f ? f.name : null;
  }

  function setStatus(text, kind = "info") {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.className = "notes-status";
    if (kind === "error") statusEl.classList.add("notes-status-error");
    if (kind === "success") statusEl.classList.add("notes-status-success");
  }

  function renderFolderSubjectSelect() {
    if (!folderSubjectSelect) return;
    folderSubjectSelect.innerHTML = "";
    const optNone = document.createElement("option");
    optNone.value = "";
    optNone.textContent = "Kein Fach";
    folderSubjectSelect.appendChild(optNone);
    subjectsCache.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name || "Unbenannt";
      folderSubjectSelect.appendChild(opt);
    });
  }

  function resetFolderForm() {
    editingFolderId = null;
    if (newFolderInput) newFolderInput.value = "";
    if (folderSubjectSelect) folderSubjectSelect.value = "";
    const hint = document.getElementById("folderFormHint");
    if (hint) hint.textContent = "Optional ein Fach verknüpfen.";
  }

  function startEditFolder(folder) {
    if (!folder) return;
    editingFolderId = folder.id;
    if (newFolderForm) newFolderForm.hidden = false;
    renderFolderSubjectSelect();
    if (newFolderInput) newFolderInput.value = folder.name || "";
    if (folderSubjectSelect) folderSubjectSelect.value = folder.subjectId || "";
    const hint = document.getElementById("folderFormHint");
    if (hint) hint.textContent = "Ordner bearbeiten";
    newFolderInput?.focus();
  }

  function seedDocsForFolder(folder) {
    if (!folder || !folder.subjectId) return;
    const subj = subjectsCache.find((s) => s.id === folder.subjectId);
    if (!subj || !Array.isArray(subj.files)) return;
    const existingIds = new Set(
      docs.filter((d) => d.folderId === folder.id && d.subjectId === folder.subjectId).map((d) => d.fileId)
    );
    const newDocs = [];
    subj.files.forEach((file) => {
      if (existingIds.has(file.id)) return;
      const doc = createDefaultDoc(file.name || "Task");
      doc.folderId = folder.id;
      doc.subjectId = folder.subjectId;
      doc.fileId = file.id;
      doc.title = file.name || doc.title;
      newDocs.push(doc);
    });
    if (newDocs.length) {
      docs = [...newDocs, ...docs];
      persistDocs();
    }
  }

  function markdownToHtml(md) {
    const lines = String(md || "").split(/\r?\n/);
    let html = "";
    lines.forEach((line) => {
      if (/^#{1,6}\s+/.test(line)) {
        const level = Math.min(6, line.match(/^#+/)[0].length);
        const text = line.replace(/^#{1,6}\s+/, "");
        html += `<h${level}>${escapeHtml(text)}</h${level}>`;
      } else if (/^\s*[-*+]\s+/.test(line)) {
        html += `<ul><li>${escapeHtml(line.replace(/^\s*[-*+]\s+/, ""))}</li></ul>`;
      } else if (/^\s*\d+\.\s+/.test(line)) {
        html += `<ol><li>${escapeHtml(line.replace(/^\s*\d+\.\s+/, ""))}</li></ol>`;
      } else if (line.trim() === "") {
        html += "<p></p>";
      } else {
        html += `<p>${escapeHtml(line)}</p>`;
      }
    });
    return html;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function ipynbToHtml(json) {
    const cells = Array.isArray(json?.cells) ? json.cells : [];
    const parts = [];
    cells.forEach((cell) => {
      if (cell.cell_type === "markdown") {
        const text = Array.isArray(cell.source) ? cell.source.join("") : "";
        parts.push(markdownToHtml(text));
      } else if (cell.cell_type === "code") {
        const code = Array.isArray(cell.source) ? cell.source.join("") : "";
        parts.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
      }
    });
    return parts.join("\n");
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = JSZIP_SRC;
      script.onload = () => resolve(window.JSZip || null);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
  }

  async function parseDocxToHtml(file) {
    const JSZipLib = await loadJSZip();
    if (!JSZipLib) {
      setStatus("Docx Import fehlgeschlagen (JSZip nicht verfügbar).", "error");
      return null;
    }
    try {
      const buf = await readFileAsArrayBuffer(file);
      const zip = await JSZipLib.loadAsync(buf);
      const docXml = await zip.file("word/document.xml").async("string");
      const parser = new DOMParser();
      const xml = parser.parseFromString(docXml, "application/xml");
      const paragraphs = Array.from(xml.getElementsByTagName("w:p"));
      const out = paragraphs
        .map((p) => {
          const texts = Array.from(p.getElementsByTagName("w:t")).map((t) => t.textContent || "");
          const text = texts.join("");
          return `<p>${escapeHtml(text)}</p>`;
        })
        .join("\n");
      return out || "<p></p>";
    } catch (err) {
      setStatus("Docx konnte nicht gelesen werden.", "error");
      return null;
    }
  }

  async function handleImport(file) {
    if (!file) return;
    const name = (file.name || "").toLowerCase();
    const ext = name.split(".").pop() || "";
    try {
      if (ext === "md" || ext === "markdown") {
        const text = await readFileAsText(file);
        const html = markdownToHtml(text);
        editorEl.innerHTML = sanitizeHtml(html);
        scheduleSave();
        setStatus("Markdown importiert.", "success");
        return;
      }
      if (ext === "ipynb") {
        const text = await readFileAsText(file);
        const parsed = safeParse(text);
        const html = ipynbToHtml(parsed || {});
        editorEl.innerHTML = sanitizeHtml(html || "<p></p>");
        scheduleSave();
        setStatus("Notebook importiert.", "success");
        return;
      }
      if (ext === "pdf") {
        const dataUrl = await readFileAsDataUrl(file);
        const html = `<object class="notes-embed" data="${dataUrl}" type="application/pdf"></object>`;
        editorEl.innerHTML = html;
        scheduleSave();
        setStatus("PDF eingebettet (nur Ansicht).", "success");
        return;
      }
      if (ext === "docx") {
        const html = await parseDocxToHtml(file);
        if (html) {
          editorEl.innerHTML = sanitizeHtml(html);
          scheduleSave();
          setStatus("Docx importiert.", "success");
        }
        return;
      }
      setStatus("Dateityp nicht unterstützt.", "error");
    } catch (err) {
      setStatus("Import fehlgeschlagen.", "error");
    }
  }

  function renderDocList() {
    docListEl.innerHTML = "";
    const list = filteredDocs();
    list.forEach((doc) => {
      const row = document.createElement("div");
      row.className = "notes-doc-item" + (doc.id === activeId ? " notes-doc-item-active" : "");
      row.dataset.id = doc.id;

      const textWrap = document.createElement("div");
      textWrap.style.flex = "1";
      const title = document.createElement("div");
      title.className = "notes-doc-title";
      title.textContent = doc.title || "Untitled";
      const meta = document.createElement("div");
      meta.className = "notes-doc-meta";
      const subjName = doc.subjectId ? resolveNames(doc.subjectId, doc.fileId).subject : null;
      const parts = ["Updated " + formatUpdated(doc.updatedAt)];
      if (subjName) parts.push(subjName);
      const fName = folderName(doc.folderId);
      if (fName) parts.push(fName);
      meta.textContent = parts.join(" - ");
      textWrap.append(title, meta);

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "notes-folder-delete";
      editBtn.textContent = "Edit";
      editBtn.title = "Umbenennen";
      editBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        selectDoc(doc);
        titleInput?.focus();
        setStatus("Titel hier bearbeiten und speichern lassen.", "info");
      });

      const linkBtn = document.createElement("button");
      linkBtn.type = "button";
      linkBtn.className = "notes-folder-delete";
      linkBtn.textContent = "Link";
      linkBtn.title = "Dieses Dokument mit Fach/Datei verknüpfen";
      linkBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        selectDoc(doc);
        docSubjectSelect?.focus();
        setStatus("Dokument ausgewählt. Wähle Fach/Datei zum Verknüpfen.", "info");
      });

      row.append(textWrap, editBtn, linkBtn);
      row.addEventListener("click", () => {
        selectDoc(doc);
      });
      docListEl.appendChild(row);
    });
  }

  function renderFolders() {
    if (!folderListEl) return;
    folderListEl.innerHTML = "";

    const allItem = document.createElement("div");
    allItem.className =
      "notes-folder-item" + (selectedFolderId === FOLDER_ALL ? " notes-folder-item-active" : "");
    const allLeft = document.createElement("div");
    allLeft.className = "notes-folder-name";
    allLeft.textContent = "Alle Dokumente";
    const allCount = document.createElement("div");
    allCount.className = "notes-folder-count";
    allCount.textContent = docs.length.toString();
    allItem.append(allLeft, allCount);
    allItem.addEventListener("click", () => {
      selectedFolderId = FOLDER_ALL;
      const list = filteredDocs();
      if (list.length && (!activeId || !list.find((d) => d.id === activeId))) {
        activeId = list[0].id;
        persistActiveId();
        loadActiveDoc();
      }
      renderFolders();
      renderDocList();
    });
    folderListEl.appendChild(allItem);

    folders.forEach((folder) => {
      const count = docs.filter((d) => (d.folderId || null) === folder.id).length;
      const row = document.createElement("div");
      row.className =
        "notes-folder-item" + (selectedFolderId === folder.id ? " notes-folder-item-active" : "");
      const nameEl = document.createElement("div");
      nameEl.className = "notes-folder-name";
      nameEl.textContent = folder.name;
      const subj = resolveNames(folder.subjectId, null).subject;
      const metaEl = document.createElement("div");
      metaEl.className = "notes-folder-count";
      metaEl.textContent = subj ? `${count} · ${subj}` : String(count);
      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";
      const editBtn = document.createElement("button");
      editBtn.className = "notes-folder-delete";
      editBtn.type = "button";
      editBtn.textContent = "✎";
      editBtn.title = "Bearbeiten";
      editBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        startEditFolder(folder);
      });
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "notes-folder-delete";
      deleteBtn.type = "button";
      deleteBtn.textContent = "x";
      deleteBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        folders = folders.filter((f) => f.id !== folder.id);
        docs = docs.map((d) => (d.folderId === folder.id ? { ...d, folderId: null } : d));
        if (selectedFolderId === folder.id) selectedFolderId = FOLDER_ALL;
        persistFolders();
        persistDocs();
        renderFolders();
        renderDocList();
        const doc = getActiveDoc();
        if (doc) renderFolderSelect(doc);
      });
      actions.append(editBtn, deleteBtn);
      row.append(nameEl, metaEl, actions);
      row.addEventListener("click", () => {
        selectedFolderId = folder.id;
        const list = filteredDocs();
        if (list.length && (!activeId || !list.find((d) => d.id === activeId))) {
          activeId = list[0].id;
          persistActiveId();
          loadActiveDoc();
        }
        renderFolders();
        renderDocList();
      });
      folderListEl.appendChild(row);
    });
  }

  function renderFolderSelect(doc) {
    if (!docFolderSelect) return;
    docFolderSelect.innerHTML = "";
    const optNone = document.createElement("option");
    optNone.value = "";
    optNone.textContent = "Kein Ordner";
    docFolderSelect.appendChild(optNone);
    folders.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      const subj = resolveNames(f.subjectId, null).subject;
      opt.textContent = subj ? `${f.name} (${subj})` : f.name;
      docFolderSelect.appendChild(opt);
    });
    docFolderSelect.value = doc.folderId || "";
  }

  function renderSubjectSelect(doc) {
    if (!docSubjectSelect) return;
    docSubjectSelect.innerHTML = "";
    const optNone = document.createElement("option");
    optNone.value = "";
    optNone.textContent = "Kein Fach";
    docSubjectSelect.appendChild(optNone);
    subjectsCache.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name || "Unbenannt";
      docSubjectSelect.appendChild(opt);
    });
    docSubjectSelect.value = doc.subjectId || "";
  }

  function renderFileSelect(doc) {
    if (!docFileSelect) return;
    docFileSelect.innerHTML = "";
    const optNone = document.createElement("option");
    optNone.value = "";
    optNone.textContent = "Keine Datei";
    docFileSelect.appendChild(optNone);

    if (!doc.subjectId) {
      docFileSelect.disabled = true;
      return;
    }
    docFileSelect.disabled = false;
    const subj = subjectsCache.find((s) => s.id === doc.subjectId);
    const files = subj && Array.isArray(subj.files) ? subj.files : [];
    const createOpt = document.createElement("option");
    createOpt.value = "__create__";
    createOpt.textContent = "Neue Datei aus Titel";
    docFileSelect.appendChild(createOpt);
    files.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.name || "Unbenannt";
      docFileSelect.appendChild(opt);
    });
    docFileSelect.value = doc.fileId || "";
  }

  function loadActiveDoc() {
    const doc = getActiveDoc();
    if (!doc) return;
    titleInput.value = doc.title || "Untitled";
    const sanitized = sanitizeHtml(doc.html || "");
    editorEl.innerHTML = sanitized || "<p></p>";
    setSavedStatus("Saved");
    hideDeleteConfirm();
    renderFolderSelect(doc);
    renderSubjectSelect(doc);
    renderFileSelect(doc);
    renderFolderSubjectSelect();
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
    const folder = folders.find((f) => f.id === doc.folderId);
    if (folder && folder.subjectId && !doc.subjectId) {
      doc.subjectId = folder.subjectId;
      renderSubjectSelect(doc);
      renderFileSelect(doc);
    }
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
    doc.folderId = selectedFolderId === FOLDER_ALL ? null : selectedFolderId;
    const folder = folders.find((f) => f.id === doc.folderId);
    if (folder && folder.subjectId) {
      doc.subjectId = folder.subjectId;
    }
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
      const filteredNext = filteredDocs()[0];
      const next = filteredNext || getSortedDocs()[0];
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
    renderFolderSubjectSelect();
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

  function getFocusConfig() {
    const fallback = { pomoConfig: { study: 25, short: 5, long: 15 } };
    const raw = safeParse(localStorage.getItem(CONFIG_KEY));
    if (!raw || typeof raw !== "object") return fallback;
    const base = { ...fallback, ...raw };
    if (!base.pomoConfig) base.pomoConfig = fallback.pomoConfig;
    return base;
  }

  function createFileForSubject(subjectId, name) {
    const subj = subjectsCache.find((s) => s.id === subjectId);
    if (!subj) return null;
    const files = Array.isArray(subj.files) ? subj.files : (subj.files = []);
    const fileId = "file_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    const newFile = {
      id: fileId,
      name: name || "Note",
      notes: "",
      confidence: 50,
      lastReviewed: null,
      totalMs: 0,
      sessions: 0,
      lastSessionMs: 0
    };
    files.push(newFile);
    if (Array.isArray(subj.manualOrder)) {
      subj.manualOrder.push(fileId);
    } else {
      subj.manualOrder = files.map((f) => f.id);
    }
    try {
      localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjectsCache));
    } catch {}
    return fileId;
  }

  function startStudyForDoc() {
    if (subjectsDirty) loadSubjects();
    const doc = getActiveDoc();
    if (!doc) return;
    if (!subjectsCache.length) {
      setStatus("Lege zuerst ein Fach auf der Hauptseite an.", "error");
      return;
    }
    if (!doc.subjectId) {
      setStatus("Bitte wähle ein Fach für dieses Dokument.", "error");
      return;
    }
    let fileId = doc.fileId || "";
    if (!fileId || fileId === "__create__") {
      fileId = createFileForSubject(doc.subjectId, doc.title || "Note");
      if (!fileId) {
        setStatus("Datei konnte nicht angelegt werden.", "error");
        return;
      }
      doc.fileId = fileId;
      doc.updatedAt = new Date().toISOString();
      persistDocs();
      renderDocList();
      renderFileSelect(doc);
    }

    const { pomoConfig } = getFocusConfig();
    const minutes = pomoConfig && typeof pomoConfig.study === "number" ? pomoConfig.study : 25;
    const targetMs = Math.max(1, minutes) * 60 * 1000;
    const now = Date.now();
    const session = {
      kind: "study",
      subjectId: doc.subjectId,
      fileId,
      startTimeMs: now,
      baseMs: 0,
      targetMs,
      paused: false,
      timerMode: "countdown",
      pausedReason: null,
      autoResume: false,
      pausedAtMs: null
    };
    doc.updatedAt = new Date().toISOString();
    persistDocs();
    renderDocList();
    try {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    } catch {}
    setStatus("Study-Session gestartet. Timer gespiegelt.", "success");
    renderTimer({ forceSubjects: true });
    updateStudyButtons();
  }

  function togglePauseSession() {
    const session = readActiveSession();
    if (!session) {
      setStatus("Keine aktive Session zum Pausieren.", "error");
      updateStudyButtons(null);
      return;
    }
    if (session.paused) {
      session.paused = false;
      session.startTimeMs = Date.now();
      session.pausedReason = null;
      session.autoResume = false;
      session.pausedAtMs = null;
      try {
        localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
      } catch {}
      setStatus("Session fortgesetzt.", "success");
      updateStudyButtons(session);
      return;
    }
    const now = Date.now();
    const delta = session.startTimeMs ? now - session.startTimeMs : 0;
    if (Number.isFinite(delta) && delta > 0) {
      session.baseMs = (Number(session.baseMs) || 0) + delta;
    }
    session.startTimeMs = null;
    session.paused = true;
    session.pausedReason = "manual";
    session.autoResume = false;
    session.pausedAtMs = now;
    try {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    } catch {}
    setStatus("Session pausiert.", "success");
    updateStudyButtons(session);
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
    updateStudyButtons(session);
  }

  function updateStudyButtons(sessionOverride = null) {
    const session = sessionOverride || readActiveSession();
    if (!pauseStudyBtn) return;
    if (!session) {
      pauseStudyBtn.disabled = true;
      pauseStudyBtn.textContent = "Pause";
      return;
    }
    pauseStudyBtn.disabled = false;
    pauseStudyBtn.textContent = session.paused ? "Resume" : "Pause";
  }

  function handleStorageEvent(event) {
    if (!event) return;
    if (event.key === ACTIVE_SESSION_KEY || event.key === SUBJECTS_KEY) {
      subjectsDirty = subjectsDirty || event.key === SUBJECTS_KEY;
      if (event.key === SUBJECTS_KEY) {
        loadSubjects();
        const doc = getActiveDoc();
        if (doc) {
          renderSubjectSelect(doc);
          renderFileSelect(doc);
        }
        renderDocList();
      }
      renderTimer({ forceSubjects: event.key === SUBJECTS_KEY });
    }
    if (event.key === DOCS_KEY || event.key === ACTIVE_ID_KEY) {
      loadState();
      renderDocList();
      loadActiveDoc();
      renderFolders();
      updateStudyButtons();
    }
    if (event.key === FOLDERS_KEY) {
      loadFolders();
      if (selectedFolderId !== FOLDER_ALL && !folders.find((f) => f.id === selectedFolderId)) {
        selectedFolderId = FOLDER_ALL;
      }
      renderFolders();
      const doc = getActiveDoc();
      if (doc) renderFolderSelect(doc);
      renderDocList();
      updateStudyButtons();
    }
  }

  function bindEvents() {
    newDocBtn?.addEventListener("click", addDoc);
    titleInput?.addEventListener("input", scheduleSave);
    editorEl?.addEventListener("input", scheduleSave);
    deleteBtn?.addEventListener("click", showDeleteConfirm);
    cancelDeleteBtn?.addEventListener("click", hideDeleteConfirm);
    confirmDeleteBtn?.addEventListener("click", deleteActiveDoc);
    startStudyBtn?.addEventListener("click", startStudyForDoc);
    pauseStudyBtn?.addEventListener("click", togglePauseSession);

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

    docFolderSelect?.addEventListener("change", () => {
      const doc = getActiveDoc();
      if (!doc) return;
      const folderId = docFolderSelect.value || null;
      doc.folderId = folderId || null;
      const folder = folders.find((f) => f.id === folderId);
      if (folder && folder.subjectId && !doc.subjectId) {
        doc.subjectId = folder.subjectId;
        renderSubjectSelect(doc);
        renderFileSelect(doc);
      }
      doc.updatedAt = new Date().toISOString();
      persistDocs();
      renderFolders();
      renderDocList();
    });

    docSubjectSelect?.addEventListener("change", () => {
      const doc = getActiveDoc();
      if (!doc) return;
      const val = docSubjectSelect.value || "";
      doc.subjectId = val || null;
      doc.fileId = null;
      doc.updatedAt = new Date().toISOString();
      persistDocs();
      renderDocList();
      renderSubjectSelect(doc);
      renderFileSelect(doc);
    });

    docFileSelect?.addEventListener("change", () => {
      const doc = getActiveDoc();
      if (!doc) return;
      const val = docFileSelect.value || "";
      doc.fileId = val || null;
      doc.updatedAt = new Date().toISOString();
      persistDocs();
      renderDocList();
    });

    newFolderToggleBtn?.addEventListener("click", () => {
      if (newFolderForm) newFolderForm.hidden = !newFolderForm.hidden;
      if (!newFolderForm.hidden) newFolderInput?.focus();
      renderFolderSubjectSelect();
      resetFolderForm();
    });
    cancelFolderBtn?.addEventListener("click", () => {
      if (newFolderForm) newFolderForm.hidden = true;
      if (newFolderInput) newFolderInput.value = "";
      resetFolderForm();
    });
    saveFolderBtn?.addEventListener("click", () => {
      if (!newFolderInput) return;
      const name = newFolderInput.value.trim();
      if (!name) {
        newFolderInput.focus();
        return;
      }
      const subjectIdVal = folderSubjectSelect ? folderSubjectSelect.value || null : null;
      if (editingFolderId) {
        const folder = folders.find((f) => f.id === editingFolderId);
        if (folder) {
          folder.name = name;
          folder.subjectId = subjectIdVal;
          docs = docs.map((d) => {
            if (d.folderId === folder.id && !d.subjectId && subjectIdVal) {
              return { ...d, subjectId: subjectIdVal };
            }
            return d;
          });
          persistDocs();
        }
      } else {
        const folder = {
          id: "folder_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
          name,
          subjectId: subjectIdVal
        };
        folders.push(folder);
        selectedFolderId = folder.id;
        if (subjectIdVal) seedDocsForFolder(folder);
      }
      persistFolders();
      renderFolders();
      renderDocList();
      const doc = getActiveDoc();
      if (doc) {
        renderFolderSelect(doc);
        persistDocs();
        renderSubjectSelect(doc);
        renderFileSelect(doc);
      }
      newFolderInput.value = "";
      if (newFolderForm) newFolderForm.hidden = true;
      resetFolderForm();
    });

    importInput?.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      await handleImport(file);
      importInput.value = "";
    });

    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener("study:state-replaced", () => {
      subjectsDirty = true;
      loadState();
      renderDocList();
      loadActiveDoc();
      renderFolders();
      renderTimer({ forceSubjects: true });
      updateStudyButtons();
    });
  }

  function init() {
    loadState();
    loadSubjects();
    renderDocList();
    renderFolders();
    loadActiveDoc();
    bindEvents();
    renderTimer({ forceSubjects: true });
    updateStudyButtons();
    setInterval(renderTimer, 350);
  }

  init();
})();
