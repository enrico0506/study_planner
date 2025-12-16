(() => {
  const StudyPlanner = window.StudyPlanner || {};
  const Assignments = StudyPlanner.Assignments || null;
  if (!Assignments) return;

  const els = {
    panel: document.getElementById("assignmentsPanel"),
    list: document.getElementById("assignmentsList"),
    addBtn: document.getElementById("assignmentsAddBtn"),
    autoPlanBtn: document.getElementById("autoPlanWeekBtn"),
    filterDueSoonBtn: document.getElementById("assignmentsFilterDueSoon"),
    filterThisWeekBtn: document.getElementById("assignmentsFilterThisWeek"),
    filterAllBtn: document.getElementById("assignmentsFilterAll"),
    statusSelect: document.getElementById("assignmentsStatusFilter"),
    status: document.getElementById("assignmentsStatus"),

    modal: document.getElementById("assignmentModal"),
    modalBackdrop: document.getElementById("assignmentModalBackdrop"),
    modalTitle: document.getElementById("assignmentModalTitle"),
    closeModalBtn: document.getElementById("closeAssignmentModalBtn"),
    form: document.getElementById("assignmentForm"),
    typeSelect: document.getElementById("assignmentTypeSelect"),
    titleInput: document.getElementById("assignmentTitleInput"),
    dueInput: document.getElementById("assignmentDueInput"),
    subjectSelect: document.getElementById("assignmentSubjectSelect"),
    fileSelect: document.getElementById("assignmentFileSelect"),
    estimateInput: document.getElementById("assignmentEstimateInput"),
    statusSelectEdit: document.getElementById("assignmentStatusSelect"),
    prioritySelect: document.getElementById("assignmentPrioritySelect"),
    spentLabel: document.getElementById("assignmentSpentLabel"),
    notesBtn: document.getElementById("assignmentNotesBtn"),
    duplicateBtn: document.getElementById("assignmentDuplicateBtn"),
    deleteBtn: document.getElementById("assignmentDeleteBtn"),
    studyBtn: document.getElementById("assignmentStudyBtn"),
    formStatus: document.getElementById("assignmentFormStatus"),
  };

  if (!els.panel || !els.list) return;

  const state = {
    filter: "dueSoon",
    status: "open",
    editingId: null,
    subjects: [],
  };

  const DEFAULT_SUBJECT_COLORS = ["#4f8bff", "#4ec58a", "#f77fb3", "#f6a23c", "#b18bff", "#37c6c0", "#f17575", "#f4c74f"];

  function safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function loadSubjects() {
    try {
      const raw = localStorage.getItem("studySubjects_v1");
      if (!raw) return [];
      const parsed = safeJsonParse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function loadPalette() {
    try {
      const raw = localStorage.getItem("studyColorPalette_v1");
      if (!raw) return DEFAULT_SUBJECT_COLORS;
      const parsed = safeJsonParse(raw);
      return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_SUBJECT_COLORS;
    } catch {
      return DEFAULT_SUBJECT_COLORS;
    }
  }

  function subjectColor(subjectId) {
    if (!subjectId) return "rgba(148, 163, 184, 0.8)";
    const idx = state.subjects.findIndex((s) => s.id === subjectId);
    if (idx === -1) return "rgba(148, 163, 184, 0.8)";
    const palette = loadPalette();
    return palette[idx % palette.length] || palette[0] || DEFAULT_SUBJECT_COLORS[0];
  }

  function setStatus(message, tone = "muted") {
    if (!els.status) return;
    els.status.textContent = message || "";
    els.status.dataset.tone = tone;
  }

  function setFormStatus(message, tone = "muted") {
    if (!els.formStatus) return;
    els.formStatus.textContent = message || "";
    els.formStatus.dataset.tone = tone;
  }

  function startOfWeek(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const weekday = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - weekday);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function endOfWeek(date) {
    const d = startOfWeek(date);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  function parseDueAt(item) {
    if (!item || !item.dueAt) return null;
    const d = new Date(item.dueAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function localDatetimeValue(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  function toIsoFromLocalInput(value) {
    if (!value) return "";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  }

  function applyFilterButtons() {
    const pressed = (btn, on) => btn && btn.setAttribute("aria-pressed", on ? "true" : "false");
    pressed(els.filterDueSoonBtn, state.filter === "dueSoon");
    pressed(els.filterThisWeekBtn, state.filter === "thisWeek");
    pressed(els.filterAllBtn, state.filter === "all");
  }

  function filterList(list) {
    const now = new Date();
    const start = startOfWeek(now);
    const end = endOfWeek(now);
    const horizon = new Date(now);
    horizon.setDate(now.getDate() + 14);

    return list
      .filter((a) => {
        if (state.status === "open") return a.status !== "done";
        if (state.status === "done") return a.status === "done";
        return true;
      })
      .filter((a) => {
        const due = parseDueAt(a);
        if (!due) return state.filter === "all";
        if (state.filter === "dueSoon") return due >= new Date(now.getTime() - 86400000) && due <= horizon;
        if (state.filter === "thisWeek") return due >= start && due <= end;
        return true;
      })
      .sort((a, b) => {
        const da = parseDueAt(a);
        const db = parseDueAt(b);
        if (!da && !db) return a.title.localeCompare(b.title);
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
      });
  }

  function labelForType(type) {
    return type === "exam" ? "Exam" : "Assignment";
  }

  function renderPanel() {
    state.subjects = loadSubjects();
    const all = Assignments.loadAll();
    const list = filterList(all);

    els.list.replaceChildren();
    applyFilterButtons();

    const openCount = all.filter((a) => a.status !== "done").length;
    const dueSoonCount = all.filter((a) => {
      if (a.status === "done") return false;
      const due = parseDueAt(a);
      if (!due) return false;
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 14);
      return due <= horizon;
    }).length;
    setStatus(`${openCount} open • ${dueSoonCount} due soon`, "muted");

    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "calendar-empty";
      empty.textContent = "No assignments yet. Add one to plan around deadlines.";
      els.list.appendChild(empty);
      return;
    }

    list.slice(0, 30).forEach((a) => {
      const row = document.createElement("div");
      row.className = "calendar-upcoming-row";
      row.dataset.assignmentId = a.id;

      const head = document.createElement("div");
      head.className = "assignments-meta-row";

      const dot = document.createElement("span");
      dot.className = "subject-dot";
      dot.style.backgroundColor = subjectColor(a.subjectId);
      dot.title = "Linked subject";
      dot.setAttribute("aria-hidden", "true");

      const chip = document.createElement("span");
      chip.className = `calendar-chip calendar-chip-${a.type === "exam" ? "exam" : "deadline"}`;
      chip.textContent = labelForType(a.type);

      const title = document.createElement("div");
      title.className = "calendar-upcoming-title";
      title.textContent = a.title;

      head.appendChild(dot);
      head.appendChild(chip);
      head.appendChild(title);

      const meta = document.createElement("div");
      meta.className = "calendar-upcoming-meta";
      const due = parseDueAt(a);
      const dueLabel = due
        ? `${due.toLocaleDateString()} · ${due.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : "No due date";
      const est = a.estimateMinutes ? `${a.estimateMinutes} min` : "est. ?";
      const spent = `${a.spentMinutes || 0} min spent`;
      meta.textContent = `${dueLabel} · ${a.status.replace("_", " ")} · ${est} · ${spent}`;

      const actions = document.createElement("div");
      actions.className = "assignments-row-actions";

      const doneBtn = document.createElement("button");
      doneBtn.type = "button";
      doneBtn.className = a.status === "done" ? "chip-btn chip-btn-primary" : "chip-btn";
      doneBtn.textContent = a.status === "done" ? "Done" : "Mark done";
      doneBtn.addEventListener("click", () => {
        Assignments.upsert({ ...a, status: a.status === "done" ? "todo" : "done" });
        renderPanel();
      });

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "chip-btn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => openEditModal(a.id));

      const studyBtn = document.createElement("button");
      studyBtn.type = "button";
      studyBtn.className = "chip-btn chip-btn-primary";
      studyBtn.textContent = "Study";
      studyBtn.disabled = !(a.subjectId && a.fileId);
      studyBtn.title = studyBtn.disabled ? "Link a file/topic to track focus time." : "Start focus session for this assignment.";
      studyBtn.addEventListener("click", () => startStudyFromAssignment(a));

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "icon-btn icon-btn-ghost";
      delBtn.textContent = "✕";
      delBtn.setAttribute("aria-label", "Delete assignment");
      delBtn.addEventListener("click", () => {
        if (!confirm("Delete this assignment/exam?")) return;
        Assignments.remove(a.id);
        renderPanel();
      });

      actions.appendChild(doneBtn);
      actions.appendChild(editBtn);
      actions.appendChild(studyBtn);
      actions.appendChild(delBtn);

      row.appendChild(head);
      row.appendChild(meta);
      row.appendChild(actions);
      els.list.appendChild(row);
    });
  }

  function openModal() {
    if (!els.modal) return;
    els.modal.classList.add("is-open");
    els.modal.setAttribute("aria-hidden", "false");
    els.titleInput?.focus();
  }

  function closeModal() {
    if (!els.modal || !els.modal.classList.contains("is-open")) return;
    els.modal.classList.remove("is-open");
    els.modal.setAttribute("aria-hidden", "true");
    state.editingId = null;
  }

  function renderSubjectSelect(selectedSubjectId) {
    if (!els.subjectSelect || !els.fileSelect) return;
    els.subjectSelect.replaceChildren();
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "— Not linked —";
    els.subjectSelect.appendChild(none);

    state.subjects.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name || "Subject";
      els.subjectSelect.appendChild(opt);
    });
    if (selectedSubjectId) els.subjectSelect.value = selectedSubjectId;
    renderFileSelect(els.subjectSelect.value, null);
  }

  function renderFileSelect(subjectId, selectedFileId) {
    if (!els.fileSelect) return;
    els.fileSelect.replaceChildren();
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "— Not linked —";
    els.fileSelect.appendChild(none);
    const subj = state.subjects.find((s) => s.id === subjectId);
    const files = subj && Array.isArray(subj.files) ? subj.files : [];
    files.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.name || "File";
      els.fileSelect.appendChild(opt);
    });
    if (selectedFileId) els.fileSelect.value = selectedFileId;
  }

  function openNewModal() {
    state.editingId = null;
    const settings = Assignments.loadSettings();
    els.form?.reset();
    if (els.modalTitle) els.modalTitle.textContent = "Add assignment/exam";
    if (els.typeSelect) els.typeSelect.value = "assignment";
    if (els.statusSelectEdit) els.statusSelectEdit.value = "todo";
    if (els.prioritySelect) els.prioritySelect.value = "normal";
    if (els.estimateInput) els.estimateInput.value = String(settings.defaultEstimateMinutes || 60);
    if (els.spentLabel) els.spentLabel.textContent = "0 min";
    renderSubjectSelect("");
    renderFileSelect("", "");
    setFormStatus("", "muted");
    openModal();
  }

  function openEditModal(id) {
    const a = Assignments.getById(id);
    if (!a) return;
    state.editingId = id;
    if (els.modalTitle) els.modalTitle.textContent = "Edit assignment/exam";
    if (els.typeSelect) els.typeSelect.value = a.type;
    if (els.titleInput) els.titleInput.value = a.title;
    if (els.dueInput) els.dueInput.value = localDatetimeValue(a.dueAt);
    if (els.estimateInput) els.estimateInput.value = a.estimateMinutes == null ? "" : String(a.estimateMinutes);
    if (els.statusSelectEdit) els.statusSelectEdit.value = a.status;
    if (els.prioritySelect) els.prioritySelect.value = a.priority || "normal";
    if (els.spentLabel) els.spentLabel.textContent = `${a.spentMinutes || 0} min`;
    renderSubjectSelect(a.subjectId || "");
    renderFileSelect(a.subjectId || "", a.fileId || "");
    setFormStatus("Editing existing entry.", "muted");
    openModal();
  }

  function startStudyFromAssignment(a) {
    if (!a || !a.subjectId || !a.fileId) return;
    Assignments.upsert({ ...a, status: a.status === "done" ? "in_progress" : a.status || "in_progress" });
    const params = new URLSearchParams();
    params.set("mode", "board");
    params.set("startAssignment", "1");
    params.set("assignmentId", a.id);
    params.set("subjectId", a.subjectId);
    params.set("fileId", a.fileId);
    window.location.href = `index.html?${params.toString()}`;
  }

  function openNotesForEditing() {
    if (!StudyPlanner.Notes) return;
    const id = state.editingId;
    const draftTitle = (els.titleInput && els.titleInput.value.trim()) || "";
    const label = draftTitle ? `Notes · ${draftTitle}` : "Notes · Assignment";
    if (!id) {
      setFormStatus("Save the assignment once before adding notes.", "error");
      return;
    }
    StudyPlanner.Notes.open({ scope: "assignment", scopeId: id, label });
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    const title = String(els.titleInput?.value || "").trim();
    if (!title) {
      setFormStatus("Title is required.", "error");
      els.titleInput?.focus();
      return;
    }
    const dueAt = toIsoFromLocalInput(els.dueInput?.value || "");
    if (!dueAt) {
      setFormStatus("Due date/time is required.", "error");
      els.dueInput?.focus();
      return;
    }
    const existing = state.editingId ? Assignments.getById(state.editingId) : null;
    const estimateVal = String(els.estimateInput?.value || "").trim();
    const estimateMinutes = estimateVal ? Number(estimateVal) : null;
    const payload = {
      ...(existing || {}),
      id: existing ? existing.id : undefined,
      type: els.typeSelect?.value === "exam" ? "exam" : "assignment",
      title,
      subjectId: els.subjectSelect?.value || null,
      fileId: els.fileSelect?.value || null,
      dueAt,
      estimateMinutes: Number.isFinite(estimateMinutes) ? estimateMinutes : null,
      status: els.statusSelectEdit?.value || "todo",
      priority: els.prioritySelect?.value || "normal",
      notesMd: existing ? existing.notesMd || "" : "",
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
    };

    const saved = Assignments.upsert(payload);
    state.editingId = saved.id;
    setFormStatus("Saved.", "success");
    renderPanel();
    closeModal();
  }

  function deleteFromModal() {
    const id = state.editingId;
    if (!id) return;
    if (!confirm("Delete this assignment/exam?")) return;
    Assignments.remove(id);
    closeModal();
    renderPanel();
  }

  function duplicateFromModal() {
    const id = state.editingId;
    if (!id) return;
    const copy = Assignments.duplicate(id);
    if (!copy) return;
    closeModal();
    renderPanel();
    openEditModal(copy.id);
  }

  function studyFromModal() {
    const id = state.editingId;
    const a = id ? Assignments.getById(id) : null;
    if (!a) return;
    if (!a.subjectId || !a.fileId) {
      setFormStatus("Link a file/topic to start a tracked focus session.", "error");
      return;
    }
    startStudyFromAssignment(a);
  }

  function setFilter(next) {
    state.filter = next;
    renderPanel();
  }

  function setStatusFilter(next) {
    state.status = next;
    renderPanel();
  }

  function init() {
    state.subjects = loadSubjects();
    applyFilterButtons();
    renderPanel();

    els.addBtn?.addEventListener("click", openNewModal);
    els.filterDueSoonBtn?.addEventListener("click", () => setFilter("dueSoon"));
    els.filterThisWeekBtn?.addEventListener("click", () => setFilter("thisWeek"));
    els.filterAllBtn?.addEventListener("click", () => setFilter("all"));
    els.statusSelect?.addEventListener("change", () => setStatusFilter(els.statusSelect.value || "open"));

    els.closeModalBtn?.addEventListener("click", closeModal);
    els.modalBackdrop?.addEventListener("click", (e) => {
      if (e.target === els.modalBackdrop) closeModal();
    });
    els.form?.addEventListener("submit", handleFormSubmit);

    els.subjectSelect?.addEventListener("change", () => {
      renderFileSelect(els.subjectSelect.value || "", "");
    });

    els.notesBtn?.addEventListener("click", openNotesForEditing);
    els.deleteBtn?.addEventListener("click", deleteFromModal);
    els.duplicateBtn?.addEventListener("click", duplicateFromModal);
    els.studyBtn?.addEventListener("click", studyFromModal);

    window.addEventListener("study:assignments-changed", () => renderPanel());
    window.addEventListener("study:state-replaced", () => renderPanel());
    window.addEventListener("study:open-assignment", (event) => {
      const id = event && event.detail ? event.detail.id : null;
      if (id) openEditModal(id);
    });

    window.addEventListener("study:open-entity", (event) => {
      const d = event && event.detail ? event.detail : null;
      if (!d || typeof d !== "object") return;
      if (d.kind === "assignment" && d.assignmentId) {
        openEditModal(d.assignmentId);
        return;
      }
      if (d.kind === "subject" && d.subjectId) {
        const params = new URLSearchParams();
        params.set("openSubjectId", d.subjectId);
        window.location.href = `index.html?${params.toString()}`;
        return;
      }
      if (d.kind === "file" && d.subjectId && d.fileId) {
        const params = new URLSearchParams();
        params.set("openFileSubjectId", d.subjectId);
        params.set("openFileId", d.fileId);
        window.location.href = `index.html?${params.toString()}`;
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (els.modal && els.modal.classList.contains("is-open")) {
        event.preventDefault();
        closeModal();
      }
    });

    // Deep link from other pages (e.g. Notes links).
    try {
      const params = new URLSearchParams(window.location.search || "");
      const openAssignmentId = params.get("openAssignmentId");
      if (openAssignmentId) {
        openEditModal(openAssignmentId);
        params.delete("openAssignmentId");
        const next = params.toString();
        history.replaceState({}, "", next ? `?${next}` : window.location.pathname);
      }
    } catch {}
  }

  init();
})();
