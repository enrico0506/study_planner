(() => {
  const StudyPlanner = window.StudyPlanner || {};
  const Storage = StudyPlanner.Storage || null;
  const Assignments = StudyPlanner.Assignments || null;
  const ReviewEngine = StudyPlanner.ReviewEngine || null;

  const EXAM_MODE_KEY = "studyExamMode_v1";

  const els = {
    btn: document.getElementById("examModeBtn"),
    modal: document.getElementById("examModeModal"),
    backdrop: document.getElementById("examModeModalBackdrop"),
    closeBtn: document.getElementById("closeExamModeBtn"),
    title: document.getElementById("examModeTitle"),
    subtitle: document.getElementById("examModeSubtitle"),
    body: document.getElementById("examModeBody"),
  };

  if (!els.btn || !els.modal || !els.body) return;

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

  function loadMap() {
    const map = getJSON(EXAM_MODE_KEY, {});
    return map && typeof map === "object" && !Array.isArray(map) ? map : {};
  }

  function saveMap(map) {
    setJSON(EXAM_MODE_KEY, map, { debounceMs: 0 });
    try {
      window.dispatchEvent(new CustomEvent("study:exam-mode-changed"));
    } catch {}
  }

  function nowMs() {
    return Date.now();
  }

  function minutes(val) {
    return Math.max(0, Math.round(Number(val) || 0));
  }

  function loadSubjects() {
    const list = getJSON("studySubjects_v1", []);
    return Array.isArray(list) ? list : [];
  }

  function subjectName(subjects, id) {
    const s = subjects.find((x) => x && x.id === id);
    return (s && s.name) || "";
  }

  function fileName(subjects, subjectId, fileId) {
    const s = subjects.find((x) => x && x.id === subjectId);
    const f = s && Array.isArray(s.files) ? s.files.find((x) => x && x.id === fileId) : null;
    return (f && f.name) || "";
  }

  function computeCountdown(dueAtIso) {
    const d = dueAtIso ? new Date(dueAtIso) : null;
    if (!d || Number.isNaN(d.getTime())) return null;
    const ms = d.getTime() - nowMs();
    const sign = ms < 0 ? -1 : 1;
    const abs = Math.abs(ms);
    const days = Math.floor(abs / 86400000);
    const hours = Math.floor((abs % 86400000) / 3600000);
    return { sign, days, hours, date: d };
  }

  function openModal() {
    els.modal.classList.add("is-open");
    els.modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    if (!els.modal.classList.contains("is-open")) return;
    els.modal.classList.remove("is-open");
    els.modal.setAttribute("aria-hidden", "true");
  }

  const state = {
    examId: null,
    highlightItemId: null,
  };

  function ensureExamEntry(map, examId) {
    if (!map[examId] || typeof map[examId] !== "object") map[examId] = { items: [] };
    if (!Array.isArray(map[examId].items)) map[examId].items = [];
    return map[examId];
  }

  function createId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  }

  function renderExamMode(exam) {
    if (!exam || !els.body) return;
    const subjects = loadSubjects();
    const map = loadMap();
    const entry = ensureExamEntry(map, exam.id);
    const items = entry.items;

    els.body.replaceChildren();
    if (els.title) els.title.textContent = `Exam mode: ${exam.title || "Exam"}`;
    const countdown = computeCountdown(exam.dueAt);
    if (els.subtitle) {
      if (!countdown) els.subtitle.textContent = "Set a due date/time to enable countdown.";
      else {
        const prefix = countdown.sign < 0 ? "Started" : "In";
        els.subtitle.textContent = `${prefix} ${countdown.days}d ${countdown.hours}h · ${countdown.date.toLocaleString()}`;
      }
    }

    const section = (titleText) => {
      const wrap = document.createElement("div");
      wrap.className = "exam-mode-row";
      const h = document.createElement("div");
      h.className = "side-subtitle";
      h.textContent = titleText;
      wrap.appendChild(h);
      return { wrap };
    };

    // A) Countdown already in subtitle; add budget-aware remaining work.
    const secPlan = section("Plan remaining work");
    const remaining = items.filter((i) => i && !i.done).reduce((sum, i) => sum + minutes(i.estimateMinutes || 0), 0);
    const tb = StudyPlanner.TimeBudget?.load ? StudyPlanner.TimeBudget.load() : null;
    const line = document.createElement("div");
    line.className = "calendar-event-meta";
    line.textContent = remaining
      ? `Remaining estimate: ${remaining} min${tb?.dailyMaxMinutes ? ` · Daily max: ${tb.dailyMaxMinutes} min` : ""}`
      : `No syllabus estimates yet.${tb?.dailyMaxMinutes ? ` Daily max: ${tb.dailyMaxMinutes} min` : ""}`;
    secPlan.wrap.appendChild(line);
    const btnRow = document.createElement("div");
    btnRow.className = "assignments-row-actions";
    const addToAutoPlan = document.createElement("button");
    addToAutoPlan.type = "button";
    addToAutoPlan.className = "chip-btn";
    addToAutoPlan.textContent = "Add to Auto-plan preview";
    addToAutoPlan.addEventListener("click", () => {
      try {
        window.dispatchEvent(new CustomEvent("study:autoplan-open", { detail: { examId: exam.id } }));
      } catch {}
    });
    btnRow.appendChild(addToAutoPlan);
    secPlan.wrap.appendChild(btnRow);
    els.body.appendChild(secPlan.wrap);

    // B) Syllabus checklist
    const secS = section("Syllabus checklist");
    const addRow = document.createElement("div");
    addRow.className = "form-row";

    const subjSelect = document.createElement("select");
    const fileSelect = document.createElement("select");
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.placeholder = "Item title (optional)";

    const subjOpt0 = document.createElement("option");
    subjOpt0.value = "";
    subjOpt0.textContent = "— Subject —";
    subjSelect.appendChild(subjOpt0);
    subjects.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name || "Subject";
      subjSelect.appendChild(opt);
    });

    const renderFileOptions = () => {
      fileSelect.replaceChildren();
      const opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = "— File/topic —";
      fileSelect.appendChild(opt0);
      const subj = subjects.find((s) => s.id === subjSelect.value);
      const files = subj && Array.isArray(subj.files) ? subj.files : [];
      files.forEach((f) => {
        const opt = document.createElement("option");
        opt.value = f.id;
        opt.textContent = f.name || "File";
        fileSelect.appendChild(opt);
      });
    };
    subjSelect.addEventListener("change", renderFileOptions);
    renderFileOptions();

    const estInput = document.createElement("input");
    estInput.type = "number";
    estInput.min = "0";
    estInput.placeholder = "Est. min";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn";
    addBtn.textContent = "Add";
    addBtn.addEventListener("click", () => {
      const sid = subjSelect.value || null;
      const fid = fileSelect.value || null;
      const t = String(titleInput.value || "").trim() || (sid && fid ? fileName(subjects, sid, fid) : "");
      if (!t) return;
      const mapNow = loadMap();
      const entryNow = ensureExamEntry(mapNow, exam.id);
      entryNow.items.push({
        id: createId("sy"),
        title: t,
        subjectId: sid,
        fileId: fid,
        estimateMinutes: minutes(estInput.value || 0) || null,
        done: false,
        lastReviewedAt: null,
        createdAt: new Date().toISOString()
      });
      saveMap(mapNow);
      renderExamMode(exam);
    });

    addRow.appendChild(subjSelect);
    addRow.appendChild(fileSelect);
    addRow.appendChild(titleInput);
    addRow.appendChild(estInput);
    addRow.appendChild(addBtn);
    secS.wrap.appendChild(addRow);

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "calendar-empty";
      empty.textContent = "No syllabus items yet. Add topics you must cover before the exam.";
      secS.wrap.appendChild(empty);
    } else {
      items.forEach((it) => {
        const card = document.createElement("div");
        card.className = "exam-syllabus-item";
        if (state.highlightItemId && it.id === state.highlightItemId) {
          card.style.boxShadow = "0 0 0 2px rgba(47, 98, 244, 0.28)";
        }
        const top = document.createElement("div");
        top.className = "exam-syllabus-top";

        const left = document.createElement("div");
        const title = document.createElement("div");
        title.className = "exam-syllabus-title";
        title.textContent = it.title || "Syllabus item";
        const meta = document.createElement("div");
        meta.className = "exam-syllabus-meta";
        const subjLabel = it.subjectId ? subjectName(subjects, it.subjectId) : "";
        const fileLabel = it.subjectId && it.fileId ? fileName(subjects, it.subjectId, it.fileId) : "";
        const last = it.lastReviewedAt ? new Date(it.lastReviewedAt).toLocaleDateString() : "never";
        meta.textContent = [subjLabel, fileLabel].filter(Boolean).join(" · ") + (subjLabel || fileLabel ? ` · last: ${last}` : `Last: ${last}`);

        left.appendChild(title);
        left.appendChild(meta);

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !!it.done;
        checkbox.addEventListener("change", () => {
          const mapNow = loadMap();
          const entryNow = ensureExamEntry(mapNow, exam.id);
          const target = entryNow.items.find((x) => x.id === it.id);
          if (!target) return;
          target.done = checkbox.checked;
          saveMap(mapNow);
          renderExamMode(exam);
        });

        top.appendChild(left);
        top.appendChild(checkbox);

        const actions = document.createElement("div");
        actions.className = "exam-syllabus-actions";
        const reviewBtn = document.createElement("button");
        reviewBtn.type = "button";
        reviewBtn.className = "chip-btn chip-btn-primary";
        reviewBtn.textContent = "Mark reviewed";
        reviewBtn.addEventListener("click", () => {
          const mapNow = loadMap();
          const entryNow = ensureExamEntry(mapNow, exam.id);
          const target = entryNow.items.find((x) => x.id === it.id);
          if (!target) return;
          target.lastReviewedAt = new Date().toISOString();
          saveMap(mapNow);
          renderExamMode(exam);
        });
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "btn btn-secondary";
        delBtn.textContent = "Delete";
        delBtn.addEventListener("click", () => {
          if (!confirm("Delete this syllabus item?")) return;
          const mapNow = loadMap();
          const entryNow = ensureExamEntry(mapNow, exam.id);
          entryNow.items = entryNow.items.filter((x) => x.id !== it.id);
          saveMap(mapNow);
          renderExamMode(exam);
        });
        actions.appendChild(reviewBtn);
        actions.appendChild(delBtn);

        card.appendChild(top);
        card.appendChild(actions);
        secS.wrap.appendChild(card);
      });
    }
    els.body.appendChild(secS.wrap);

    // C) Due for review before exam (from engine)
    const secDue = section("Due for review before exam");
    const dueWrap = document.createElement("div");
    dueWrap.className = "calendar-upcoming";
    const queue = ReviewEngine && ReviewEngine.getQueue ? ReviewEngine.getQueue({ limit: 8 }) : [];
    const examItems = (queue || []).filter((q) => q.kind === "exam_item" && q.examId === exam.id);
    if (!examItems.length) {
      const empty = document.createElement("div");
      empty.className = "calendar-empty";
      empty.textContent = "Nothing urgent from the exam syllabus right now.";
      dueWrap.appendChild(empty);
    } else {
      examItems.forEach((q) => {
        const row = document.createElement("div");
        row.className = "calendar-upcoming-row";
        const t = document.createElement("div");
        t.className = "calendar-upcoming-title";
        t.textContent = q.title;
        const m = document.createElement("div");
        m.className = "calendar-upcoming-meta";
        m.textContent = `${q.daysLeft}d left · ~${q.estMinutes || 20} min`;
        row.appendChild(t);
        row.appendChild(m);
        dueWrap.appendChild(row);
      });
    }
    secDue.wrap.appendChild(dueWrap);
    els.body.appendChild(secDue.wrap);
  }

  function getUpcomingExams() {
    const now = nowMs();
    const horizon = now + 60 * 86400000;
    const list = Assignments ? Assignments.loadAll() : getJSON("studyAssignments", []);
    const exams = (Array.isArray(list) ? list : [])
      .filter((a) => a && a.type === "exam" && a.status !== "done" && a.dueAt)
      .map((a) => {
        const due = new Date(a.dueAt).getTime();
        return !due || Number.isNaN(due) ? null : { ...a, _dueMs: due };
      })
      .filter(Boolean)
      .filter((a) => a._dueMs >= now && a._dueMs <= horizon)
      .sort((a, b) => a._dueMs - b._dueMs);
    return exams;
  }

  function refreshButtonVisibility() {
    const exams = getUpcomingExams();
    els.btn.hidden = exams.length === 0;
    if (!els.btn.hidden) {
      const next = exams[0];
      els.btn.textContent = "Exam mode";
      els.btn.title = next ? `Open exam mode for: ${next.title}` : "Exam mode";
    }
  }

  function openExam(examId, itemId) {
    const exams = getUpcomingExams();
    const exam = exams.find((e) => e.id === examId) || exams[0];
    if (!exam) return;
    state.examId = exam.id;
    state.highlightItemId = itemId || null;
    renderExamMode(exam);
    openModal();
  }

  els.btn.addEventListener("click", () => openExam(null, null));
  els.closeBtn?.addEventListener("click", closeModal);
  els.backdrop?.addEventListener("click", (e) => {
    if (e.target === els.backdrop) closeModal();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (els.modal && els.modal.classList.contains("is-open")) {
      event.preventDefault();
      closeModal();
    }
  });

  window.addEventListener("study:assignments-changed", refreshButtonVisibility);
  window.addEventListener("study:exam-mode-changed", refreshButtonVisibility);
  window.addEventListener("study:state-replaced", refreshButtonVisibility);
  window.addEventListener("study:open-exam-mode", (event) => {
    const d = event && event.detail ? event.detail : null;
    if (!d) return;
    openExam(d.examId, d.itemId);
  });

  // Deep link: calendar.html?openExamMode=1&examId=...&examItemId=...
  try {
    const params = new URLSearchParams(window.location.search || "");
    const open = params.get("openExamMode");
    const examId = params.get("examId");
    const itemId = params.get("examItemId");
    if (open && (open === "1" || open === "true")) {
      setTimeout(() => openExam(examId, itemId), 0);
      params.delete("openExamMode");
      params.delete("examId");
      params.delete("examItemId");
      const next = params.toString();
      history.replaceState({}, "", next ? `?${next}` : window.location.pathname);
    }
  } catch {}

  // Integrate with autoplan wizard (best-effort).
  window.addEventListener("study:autoplan-open", (event) => {
    const d = event && event.detail ? event.detail : null;
    if (!d || !d.examId) return;
    const autoBtn = document.getElementById("autoPlanWeekBtn");
    autoBtn?.click();
  });

  refreshButtonVisibility();
})();

