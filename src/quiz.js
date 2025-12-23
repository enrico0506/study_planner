(() => {
  /**
   * Quiz hub: session-first flow with library, CSV import, resume, confidence, weak areas.
   * Local-first storage with optional server sync (latest set).
   */
  const els = {
    importedSelect: document.getElementById("importedSelect"),
    topicSelect: document.getElementById("topicSelect"),
    sourceBtns: Array.from(document.querySelectorAll(".seg-btn[data-source]")),
    modeBtns: Array.from(document.querySelectorAll(".seg-btn[data-mode]")),
    sizeBtns: Array.from(document.querySelectorAll("#sizeGroup .seg-btn")),
    shuffleQuestions: document.getElementById("shuffleQuestions"),
    shuffleAnswers: document.getElementById("shuffleAnswers"),
    sessionTimer: document.getElementById("sessionTimer"),
    startBtn: document.getElementById("startSessionBtn"),
    summaryStrip: document.getElementById("summaryStrip"),
    summaryMeta: document.getElementById("summaryMeta"),
    summaryMode: document.getElementById("summaryMode"),
    resumeHint: document.getElementById("resumeHint"),
    resumeText: document.getElementById("resumeText"),
    resumeBtn: document.getElementById("resumeBtn"),
    discardResumeBtn: document.getElementById("discardResumeBtn"),
    continueSessionBtn: document.getElementById("continueSessionBtn"),
    openImportBtn: document.getElementById("openImportBtn"),
    openImportBtn2: document.getElementById("openImportBtn2"),
    importPanel: document.getElementById("importPanel"),
    csvDropzone: document.getElementById("csvDropzone"),
    pickCsvBtn: document.getElementById("pickCsvBtn"),
    csvFile: document.getElementById("csvFile"),
    importSubjectSelect: document.getElementById("importSubjectSelect"),
    importFileSelect: document.getElementById("importFileSelect"),
    importStatus: document.getElementById("importStatus"),
    previewList: document.getElementById("previewList"),
    csvHelp: document.getElementById("csvHelp"),
    importedList: document.getElementById("importedList"),
    importedSearch: document.getElementById("importedSearch"),
    topicSearch: document.getElementById("topicSearch"),
    topicSort: document.getElementById("topicSort"),
    leftSetList: document.getElementById("leftSetList"),
    sessionSummary: document.getElementById("sessionSummary"),
    runTitle: document.getElementById("runTitle"),
    runMeta: document.getElementById("runMeta"),
    runTimer: document.getElementById("runTimer"),
    flagBtn: document.getElementById("flagBtn"),
    progressBar: document.getElementById("progressBar"),
    qCounter: document.getElementById("qCounter"),
    questionText: document.getElementById("questionText"),
    choices: document.getElementById("choices"),
    feedback: document.getElementById("feedback"),
    confidenceRow: document.getElementById("confidenceRow"),
    confidenceBtns: Array.from(document.querySelectorAll("#confidenceRow .seg-btn")),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    finishBtn: document.getElementById("finishBtn"),
    resultCard: document.getElementById("resultCard"),
    resultSummary: document.getElementById("resultSummary"),
    metricAccuracy: document.getElementById("metricAccuracy"),
    metricTime: document.getElementById("metricTime"),
    metricAvg: document.getElementById("metricAvg"),
    weakAreasList: document.getElementById("weakAreasList"),
    reviewList: document.getElementById("reviewList"),
    reviewIncorrectBtn: document.getElementById("reviewIncorrectBtn"),
    retryFlaggedBtn: document.getElementById("retryFlaggedBtn"),
    newSessionBtn: document.getElementById("newSessionBtn"),
    librarySection: document.querySelector(".quiz-library"),
  };

  if (!els.importedSelect) return;

  const QUIZ_DATA_KEY = "studyQuizData_v2";
  const QUIZ_STATS_KEY = "studyQuizStats_v1";
  const QUIZ_SESSION_KEY = "studyQuizActiveSession_v1";
  const QUIZ_LIBRARY_STATE_KEY = "studyQuizLibraryState_v1";
  const QUIZ_SOURCE_KEY = "studyQuizSource_v1";
  const STORAGE = (window.StudyPlanner && window.StudyPlanner.Storage) || null;

  const state = {
    data: { sets: [], topics: [] },
    stats: {},
    session: null,
    mode: "study",
    source: "imported",
    size: "10",
    libraryCollapsed: true,
    selectedTopicIds: new Set(),
    subjects: [],
    timerHandle: null,
  };

  const csvTemplate = `quiz;question_no;question;choice_A;choice_B;choice_C;choice_D;correct_letter;hint
Sample Set;1;What is the capital of France?;Paris;Berlin;Madrid;Rome;A;Eiffel Tower city
Sample Set;2;2 + 2 = ?;3;4;5;;B;Basic math
Sample Set;3;Which element has symbol O?;Gold;Oxygen;Iron;Silver;B;Air`;

  function getJSON(key, fallback) {
    if (STORAGE && STORAGE.getJSON) return STORAGE.getJSON(key, fallback);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function setJSON(key, value) {
    if (STORAGE && STORAGE.setJSON) return STORAGE.setJSON(key, value, { debounceMs: 0 });
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  async function saveRemoteQuizSet({ name, csvText, quizNames, totalQuestions, subjectRef }) {
    try {
      const res = await fetch("/api/quiz-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          csvText,
          quizNames,
          totalQuestions,
          subjectRef: subjectRef || null,
        }),
      });
      if (!res.ok) return false;
      return true;
    } catch {
      return false;
    }
  }

  async function loadRemoteQuizSet() {
    try {
      const res = await fetch("/api/quiz-sets/latest");
      if (!res.ok) return false;
      const data = await res.json();
      if (!data || !data.quizSet || !data.quizSet.csvText) return false;
      const set = parseCsvToSet(data.quizSet.csvText, data.quizSet.name || "Saved quiz", {
        subjectRef:
          data.quizSet.subjectId || data.quizSet.fileId
            ? {
                subjectId: data.quizSet.subjectId,
                fileId: data.quizSet.fileId,
                subjectName: data.quizSet.subjectName || "",
                fileName: data.quizSet.fileName || "",
              }
            : null,
      });
      addSet(set);
      return true;
    } catch {
      return false;
    }
  }

  function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(16).slice(2, 10)}`;
  }

  function loadSubjects() {
    const list = getJSON("studySubjects_v1", []);
    state.subjects = Array.isArray(list) ? list : [];
  }

  function getFilesForSubject(subjectId) {
    if (!subjectId) return [];
    const subj = state.subjects.find((s) => s.id === subjectId);
    return Array.isArray(subj?.files) ? subj.files : [];
  }

  function computeSubjectMetrics() {
    const byId = {};
    state.data.sets.forEach((set) => {
      set.questions.forEach((q) => {
        if (!q.subjectId) return;
        const st = state.stats[q.id] || {};
        if (!byId[q.subjectId]) byId[q.subjectId] = { seen: 0, correct: 0, last: 0 };
        byId[q.subjectId].seen += st.timesSeen || 0;
        byId[q.subjectId].correct += st.timesCorrect || 0;
        byId[q.subjectId].last = Math.max(byId[q.subjectId].last, st.lastSeenAt || 0);
      });
    });
    state.subjects = state.subjects.map((s) => {
      const m = byId[s.id] || null;
      return {
        ...s,
        quizAccuracy: m && m.seen ? Math.round((m.correct * 100) / m.seen) : null,
        quizLast: m ? m.last : 0,
      };
    });
  }

  function migrateData() {
    const legacy = getJSON("studyQuizSavedCsv_v1", null);
    if (!legacy || !legacy.text) return null;
    const set = parseCsvToSet(legacy.text, legacy.name || "Imported set", {
      subjectRef: legacy.subjectRef || null,
    });
    set.updatedAt = Date.now();
    setJSON(QUIZ_DATA_KEY, { sets: [set] });
    localStorage.removeItem("studyQuizSavedCsv_v1");
    return set;
  }

  function loadData() {
    const stored = getJSON(QUIZ_DATA_KEY, null);
    if (stored && Array.isArray(stored.sets)) {
      state.data = stored;
    } else {
      const migrated = migrateData();
      state.data = migrated ? { sets: [migrated] } : { sets: [] };
    }
    dedupeSets();
    state.stats = getJSON(QUIZ_STATS_KEY, {});
    state.libraryCollapsed = !!getJSON(QUIZ_LIBRARY_STATE_KEY, { collapsed: false }).collapsed;
    const savedSource = getJSON(QUIZ_SOURCE_KEY, null);
    if (savedSource) {
      state.source = savedSource.source || state.source;
      state.mode = savedSource.mode || state.mode;
      state.size = savedSource.size || state.size;
      if (Array.isArray(savedSource.topicIds)) state.selectedTopicIds = new Set(savedSource.topicIds);
    }
    computeSubjectMetrics();
  }

  function saveData() {
    setJSON(QUIZ_DATA_KEY, state.data);
  }

  function saveStats() {
    setJSON(QUIZ_STATS_KEY, state.stats);
    computeSubjectMetrics();
  }

  function saveLibraryState() {
    setJSON(QUIZ_LIBRARY_STATE_KEY, { collapsed: state.libraryCollapsed });
  }

  function saveSourceState() {
    setJSON(QUIZ_SOURCE_KEY, {
      source: state.source,
      mode: state.mode,
      size: state.size,
      topicIds: Array.from(state.selectedTopicIds),
    });
  }

  function formatMs(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    if (total < 60) return `${total}s`;
    const m = Math.floor(total / 60);
    const s = total % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
  }

  function setStatus(msg, tone = "info") {
    if (!els.importStatus) return;
    els.importStatus.textContent = msg;
    els.importStatus.dataset.tone = tone;
  }

  function detectDelimiter(line) {
    const candidates = [";", ",", "\t"];
    const counts = candidates.map((d) => (line.match(new RegExp(`\\${d}`, "g")) || []).length);
    let best = 0;
    for (let i = 1; i < counts.length; i++) if (counts[i] > counts[best]) best = i;
    return candidates[best];
  }

  function parseCSV(text) {
    const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const firstLine = raw.split("\n").find((l) => l.trim().length > 0) || "";
    const delim = detectDelimiter(firstLine);
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      const next = raw[i + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (!inQuotes && ch === delim) {
        row.push(field);
        field = "";
        continue;
      }
      if (!inQuotes && ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        continue;
      }
      field += ch;
    }
    row.push(field);
    rows.push(row);
    return { rows: rows.filter((r) => r.some((c) => String(c).trim() !== "")), delimiter: delim };
  }

  function normalizeHeader(h) {
    return String(h || "").trim().toLowerCase().replace(/\s+/g, "_");
  }

  function letterToIndex(letter) {
    const map = { A: 0, B: 1, C: 2, D: 3 };
    const L = String(letter || "").trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(map, L) ? map[L] : null;
  }

  function parseCsvToSet(csvText, name = "Imported set", { subjectRef = null } = {}) {
    const { rows, delimiter } = parseCSV(csvText);
    if (rows.length < 2) throw new Error("CSV needs header + at least one question.");
    const header = rows[0].map(normalizeHeader);
    const dataRows = rows.slice(1);
    const get = (obj, ...keys) => {
      for (const k of keys) if (obj[k] != null && String(obj[k]).trim() !== "") return obj[k];
      return "";
    };

    const questions = [];
    dataRows.forEach((row, idx) => {
      const obj = {};
      for (let c = 0; c < header.length; c++) obj[header[c]] = row[c] ?? "";
      const prompt = String(get(obj, "question", "frage", "prompt", "q")).trim();
      const a = String(get(obj, "choice_a", "a")).trim();
      const b = String(get(obj, "choice_b", "b")).trim();
      const c = String(get(obj, "choice_c", "c")).trim();
      const d = String(get(obj, "choice_d", "d")).trim();
      const choices = [a, b, c, d].filter((x) => x !== "");
      if (!prompt) return;
      if (choices.length < 2) throw new Error(`Row ${idx + 2}: need at least 2 choices.`);
      let correctIndex = null;
      const ci = get(obj, "correct_index", "korrekt_index");
      if (String(ci).trim() !== "" && Number.isFinite(Number(ci))) correctIndex = Number(ci);
      if (correctIndex == null) {
        const cl = get(obj, "correct_letter", "korrekt_buchstabe");
        const li = letterToIndex(cl);
        if (li != null) correctIndex = li;
      }
      if (correctIndex == null) throw new Error(`Row ${idx + 2}: missing correct answer.`);
      if (correctIndex >= choices.length) throw new Error(`Row ${idx + 2}: correct points to empty option.`);
      questions.push({
        id: uid("q"),
        prompt,
        choices,
        correctIndex,
        hint: String(obj.hint || obj.clue || "").trim(),
        setName: name,
        subjectId: subjectRef?.subjectId || null,
        subjectName: subjectRef?.subjectName || "",
      });
    });

    if (!questions.length) throw new Error("No valid questions found.");
    return {
      id: uid("set"),
      name,
      csvText,
      delimiter,
      questions,
      quizNames: [],
      totalQuestions: questions.length,
      subjectRef,
      updatedAt: Date.now(),
      lastScore: null,
      lastUsedAt: null,
    };
  }

  function renderCsvHelp() {
    if (els.csvHelp) els.csvHelp.textContent = csvTemplate;
  }

  function renderImportedSelect() {
    els.importedSelect.innerHTML = "";
    state.data.sets.forEach((set) => {
      const opt = document.createElement("option");
      opt.value = set.id;
      opt.textContent = `${set.name} (${set.totalQuestions})`;
      els.importedSelect.appendChild(opt);
    });
  }

  function renderTopics() {
    const container = els.topicSelect;
    if (!container) return;
    container.innerHTML = "";
    state.subjects.forEach((subj) => {
      const wrap = document.createElement("label");
      wrap.className = "topic-pill";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = subj.id;
      input.checked = state.selectedTopicIds.has(subj.id);
      input.addEventListener("change", () => {
        if (input.checked) state.selectedTopicIds.add(subj.id);
        else state.selectedTopicIds.delete(subj.id);
        saveSourceState();
        renderSummary();
      });
      wrap.appendChild(input);
      wrap.append(subj.name || "Subject");
      container.appendChild(wrap);
    });

    if (!state.subjects.length) {
      const msg = document.createElement("div");
      msg.className = "quiz-help";
      msg.textContent = "No topics found. Create subjects on the board to select them here.";
      container.appendChild(msg);
    }

    if (els.importSubjectSelect) {
      const current = els.importSubjectSelect.value;
      els.importSubjectSelect.innerHTML = `<option value="">No link</option>`;
      state.subjects.forEach((subj) => {
        const opt = document.createElement("option");
        opt.value = subj.id;
        opt.textContent = subj.name || "Subject";
        if (current && current === subj.id) opt.selected = true;
        els.importSubjectSelect.appendChild(opt);
      });
      renderImportFiles(els.importSubjectSelect.value || "");
    }
  }

  function renderImportFiles(subjectId) {
    if (!els.importFileSelect) return;
    const files = getFilesForSubject(subjectId);
    const current = els.importFileSelect.value;
    els.importFileSelect.innerHTML = `<option value="">No task</option>`;
    files.forEach((file) => {
      const opt = document.createElement("option");
      opt.value = file.id;
      opt.textContent = file.name || "Task";
      if (current && current === file.id) opt.selected = true;
      els.importFileSelect.appendChild(opt);
    });
  }

  function renderLibraryTopics() {}

  function renderImportedList() {
    const list = els.importedList;
    const left = els.leftSetList;
    if (list) list.innerHTML = "";
    if (left) left.innerHTML = "";
    const term = (els.importedSearch?.value || "").toLowerCase();
    const filtered = state.data.sets.filter((s) => (s.name || "").toLowerCase().includes(term));
    const targets = [list, left].filter(Boolean);
    targets.forEach((target) => {
      if (!filtered.length) {
        const div = document.createElement("div");
        div.className = "empty";
        div.textContent = "No imported sets.";
        target.appendChild(div);
        return;
      }
      filtered.forEach((set) => {
        const card = document.createElement("div");
        card.className = target === left ? "quiz-left-item" : "library-card";
        const row = document.createElement("div");
        row.className = "library-row";
        const title = document.createElement("div");
        title.className = "library-title";
        title.textContent = set.name;
        const meta = document.createElement("div");
        meta.className = "library-meta";
        meta.textContent = `${set.totalQuestions} questions • Updated ${new Date(set.updatedAt || Date.now()).toLocaleDateString()}`;
        row.appendChild(title);
        card.appendChild(row);
        card.appendChild(meta);
        if (target !== left) {
          const actions = document.createElement("div");
          actions.className = "library-actions-row";
          const linkSelect = document.createElement("select");
          linkSelect.className = "quiz-input";
          linkSelect.style.minWidth = "180px";
          linkSelect.innerHTML = `<option value="">No topic link</option>`;
          state.subjects.forEach((subj) => {
            const opt = document.createElement("option");
            opt.value = subj.id;
            opt.textContent = subj.name || "Subject";
            if (set.subjectRef && set.subjectRef.subjectId === subj.id) opt.selected = true;
            linkSelect.appendChild(opt);
          });
          linkSelect.addEventListener("change", () => {
            updateSetSubject(set.id, linkSelect.value || "", "");
            renderLibrarySetsFiles(fileSelect, linkSelect.value || "", set.subjectRef?.fileId || "");
          });
          actions.appendChild(linkSelect);
          const fileSelect = document.createElement("select");
          fileSelect.className = "quiz-input";
          fileSelect.style.minWidth = "160px";
          renderLibrarySetsFiles(fileSelect, set.subjectRef?.subjectId || "", set.subjectRef?.fileId || "");
          fileSelect.addEventListener("change", () => {
            updateSetSubject(set.id, linkSelect.value || "", fileSelect.value || "");
          });
          actions.appendChild(fileSelect);
          const previewBtn = document.createElement("button");
          previewBtn.className = "chip-btn";
          previewBtn.textContent = "Preview";
          previewBtn.addEventListener("click", () => previewSet(set));
          actions.appendChild(previewBtn);
          const renameBtn = document.createElement("button");
          renameBtn.className = "chip-btn";
          renameBtn.textContent = "Rename";
          renameBtn.addEventListener("click", () => renameSet(set.id));
          actions.appendChild(renameBtn);
          const removeBtn = document.createElement("button");
          removeBtn.className = "chip-btn";
          removeBtn.textContent = "Remove";
          removeBtn.addEventListener("click", () => removeSet(set.id));
          actions.appendChild(removeBtn);
          card.appendChild(actions);
        } else {
          card.addEventListener("click", () => {
            selectSet(set.id);
          });
        }
        target.appendChild(card);
      });
    });
  }

  function previewSet(set) {
    const preview = set.questions.slice(0, 3).map((q, idx) => `${idx + 1}) ${q.prompt}`).join("\n");
    alert(`Preview: ${set.name}\n\n${preview}`);
  }

  function selectSet(setId) {
    if (!setId) return;
    els.importedSelect.value = setId;
    const btn = els.sourceBtns.find((b) => b.dataset.source === "imported");
    if (btn) {
      els.sourceBtns.forEach((b) => b.classList.remove("seg-active"));
      btn.classList.add("seg-active");
      state.source = "imported";
    }
    saveSourceState();
    updateSummaryStrip();
  }

  function renameSet(id) {
    const set = state.data.sets.find((s) => s.id === id);
    if (!set) return;
    const next = prompt("Rename set", set.name || "");
    if (next == null) return;
    set.name = next || set.name;
    set.updatedAt = Date.now();
    saveData();
    renderImportedSelect();
    renderImportedList();
    renderSummary();
  }

  function removeSet(id) {
    if (!confirm("Remove this set?")) return;
    state.data.sets = state.data.sets.filter((s) => s.id !== id);
    saveData();
    renderImportedSelect();
    renderImportedList();
    renderSummary();
  }

  function renderSummary() {
    const set = state.data.sets.find((s) => s.id === els.importedSelect?.value);
    const sourceLabel =
      state.source === "imported"
        ? set ? set.name : "No set"
        : state.source === "topics"
          ? `${state.selectedTopicIds.size || 0} topic(s)`
          : state.source === "mixed"
            ? `${set ? set.name + " + " : ""}${state.selectedTopicIds.size} topic(s)`
            : "Weak areas";
    els.summaryMeta.textContent = sourceLabel;
    els.summaryMode.textContent = `${state.mode} • ${state.size} • Q-shuffle ${els.shuffleQuestions.checked ? "on" : "off"} • A-shuffle ${els.shuffleAnswers.checked ? "on" : "off"}`;
  }

  function validateSource() {
    if (state.source === "imported" && !els.importedSelect.value) return false;
    if (state.source === "topics" && !state.selectedTopicIds.size) return false;
    if (state.source === "mixed" && !els.importedSelect.value && !state.selectedTopicIds.size) return false;
    return true;
  }

  function updateSummaryStrip() {
    renderSummary();
    els.startBtn.disabled = !validateSource();
  }

  function calcAvailableQuestions(source) {
    let pool = [];
    const set = state.data.sets.find((s) => s.id === els.importedSelect.value);
    if (source === "imported" && set) pool = set.questions;
    if (source === "topics") {
      const ids = new Set(state.selectedTopicIds);
      state.data.sets.forEach((s) => {
        if (s.subjectRef && ids.has(s.subjectRef.subjectId)) pool.push(...s.questions);
      });
    }
    if (source === "mixed") {
      if (set) pool.push(...set.questions);
      const ids = new Set(state.selectedTopicIds);
      state.data.sets.forEach((s) => {
        if (s.subjectRef && ids.has(s.subjectRef.subjectId)) pool.push(...s.questions);
      });
    }
    if (source === "weak") {
      state.data.sets.forEach((s) => pool.push(...s.questions));
    }
    return pool;
  }

  function pickQuestions(pool) {
    if (!pool.length) return [];
    const size = state.size === "all" ? pool.length : Math.min(Number(state.size), pool.length);
    let ordered = pool.slice();
    if (state.source === "weak" || state.mode === "weak") {
      const weighted = [];
      ordered.forEach((q) => {
        const st = state.stats[q.id] || {};
        const acc = st.timesSeen ? st.timesCorrect / st.timesSeen : 0;
        const confLow = (st.confidenceCounts?.low || 0);
        const weight = (1 - acc) * 2 + confLow * 0.5 + (st.lastAnsweredCorrect ? 0 : 1);
        weighted.push({ q, w: Math.max(0.1, weight) });
      });
      const picked = [];
      for (let i = 0; i < size; i++) {
        const totalW = weighted.reduce((acc, x) => acc + x.w, 0);
        if (!totalW) break;
        let r = Math.random() * totalW;
        let chosen = weighted[0];
        for (const item of weighted) {
          r -= item.w;
          if (r <= 0) {
            chosen = item;
            break;
          }
        }
        picked.push(chosen.q);
      }
      return picked;
    }
    if (els.shuffleQuestions.checked) shuffleArray(ordered);
    return ordered.slice(0, size);
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function startSession(fromQuestions = null) {
    const pool = fromQuestions || calcAvailableQuestions(state.source);
    const questions = fromQuestions ? pool.slice() : pickQuestions(pool);
    if (!questions.length) {
      alert("No questions available for this selection.");
      return;
    }
    const session = {
      id: uid("sess"),
      mode: state.mode,
      source: state.source,
      settings: {
        size: state.size,
        shuffleQuestions: !!els.shuffleQuestions.checked,
        shuffleAnswers: !!els.shuffleAnswers.checked,
        timer: !!els.sessionTimer.checked,
      },
      questions: questions.map((q) => ({
        ...q,
        shuffledAnswers: null,
      })),
      answers: [],
      flagged: new Set(),
      currentIndex: 0,
      startedAt: Date.now(),
      elapsedMs: 0,
    };
    state.session = session;
    saveSessionState();
    renderSession();
    showRunner();
    startTimer();
  }

  function saveSessionState() {
    if (!state.session) {
      localStorage.removeItem(QUIZ_SESSION_KEY);
      return;
    }
    const payload = {
      ...state.session,
      flagged: Array.from(state.session.flagged || []),
    };
    setJSON(QUIZ_SESSION_KEY, payload);
  }

  function loadSessionState() {
    const saved = getJSON(QUIZ_SESSION_KEY, null);
    if (!saved) return;
    saved.flagged = new Set(saved.flagged || []);
    state.session = saved;
    els.resumeHint.hidden = false;
    els.resumeText.textContent = `Progress ${saved.currentIndex}/${saved.questions.length}`;
    els.continueSessionBtn.hidden = false;
    if (state.session.settings?.timer) startTimer();
  }

  function discardResume() {
    state.session = null;
    stopTimer();
    localStorage.removeItem(QUIZ_SESSION_KEY);
    els.resumeHint.hidden = true;
    els.continueSessionBtn.hidden = true;
  }

  function showRunner() {
    els.resultCard?.classList.add("hidden");
    document.getElementById("quizRunner")?.scrollIntoView({ behavior: "smooth" });
  }

  function startTimer() {
    if (state.timerHandle) clearInterval(state.timerHandle);
    if (!state.session || !state.session.settings.timer) {
      els.runTimer.textContent = "00:00";
      return;
    }
    const base = state.session.startedAt || Date.now();
    state.timerHandle = setInterval(() => {
      const now = Date.now();
      const elapsed = now - base;
      els.runTimer.textContent = formatMs(elapsed);
    }, 1000);
  }

  function stopTimer() {
    if (state.timerHandle) clearInterval(state.timerHandle);
    state.timerHandle = null;
  }

  function renderSession() {
    const s = state.session;
    if (!s) return;
    const q = s.questions[s.currentIndex];
    if (!q) return;
    els.runTitle.textContent = q.setName || "Session";
    els.runMeta.textContent = `${s.currentIndex + 1}/${s.questions.length}`;
    els.qCounter.textContent = `Question ${s.currentIndex + 1} of ${s.questions.length}`;
    els.questionText.textContent = q.prompt;
    els.feedback.textContent = "";
    els.confidenceRow.classList.add("hidden");
    els.choices.innerHTML = "";
    const answer = s.answers[s.currentIndex];
    let displayChoices = q.choices.map((text, idx) => ({ text, idx }));
    if (s.settings.shuffleAnswers) {
      if (answer && answer.shuffled) displayChoices = answer.shuffled;
      else {
        const copy = displayChoices.slice();
        shuffleArray(copy);
        displayChoices = copy;
        if (answer) answer.shuffled = displayChoices;
      }
    }
    displayChoices.forEach((choice, displayIdx) => {
      const btn = document.createElement("button");
      btn.className = "quiz-choice";
      btn.type = "button";
      btn.dataset.displayIdx = String(displayIdx);
      btn.textContent = choice.text;
      if (answer && answer.selected != null) {
        const correctDisplay = displayChoices.findIndex((c) => c.idx === q.correctIndex);
        if (displayIdx === correctDisplay) btn.classList.add("correct");
        if (displayIdx === answer.selected && displayIdx !== correctDisplay) btn.classList.add("wrong");
        btn.disabled = true;
      } else {
        btn.addEventListener("click", () => selectAnswer(displayIdx));
      }
      els.choices.appendChild(btn);
    });
    updateProgress();
    updateNavButtons();
    updateFlagUi();
    renderSessionSummaryStrip();
  }

  function updateProgress() {
    const s = state.session;
    if (!s) return;
    const pct = Math.round((s.currentIndex / s.questions.length) * 100);
    els.progressBar.style.width = `${pct}%`;
  }

  function updateNavButtons() {
    const s = state.session;
    if (!s) return;
    els.prevBtn.disabled = s.currentIndex === 0;
    const ans = s.answers[s.currentIndex];
    els.nextBtn.disabled = !ans;
  }

  function updateFlagUi() {
    const s = state.session;
    if (!s) return;
    const flagged = s.flagged.has(s.questions[s.currentIndex].id);
    els.flagBtn.classList.toggle("chip-btn-primary", flagged);
    els.flagBtn.textContent = flagged ? "Flagged" : "Flag";
  }

  function selectAnswer(displayIdx) {
    const s = state.session;
    if (!s) return;
    const q = s.questions[s.currentIndex];
    let displayChoices = q.choices.map((text, idx) => ({ text, idx }));
    if (s.settings.shuffleAnswers && s.answers[s.currentIndex]?.shuffled) {
      displayChoices = s.answers[s.currentIndex].shuffled;
    } else if (s.settings.shuffleAnswers) {
      shuffleArray(displayChoices);
    }
    const selectedOriginal = displayChoices[displayIdx].idx;
    const correctDisplay = displayChoices.findIndex((c) => c.idx === q.correctIndex);
    const isCorrect = selectedOriginal === q.correctIndex;
    s.answers[s.currentIndex] = {
      selected: displayIdx,
      correctDisplay,
      isCorrect,
      shuffled: s.settings.shuffleAnswers ? displayChoices : null,
      answeredAt: Date.now(),
    };
    if (s.mode === "study") {
      els.feedback.textContent = isCorrect ? "Correct." : "Incorrect.";
      els.confidenceRow.classList.remove("hidden");
    } else {
      els.feedback.textContent = "";
    }
    els.choices.querySelectorAll(".quiz-choice").forEach((btn) => {
      btn.disabled = true;
      const di = Number(btn.dataset.displayIdx);
      if (di === correctDisplay) btn.classList.add("correct");
      if (di === displayIdx && di !== correctDisplay) btn.classList.add("wrong");
    });
    updateNavButtons();
    saveSessionState();
  }

  function goNext() {
    const s = state.session;
    if (!s) return;
    if (s.currentIndex < s.questions.length - 1) {
      s.currentIndex += 1;
      saveSessionState();
      renderSession();
    } else {
      finishSession();
    }
  }

  function goPrev() {
    const s = state.session;
    if (!s) return;
    if (s.currentIndex > 0) {
      s.currentIndex -= 1;
      saveSessionState();
      renderSession();
    }
  }

  function finishSession() {
    const s = state.session;
    if (!s) return;
    const end = Date.now();
    stopTimer();
    const elapsedMs = end - s.startedAt;
    const total = s.questions.length;
    const correct = s.answers.filter((a) => a && a.isCorrect).length;
    const incorrectIds = [];
    const flaggedIds = Array.from(s.flagged || []);
    s.questions.forEach((q, idx) => {
      const ans = s.answers[idx];
      if (!ans || !ans.isCorrect) incorrectIds.push(q.id);
      updateStats(q, ans, end - (ans?.answeredAt || end));
    });
    saveStats();
    s.completedAt = end;
    s.elapsedMs = elapsedMs;
    s.result = {
      accuracy: total ? Math.round((correct * 100) / total) : 0,
      total,
      correct,
      incorrectIds,
      flaggedIds,
    };
    renderResults();
    saveSessionState();
    state.data.sets.forEach((set) => {
      if (s.questions.find((q) => q.setName === set.name)) {
        set.lastUsedAt = end;
        set.lastScore = s.result.accuracy;
      }
    });
    saveData();
    renderLibraryTopics();
  }

  function updateStats(question, answer, timeMs) {
    if (!question) return;
    const st = state.stats[question.id] || {
      timesSeen: 0,
      timesCorrect: 0,
      lastSeenAt: 0,
      confidenceCounts: { low: 0, med: 0, high: 0 },
    };
    st.timesSeen += 1;
    if (answer && answer.isCorrect) st.timesCorrect += 1;
    st.lastSeenAt = Date.now();
    st.lastAnsweredCorrect = !!(answer && answer.isCorrect);
    const t = Number(timeMs) || 0;
    if (t > 0) {
      const prevTotal = st.avgTimeMs ? st.avgTimeMs * (st.timesSeen - 1) : 0;
      st.avgTimeMs = Math.round((prevTotal + t) / st.timesSeen);
    }
    if (answer && answer.confidence) {
      st.confidenceCounts[answer.confidence] = (st.confidenceCounts[answer.confidence] || 0) + 1;
      st.lastConfidence = answer.confidence;
    }
    state.stats[question.id] = st;
  }

  function renderResults() {
    const s = state.session;
    if (!s || !s.result) return;
    els.resultCard.classList.remove("hidden");
    els.resultSummary.textContent = `${s.result.correct}/${s.result.total} correct · ${s.result.accuracy}%`;
    els.metricAccuracy.textContent = `${s.result.accuracy}%`;
    els.metricTime.textContent = formatDuration(s.elapsedMs || 0);
    const avg = s.result.total ? Math.round((s.elapsedMs || 0) / s.result.total) : 0;
    els.metricAvg.textContent = `${Math.round(avg / 1000)}s`;
    renderWeakAreas();
    renderReviewList();
    discardResume();
  }

  function renderWeakAreas() {
    const list = els.weakAreasList;
    if (!list) return;
    list.innerHTML = "";
    const bySubject = {};
    state.session.questions.forEach((q, idx) => {
      const subj = q.subjectName || "General";
      const key = subj;
      if (!bySubject[key]) bySubject[key] = { total: 0, incorrect: 0 };
      bySubject[key].total += 1;
      if (!state.session.answers[idx]?.isCorrect) bySubject[key].incorrect += 1;
    });
    const items = Object.entries(bySubject).map(([name, data]) => ({
      name,
      acc: data.total ? Math.round(((data.total - data.incorrect) * 100) / data.total) : 0,
    }));
    items.sort((a, b) => a.acc - b.acc);
    const top = items.slice(0, 3);
    if (!top.length) {
      const div = document.createElement("div");
      div.className = "quiz-help";
      div.textContent = "No weak areas yet.";
      list.appendChild(div);
      return;
    }
    top.forEach((item) => {
      const row = document.createElement("div");
      row.className = "weak-row";
      row.textContent = `${item.name}: ${item.acc}% accuracy`;
      list.appendChild(row);
    });
  }

  function renderReviewList() {
    els.reviewList.innerHTML = "";
    const wrong = [];
    state.session.questions.forEach((q, idx) => {
      const ans = state.session.answers[idx];
      if (!ans || !ans.isCorrect) {
        const choices = ans?.shuffled || q.choices.map((text, idx) => ({ text, idx }));
        const correctDisplay = choices.findIndex((c) => c.idx === q.correctIndex);
        const correctText = choices[correctDisplay]?.text || q.choices[q.correctIndex];
        const selectedText =
          ans && ans.selected != null ? choices[ans.selected]?.text || "(none)" : "(none)";
        wrong.push({ q, correctText, selectedText });
      }
    });
    if (!wrong.length) {
      els.reviewList.innerHTML = `<p class="quiz-help">All correct. Great job.</p>`;
      return;
    }
    wrong.forEach((w) => {
      const div = document.createElement("div");
      div.className = "quiz-review-item";
      div.innerHTML = `
        <strong>${w.q.prompt}</strong>
        <div class="line">Your answer: ${w.selectedText}</div>
        <div class="line">Correct: ${w.correctText}</div>
        ${w.q.hint ? `<div class="line">Hint: ${w.q.hint}</div>` : ""}
      `;
      els.reviewList.appendChild(div);
    });
  }

  function startIncorrectReview() {
    if (!state.session || !state.session.result) return;
    const ids = state.session.result.incorrectIds;
    if (!ids.length) return;
    const questions = state.session.questions.filter((q) => ids.includes(q.id));
    startSession(questions);
  }

  function startFlaggedRetry() {
    if (!state.session) return;
    const ids = Array.from(state.session.flagged || []);
    if (!ids.length) return;
    const questions = state.session.questions.filter((q) => ids.includes(q.id));
    startSession(questions);
  }

  function toggleFlag() {
    const s = state.session;
    if (!s) return;
    const q = s.questions[s.currentIndex];
    if (s.flagged.has(q.id)) s.flagged.delete(q.id);
    else s.flagged.add(q.id);
    saveSessionState();
    updateFlagUi();
  }

  function applyConfidence(conf) {
    const s = state.session;
    if (!s || s.mode !== "study") return;
    const ans = s.answers[s.currentIndex];
    if (!ans) return;
    ans.confidence = conf;
    saveSessionState();
    els.confidenceRow.classList.add("hidden");
  }

  function handleShortcut(ev) {
    if (!state.session) return;
    const activeElement = document.activeElement;
    const isInput =
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.tagName === "SELECT");
    if (isInput) return;
    if (ev.key >= "1" && ev.key <= "4") {
      const idx = Number(ev.key) - 1;
      const btn = els.choices.querySelector(`.quiz-choice[data-display-idx="${idx}"]`);
      if (btn && !btn.disabled) btn.click();
    }
    if (ev.key === "Enter") {
      if (!els.nextBtn.disabled) goNext();
    }
    if (ev.key.toLowerCase() === "f") {
      toggleFlag();
    }
    if (ev.key === "Escape") {
      alert("Shortcuts: 1-4 answer, Enter next, F flag, Esc help.");
    }
  }

  function attachEvents() {
    els.sourceBtns.forEach((btn) =>
      btn.addEventListener("click", () => {
        els.sourceBtns.forEach((b) => b.classList.remove("seg-active"));
        btn.classList.add("seg-active");
        state.source = btn.dataset.source;
        saveSourceState();
        updateSummaryStrip();
      })
    );
    els.modeBtns.forEach((btn) =>
      btn.addEventListener("click", () => {
        els.modeBtns.forEach((b) => b.classList.remove("seg-active"));
        btn.classList.add("seg-active");
        state.mode = btn.dataset.mode;
        saveSourceState();
        updateSummaryStrip();
      })
    );
    els.sizeBtns.forEach((btn) =>
      btn.addEventListener("click", () => {
        els.sizeBtns.forEach((b) => b.classList.remove("seg-active"));
        btn.classList.add("seg-active");
        state.size = btn.dataset.size;
        saveSourceState();
        updateSummaryStrip();
      })
    );
    ["shuffleQuestions", "shuffleAnswers", "sessionTimer"].forEach((key) => {
      els[key]?.addEventListener("change", () => updateSummaryStrip());
    });
    els.importedSelect.addEventListener("change", () => {
      saveSourceState();
      updateSummaryStrip();
    });
    els.startBtn.addEventListener("click", () => startSession());
    els.prevBtn.addEventListener("click", goPrev);
    els.nextBtn.addEventListener("click", goNext);
    els.finishBtn.addEventListener("click", finishSession);
    els.flagBtn.addEventListener("click", toggleFlag);
    els.resumeBtn?.addEventListener("click", () => {
      renderSession();
      showRunner();
    });
    els.discardResumeBtn?.addEventListener("click", discardResume);
    els.continueSessionBtn?.addEventListener("click", () => {
      renderSession();
      showRunner();
    });
    els.reviewIncorrectBtn?.addEventListener("click", startIncorrectReview);
    els.retryFlaggedBtn?.addEventListener("click", startFlaggedRetry);
    els.newSessionBtn?.addEventListener("click", () => {
      els.resultCard.classList.add("hidden");
      document.getElementById("sessionBuilder")?.scrollIntoView({ behavior: "smooth" });
    });
    els.pickCsvBtn?.addEventListener("click", () => els.csvFile?.click());
    els.csvFile?.addEventListener("change", handleCsvInput);
    els.csvDropzone?.addEventListener("dragover", (e) => {
      e.preventDefault();
      els.csvDropzone.classList.add("dragover");
    });
    els.csvDropzone?.addEventListener("dragleave", () => {
      els.csvDropzone.classList.remove("dragover");
    });
    els.csvDropzone?.addEventListener("drop", (e) => {
      e.preventDefault();
      els.csvDropzone.classList.remove("dragover");
      const file = e.dataTransfer?.files?.[0];
      if (file) handleCsvFile(file);
    });
    els.csvDropzone?.addEventListener("click", () => {
      if (!els.csvFile) return;
      els.csvFile.value = "";
      els.csvFile.click();
    });
    els.importedSearch?.addEventListener("input", renderImportedList);
    els.topicSearch?.addEventListener("input", renderLibraryTopics);
    els.topicSort?.addEventListener("change", renderLibraryTopics);
    const openImportPanel = () => {
      if (els.importPanel) {
        els.importPanel.setAttribute("open", "open");
        els.importPanel.classList.add("import-highlight");
        setTimeout(() => els.importPanel.classList.remove("import-highlight"), 900);
        els.importPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (els.pickCsvBtn) els.pickCsvBtn.focus();
      if (els.csvFile) {
        els.csvFile.value = "";
      }
    };
    els.openImportBtn?.addEventListener("click", openImportPanel);
    els.openImportBtn2?.addEventListener("click", (e) => {
      e.preventDefault();
      openImportPanel();
    });
    els.importSubjectSelect?.addEventListener("change", () => {
      renderImportFiles(els.importSubjectSelect.value || "");
      if (!els.importSubjectSelect.value && els.importFileSelect) els.importFileSelect.value = "";
    });
    els.confidenceBtns.forEach((btn) => {
      btn.addEventListener("click", () => applyConfidence(btn.dataset.conf));
    });
    document.addEventListener("keydown", handleShortcut);
  }

  function handleCsvInput(e) {
    const file = e.target?.files && e.target.files[0];
    if (!file) {
      setStatus("No file selected", "error");
      return;
    }
    handleCsvFile(file);
    // Allow selecting the same file again later
    if (els.csvFile) els.csvFile.value = "";
  }

  async function handleCsvFile(file) {
    try {
      setStatus(`Importing ${file.name}…`, "info");
      const text = await file.text();
      const set = parseCsvToSet(text, file.name.replace(/\.[^/.]+$/, ""), {
        subjectRef: getImportSubjectRef(),
      });
      addSet(set);
      setStatus(`Imported ${set.name} (${set.totalQuestions} questions).`, "ok");
      renderPreview(set);
      await saveRemoteQuizSet({
        name: set.name,
        csvText: set.csvText,
        quizNames: set.quizNames,
        totalQuestions: set.totalQuestions,
        subjectRef: set.subjectRef,
      });
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Import failed", "error");
    }
  }

  function addSet(set) {
    replaceDuplicates(set);
    state.data.sets.unshift(set);
    saveData();
    computeSubjectMetrics();
    renderImportedSelect();
    renderImportedList();
    renderLibraryTopics();
    updateSummaryStrip();
  }

  function getImportSubjectRef() {
    const id = els.importSubjectSelect?.value || "";
    const fileId = els.importFileSelect?.value || "";
    if (!id) return null;
    const subj = state.subjects.find((s) => s.id === id);
    const file = getFilesForSubject(id).find((f) => f.id === fileId);
    return {
      subjectId: id,
      subjectName: subj?.name || "",
      fileId: file ? file.id : null,
      fileName: file ? file.name || "" : "",
    };
  }

  function updateSetSubject(setId, subjectId, fileId = "") {
    const set = state.data.sets.find((s) => s.id === setId);
    if (!set) return;
    if (!subjectId) {
      set.subjectRef = null;
    } else {
      const subj = state.subjects.find((s) => s.id === subjectId);
      const file = getFilesForSubject(subjectId).find((f) => f.id === fileId);
      set.subjectRef = {
        subjectId,
        subjectName: subj?.name || "",
        fileId: file ? file.id : null,
        fileName: file ? file.name || "",
      };
    }
    set.updatedAt = Date.now();
    saveData();
    computeSubjectMetrics();
    renderImportedList();
    renderLibraryTopics();
    renderSummary();
  }

  function renderLibrarySetsFiles(selectEl, subjectId, selectedFileId) {
    if (!selectEl) return;
    const files = getFilesForSubject(subjectId);
    selectEl.innerHTML = `<option value="">No task</option>`;
    files.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.name || "Task";
      if (selectedFileId && selectedFileId === f.id) opt.selected = true;
      selectEl.appendChild(opt);
    });
  }

  function replaceDuplicates(nextSet) {
    state.data.sets = state.data.sets.filter((s) => {
      if (s.id === nextSet.id) return false;
      const sameCsv = s.csvText && nextSet.csvText && s.csvText === nextSet.csvText;
      const sameNameCount = s.name === nextSet.name && s.totalQuestions === nextSet.totalQuestions;
      return !(sameCsv || sameNameCount);
    });
  }

  function dedupeSets() {
    const seen = [];
    const unique = [];
    state.data.sets.forEach((set) => {
      const key = set.csvText ? `csv:${set.csvText.length}:${set.name}` : `name:${set.name}:${set.totalQuestions}`;
      if (seen.includes(key)) return;
      seen.push(key);
      unique.push(set);
    });
    state.data.sets = unique;
  }

  function renderPreview(set) {
    els.previewList.innerHTML = "";
    set.questions.slice(0, 3).forEach((q, idx) => {
      const div = document.createElement("div");
      div.className = "preview-item";
      div.innerHTML = `<strong>${idx + 1}) ${q.prompt}</strong><div>${q.choices.join(" · ")}</div>`;
      els.previewList.appendChild(div);
    });
  }

  async function init() {
    renderCsvHelp();
    loadSubjects();
    loadData();
    renderImportedSelect();
    renderTopics();
    renderImportedList();
    updateSummaryStrip();
    loadSessionState();
    attachEvents();
    const remoteLoaded = await loadRemoteQuizSet();
    if (remoteLoaded) {
      renderImportedSelect();
      renderImportedList();
      updateSummaryStrip();
    }
  }

  init();
})();
