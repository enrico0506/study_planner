(() => {
  const els = {
    csvFile: document.getElementById("csvFile"),
    quizSelect: document.getElementById("quizSelect"),
    startBtn: document.getElementById("startBtn"),
    resetBtn: document.getElementById("resetBtn"),
    importStatus: document.getElementById("importStatus"),
    shuffleQuestions: document.getElementById("shuffleQuestions"),
    shuffleAnswers: document.getElementById("shuffleAnswers"),
    importCard: document.getElementById("importCard"),
    quizCard: document.getElementById("quizCard"),
    resultCard: document.getElementById("resultCard"),
    quizTitle: document.getElementById("quizTitle"),
    quizMeta: document.getElementById("quizMeta"),
    scoreText: document.getElementById("scoreText"),
    progressBar: document.getElementById("progressBar"),
    qCounter: document.getElementById("qCounter"),
    questionText: document.getElementById("questionText"),
    hintBtn: document.getElementById("hintBtn"),
    hintText: document.getElementById("hintText"),
    choices: document.getElementById("choices"),
    feedback: document.getElementById("feedback"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    finishBtn: document.getElementById("finishBtn"),
    resultSummary: document.getElementById("resultSummary"),
    reviewList: document.getElementById("reviewList"),
    restartBtn: document.getElementById("restartBtn"),
    backToImportBtn: document.getElementById("backToImportBtn"),
    toggleSubjectsBtn: document.getElementById("toggleSubjectsBtn"),
    quizSubjectsBody: document.getElementById("quizSubjectsBody"),
    quizSubjectsEmpty: document.getElementById("quizSubjectsEmpty"),
    quizSubjectTable: document.getElementById("quizSubjectTable"),
  };

  if (!els.csvFile || !els.quizCard) return;

  const QUIZ_STORAGE_KEY = "studyQuizSavedCsv_v1";
  const SUBJECTS_KEY = "studySubjects_v1";
  const SUBJECT_VIS_KEY = "studyQuizSubjectsVisible_v1";
  const COLOR_PALETTE_KEY = "studyColorPalette_v1";
  const DEFAULT_SUBJECT_COLORS = [
    "#4f8bff",
    "#4ec58a",
    "#f77fb3",
    "#f6a23c",
    "#b18bff",
    "#37c6c0",
    "#f17575",
    "#f4c74f",
  ];
  const STORAGE = (window.StudyPlanner && window.StudyPlanner.Storage) || null;

  let bank = {};
  let currentQuizName = "";
  let questions = [];
  let idx = 0;
  let answers = [];
  let score = 0;
  let pendingImportTarget = null; // { subjectId, fileId, subjectName, fileName }
  let currentSubjectRef = null; // { subjectId, fileId, subjectName, fileName }
  let activeSessionStartMs = null;

  const hiddenCsvInput = document.createElement("input");
  hiddenCsvInput.type = "file";
  hiddenCsvInput.accept = ".csv,text/csv";
  hiddenCsvInput.style.display = "none";
  document.body.appendChild(hiddenCsvInput);

  function setStatus(msg, type = "info") {
    const palette = {
      info: {
        border: "var(--border-subtle)",
        bg: "rgba(255, 255, 255, 0.8)",
        color: "var(--ink-muted)",
      },
      ok: {
        border: "#22c55e",
        bg: "color-mix(in srgb, #22c55e 10%, #ecfdf3)",
        color: "#166534",
      },
      error: {
        border: "#ef4444",
        bg: "color-mix(in srgb, #ef4444 10%, #fff1f2)",
        color: "#991b1b",
      },
    };
    const style = palette[type] || palette.info;
    els.importStatus.textContent = msg;
    els.importStatus.style.borderColor = style.border;
    els.importStatus.style.background = style.bg;
    els.importStatus.style.color = style.color;
  }

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
      if (res.status === 401) return false;
      if (!res.ok) {
        console.warn("Quiz save failed", await res.text());
        return false;
      }
      return true;
    } catch (err) {
      console.warn("Quiz save failed", err);
      return false;
    }
  }

  async function loadRemoteQuizSet() {
    try {
      const res = await fetch("/api/quiz-sets/latest");
      if (res.status === 401) return false;
      if (!res.ok) return false;
      const data = await res.json();
      if (!data || !data.quizSet || !data.quizSet.csvText) return false;
      const subjectRef =
        data.quizSet.subjectId || data.quizSet.fileId
          ? {
              subjectId: data.quizSet.subjectId || null,
              fileId: data.quizSet.fileId || null,
              subjectName: data.quizSet.subjectName || "",
              fileName: data.quizSet.fileName || "",
            }
          : null;
      const built = buildQuestionBank(data.quizSet.csvText);
      applyImportResult(built, {
        fileName: data.quizSet.name || "Saved quiz",
        sourceText: data.quizSet.csvText,
        fromSaved: true,
        subjectRef,
      });
      return true;
    } catch (err) {
      console.warn("Quiz load failed", err);
      return false;
    }
  }

  function normalizeHeader(h) {
    return String(h || "").trim().toLowerCase().replace(/\s+/g, "_");
  }

  function stripBOM(s) {
    if (!s) return s;
    return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
  }

  function countDelimiterOutsideQuotes(line, delim) {
    let inQuotes = false;
    let count = 0;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') i++;
        else inQuotes = !inQuotes;
      } else if (!inQuotes && ch === delim) {
        count++;
      }
    }
    return count;
  }

  function detectDelimiter(firstLine) {
    const candidates = [";", ",", "\t"];
    const counts = candidates.map((d) => countDelimiterOutsideQuotes(firstLine, d));
    let best = 0;
    for (let i = 1; i < candidates.length; i++) if (counts[i] > counts[best]) best = i;
    return candidates[best];
  }

  function parseCSV(text) {
    const raw = stripBOM(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
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

  function toIntOrNull(x) {
    const n = Number(String(x).trim());
    return Number.isFinite(n) ? n : null;
  }

  function letterToIndex(letter) {
    const map = { A: 0, B: 1, C: 2, D: 3 };
    const L = String(letter || "").trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(map, L) ? map[L] : null;
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[c]));
  }

  function buildQuestionBank(csvText) {
    const { rows, delimiter } = parseCSV(csvText);
    if (rows.length < 2) throw new Error("CSV needs a header and at least one question.");

    const header = rows[0].map(normalizeHeader);
    const dataRows = rows.slice(1);

    const get = (obj, ...keys) => {
      for (const k of keys) if (obj[k] != null && String(obj[k]).trim() !== "") return obj[k];
      return "";
    };

    const bankLocal = {};

    for (let r = 0; r < dataRows.length; r++) {
      const row = dataRows[r];
      const obj = {};
      for (let c = 0; c < header.length; c++) obj[header[c]] = row[c] ?? "";

      const quizName = String(get(obj, "quiz", "quiz_name", "set", "set_name") || "Standard").trim() || "Standard";
      const question = String(get(obj, "question", "frage", "prompt", "q")).trim();

      const a = String(get(obj, "choice_a", "a", "antwort_a")).trim();
      const b = String(get(obj, "choice_b", "b", "antwort_b")).trim();
      const c = String(get(obj, "choice_c", "c", "antwort_c")).trim();
      const d = String(get(obj, "choice_d", "d", "antwort_d")).trim();

      const hint = String(get(obj, "hint", "hinweis", "clue", "tip")).trim();

      let correctIndex = null;

      const ciRaw = get(obj, "correct_index", "korrekt_index");
      if (String(ciRaw).trim() !== "") {
        const n = toIntOrNull(ciRaw);
        if (n !== null) correctIndex = n;
      }
      if (correctIndex === null) {
        const cl = get(obj, "correct_letter", "korrekt_buchstabe");
        const li = letterToIndex(cl);
        if (li !== null) correctIndex = li;
      }
      if (correctIndex === null) {
        const ct = String(get(obj, "correct_text", "korrekt_text")).trim();
        if (ct) {
          const choices = [a, b, c, d];
          const found = choices.findIndex((x) => String(x).trim() === ct);
          if (found >= 0) correctIndex = found;
        }
      }

      const rawChoices = [a, b, c, d];
      const presentChoices = rawChoices.map((t, i) => ({ t, i })).filter((x) => x.t.trim() !== "");

      if (!question) continue;
      if (presentChoices.length < 2) throw new Error(`Row ${r + 2}: Question has fewer than 2 answer options.`);
      if (correctIndex === null) throw new Error(`Row ${r + 2}: Missing correct answer (correct_index, correct_letter, or correct_text).`);

      const mappedCorrectPos = presentChoices.findIndex((x) => x.i === correctIndex);
      if (mappedCorrectPos < 0) throw new Error(`Row ${r + 2}: Correct answer points to an empty option.`);

      const q = {
        quiz: quizName,
        question,
        hint,
        choices: presentChoices.map((x) => x.t),
        correctIndex: mappedCorrectPos,
      };
      if (!bankLocal[quizName]) bankLocal[quizName] = [];
      bankLocal[quizName].push(q);
    }

    const quizNames = Object.keys(bankLocal);
    if (quizNames.length === 0) throw new Error("No valid questions found. Check headers and columns.");
    quizNames.sort((x, y) => x.localeCompare(y, "de"));
    return { bank: bankLocal, quizNames, delimiter };
  }

  function persistSavedImport(data) {
    setJSON(QUIZ_STORAGE_KEY, {
      name: data.name || "Saved CSV",
      text: data.text || "",
      delimiter: data.delimiter || ";",
      quizNames: data.quizNames || [],
      totalQuestions: data.totalQuestions || 0,
      savedAt: Date.now(),
    });
  }

  function applyImportResult(
    built,
    { fileName = "CSV import", sourceText = null, fromSaved = false, subjectRef = null } = {}
  ) {
    bank = built.bank;
    currentSubjectRef = subjectRef || null;

    els.quizSelect.innerHTML = "";
    built.quizNames.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      els.quizSelect.appendChild(opt);
    });

    els.quizSelect.disabled = false;
    els.startBtn.disabled = false;
    els.resetBtn.disabled = false;

    const totalQuestions = Object.values(bank).reduce((acc, arr) => acc + arr.length, 0);
    const delimText = built.delimiter === "\t" ? "\\t" : built.delimiter;
    const prefix = fromSaved ? "Restored saved import" : "Import successful";
    const linkNote = subjectRef ? ` Linked to ${subjectRef.subjectName || "subject"} — ${subjectRef.fileName || "task"}.` : "";
    setStatus(
      `${prefix}: ${built.quizNames.length} set(s), ${totalQuestions} question(s). Delimiter: "${delimText}". Source: ${fileName || "CSV"}.${linkNote}`,
      "ok"
    );

    if (sourceText && !fromSaved) {
      persistSavedImport({
        name: fileName,
        text: sourceText,
        delimiter: built.delimiter,
        quizNames: built.quizNames,
        totalQuestions,
        subjectRef,
      });
      void saveRemoteQuizSet({
        name: fileName,
        csvText: sourceText,
        quizNames: built.quizNames,
        totalQuestions,
        subjectRef,
      });
    }
  }

  function restoreSavedImport() {
    const saved = getJSON(QUIZ_STORAGE_KEY, null);
    if (!saved || !saved.text) return false;
    try {
      const built = buildQuestionBank(saved.text);
      applyImportResult(built, {
        fileName: saved.name || "Saved CSV",
        fromSaved: true,
        subjectRef: saved.subjectRef || null,
      });
      return true;
    } catch (err) {
      console.error(err);
      setStatus(`Saved import could not be loaded. Please re-import. (${err.message})`, "error");
      return false;
    }
  }

  function showImport() {
    els.importCard.classList.remove("hidden");
    els.quizCard.classList.add("hidden");
    els.resultCard.classList.add("hidden");
  }

  function showQuiz() {
    els.importCard.classList.add("hidden");
    els.quizCard.classList.remove("hidden");
    els.resultCard.classList.add("hidden");
  }

  function showResults() {
    els.importCard.classList.add("hidden");
    els.quizCard.classList.add("hidden");
    els.resultCard.classList.remove("hidden");
  }

  function resetAll() {
    bank = {};
    currentQuizName = "";
    questions = [];
    answers = [];
    idx = 0;
    score = 0;
    currentSubjectRef = null;
    activeSessionStartMs = null;
    els.quizSelect.innerHTML = `<option value="">Import first…</option>`;
    els.quizSelect.disabled = true;
    els.startBtn.disabled = true;
    els.resetBtn.disabled = true;
    els.csvFile.value = "";
    setStatus("Ready. Import a CSV to begin.", "info");
    showImport();
  }

  function renderQuestion() {
    const q = questions[idx];
    const a = answers[idx];

    els.quizTitle.textContent = currentQuizName;
    els.quizMeta.textContent = `${questions.length} question${questions.length === 1 ? "" : "s"}`;
    els.qCounter.textContent = `Question ${idx + 1} / ${questions.length}`;
    els.questionText.textContent = q.question;

    const hasHint = !!(q.hint && q.hint.trim());
    els.hintBtn.disabled = !hasHint;
    els.hintText.textContent = hasHint ? q.hint : "";
    els.hintText.classList.add("hidden");

    els.progressBar.style.width = `${Math.round((idx / questions.length) * 100)}%`;
    els.scoreText.textContent = `${score} / ${questions.length}`;

    els.prevBtn.disabled = idx === 0;
    els.nextBtn.disabled = true;
    els.feedback.textContent = "";
    els.choices.innerHTML = "";

    let displayChoices = q.choices.map((text, originalIndex) => ({ text, originalIndex }));
    let map = displayChoices.map((x) => x.originalIndex);

    if (els.shuffleAnswers.checked) {
      if (a && Array.isArray(a.shuffledMap)) {
        map = a.shuffledMap.slice();
        displayChoices = map.map((originalIndex) => ({ text: q.choices[originalIndex], originalIndex }));
      } else {
        const indices = q.choices.map((_, i) => i);
        shuffleArray(indices);
        map = indices;
        displayChoices = map.map((originalIndex) => ({ text: q.choices[originalIndex], originalIndex }));
        if (a) a.shuffledMap = map.slice();
      }
    } else if (a) {
      a.shuffledMap = null;
    }

    displayChoices.forEach((cObj, displayIndex) => {
      const btn = document.createElement("button");
      btn.className = "quiz-choice";
      btn.type = "button";
      btn.dataset.displayIndex = String(displayIndex);
      btn.textContent = cObj.text;

      if (a && a.selectedDisplayIndex != null) {
        const isCorrect = displayIndex === a.correctDisplayIndex;
        const isSelected = displayIndex === a.selectedDisplayIndex;
        if (isCorrect) btn.classList.add("correct");
        if (isSelected && !isCorrect) btn.classList.add("wrong");
        btn.disabled = true;
        els.nextBtn.disabled = false;
        els.feedback.textContent = a.isCorrect ? "Correct." : "Incorrect.";
        els.progressBar.style.width = `${Math.round(((idx + 1) / questions.length) * 100)}%`;
      } else {
        btn.addEventListener("click", () => selectAnswer(displayIndex, map, q));
      }
      els.choices.appendChild(btn);
    });
  }

  function selectAnswer(selectedDisplayIndex, map, q) {
    const selectedOriginal = map[selectedDisplayIndex];
    const correctOriginal = q.correctIndex;
    const correctDisplayIndex = map.findIndex((originalIndex) => originalIndex === correctOriginal);
    const isCorrect = selectedOriginal === correctOriginal;

    answers[idx] = {
      selectedDisplayIndex,
      correctDisplayIndex,
      isCorrect,
      shuffledMap: els.shuffleAnswers.checked ? map.slice() : null,
    };
    if (isCorrect) score++;

    els.choices.querySelectorAll(".quiz-choice").forEach((btn) => {
      btn.disabled = true;
      const di = Number(btn.dataset.displayIndex);
      if (di === correctDisplayIndex) btn.classList.add("correct");
      if (di === selectedDisplayIndex && di !== correctDisplayIndex) btn.classList.add("wrong");
    });

    els.feedback.textContent = isCorrect ? "Correct." : "Incorrect.";
    els.nextBtn.disabled = false;
    els.scoreText.textContent = `${score} / ${questions.length}`;
    els.progressBar.style.width = `${Math.round(((idx + 1) / questions.length) * 100)}%`;
  }

  function startQuiz() {
    currentQuizName = els.quizSelect.value || Object.keys(bank)[0];
    questions = (bank[currentQuizName] || []).slice();
    if (els.shuffleQuestions.checked) shuffleArray(questions);

    idx = 0;
    score = 0;
    activeSessionStartMs = Date.now();
    answers = questions.map(() => ({
      selectedDisplayIndex: null,
      correctDisplayIndex: null,
      isCorrect: null,
      shuffledMap: null,
    }));

    showQuiz();
    renderQuestion();
  }

  function finishQuiz() {
    const total = questions.length;
    const pct = total ? Math.round((score / total) * 100) : 0;
    els.resultSummary.textContent = `You answered ${score} of ${total} correctly (${pct}%).`;

    recordQuizSession();

    els.reviewList.innerHTML = "";
    const wrong = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const a = answers[i];
      if (!a || a.isCorrect === true) continue;

      const map = Array.isArray(a.shuffledMap) ? a.shuffledMap : q.choices.map((_, j) => j);
      const correctDisplayIndex = a.correctDisplayIndex ?? map.findIndex((x) => x === q.correctIndex);
      const selectedDisplayIndex = a.selectedDisplayIndex;

      const correctText = q.choices[map[correctDisplayIndex]];
      const selectedText = selectedDisplayIndex == null ? "(no answer)" : q.choices[map[selectedDisplayIndex]];
      wrong.push({ i, q, selectedText, correctText });
    }

    if (wrong.length === 0) {
      els.reviewList.innerHTML = `<p class="quiz-help">No incorrect answers. Nice work.</p>`;
    } else {
      wrong.forEach((w) => {
        const div = document.createElement("div");
        div.className = "quiz-review-item";
        div.innerHTML = `
          <strong>Question ${w.i + 1}: ${escapeHTML(w.q.question)}</strong>
          <div class="line">Your answer: ${escapeHTML(w.selectedText)}</div>
          <div class="line">Correct: ${escapeHTML(w.correctText)}</div>
          ${w.q.hint ? `<div class="line">Hint: ${escapeHTML(w.q.hint)}</div>` : ""}
        `;
        els.reviewList.appendChild(div);
      });
    }
    showResults();
  }

  function goNext() {
    if (idx < questions.length - 1) {
      idx++;
      renderQuestion();
    } else {
      finishQuiz();
    }
  }

  function goPrev() {
    if (idx > 0) {
      idx--;
      renderQuestion();
    }
  }

  function loadSubjects() {
    const list = getJSON(SUBJECTS_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function loadSubjectPalette() {
    const colors = getJSON(COLOR_PALETTE_KEY, null);
    return Array.isArray(colors) && colors.length ? colors : DEFAULT_SUBJECT_COLORS;
  }

  function subjectColor(subj, idx) {
    const palette = loadSubjectPalette();
    if (subj && subj.color) return subj.color;
    if (palette[idx % palette.length]) return palette[idx % palette.length];
    return DEFAULT_SUBJECT_COLORS[idx % DEFAULT_SUBJECT_COLORS.length];
  }

  function renderSubjects() {
    if (!els.quizSubjectTable) return;
    const subjects = loadSubjects();
    els.quizSubjectTable.innerHTML = "";
    const hasBank = Object.keys(bank).length > 0;

    if (!subjects.length) {
      els.quizSubjectsEmpty?.classList.remove("hidden");
      els.quizSubjectsBody?.classList.add("hidden");
      return;
    }

    els.quizSubjectsEmpty?.classList.add("hidden");
    els.quizSubjectsBody?.classList.remove("hidden");

    subjects.forEach((subj, idx) => {
      const files = Array.isArray(subj.files) ? subj.files : [];
      const col = document.createElement("div");
      col.className = "subject-column";

      const header = document.createElement("div");
      header.className = "subject-header";
      const name = document.createElement("div");
      name.textContent = subj.name || "Subject";
      const dot = document.createElement("span");
      dot.className = "subject-color-dot";
      dot.style.background = subjectColor(subj, idx);
      dot.title = "Subject color";
      header.appendChild(name);
      header.appendChild(dot);

      const meta = document.createElement("div");
      meta.className = "quiz-subject-meta";
      meta.textContent = `${files.length} ${files.length === 1 ? "item" : "items"}`;

      const fileList = document.createElement("div");
      fileList.className = "quiz-subject-file-list";
      if (!files.length) {
        const empty = document.createElement("div");
        empty.className = "quiz-subject-file";
        empty.textContent = "No tasks/files yet.";
        fileList.appendChild(empty);
      } else {
        files.forEach((file) => {
          const row = document.createElement("div");
          row.className = "quiz-subject-file";

          const nameWrap = document.createElement("div");
          nameWrap.className = "quiz-subject-file-name";
          nameWrap.textContent = file.name || "Untitled file";

          const actions = document.createElement("div");
          actions.className = "quiz-subject-file-actions";

          const addBtn = document.createElement("button");
          addBtn.className = "chip-btn chip-btn-primary";
          addBtn.type = "button";
          addBtn.textContent = "Start quiz";
          addBtn.addEventListener("click", () =>
            startTaskQuiz(subj, file, hasBank)
          );
          actions.appendChild(addBtn);

          row.appendChild(nameWrap);
          row.appendChild(actions);
          fileList.appendChild(row);
        });
      }

      col.appendChild(header);
      col.appendChild(meta);
      col.appendChild(fileList);
      els.quizSubjectTable.appendChild(col);
    });
  }

  function setSubjectsVisible(show, { persist = true } = {}) {
    const shouldShow = !!show;
    const hasSubjects = !!(els.quizSubjectTable && els.quizSubjectTable.children.length);
    if (els.quizSubjectsBody) els.quizSubjectsBody.classList.toggle("hidden", !shouldShow || !hasSubjects);
    if (els.quizSubjectsEmpty) els.quizSubjectsEmpty.classList.toggle("hidden", !shouldShow || hasSubjects);
    if (els.toggleSubjectsBtn) els.toggleSubjectsBtn.textContent = shouldShow ? "Hide subjects" : "Show subjects";
    if (persist) setJSON(SUBJECT_VIS_KEY, { visible: shouldShow });
  }

  function applySavedSubjectVisibility() {
    const saved = getJSON(SUBJECT_VIS_KEY, { visible: true });
    const visible = saved && typeof saved.visible === "boolean" ? saved.visible : true;
    setSubjectsVisible(visible, { persist: false });
  }

  function startTaskCsvImport(subj, file) {
    if (!subj || !file) return;
    pendingImportTarget = {
      subjectId: subj.id,
      fileId: file.id,
      subjectName: subj.name || "Subject",
      fileName: file.name || "Task",
    };
    hiddenCsvInput.value = "";
    hiddenCsvInput.click();
  }

  function startTaskQuiz(subj, file, hasBank) {
    if (!subj || !file) return;
    currentSubjectRef = {
      subjectId: subj.id,
      fileId: file.id,
      subjectName: subj.name || "Subject",
      fileName: file.name || "Task",
    };
    if (!hasBank) {
      startTaskCsvImport(subj, file);
      return;
    }
    if (els.quizSelect && els.quizSelect.options.length) {
      els.quizSelect.selectedIndex = 0;
    }
    startQuiz();
  }

  function recordQuizSession() {
    if (!currentSubjectRef || !activeSessionStartMs) return;
    const now = Date.now();
    const elapsedMs = Math.max(0, now - activeSessionStartMs);
    const durationMinutes = Math.max(1, Math.round(elapsedMs / 60000));
    const sj = window.StudyPlanner && window.StudyPlanner.SessionJournal;
    if (!sj || typeof sj.appendSession !== "function") return;
    sj.appendSession({
      id: `quiz_${now.toString(16)}`,
      startedAt: new Date(activeSessionStartMs).toISOString(),
      endedAt: new Date(now).toISOString(),
      durationMinutes,
      kind: "study",
      subjectId: currentSubjectRef.subjectId || null,
      fileId: currentSubjectRef.fileId || null,
      tag: "quiz"
    });
    activeSessionStartMs = null;
  }

  els.csvFile.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      setStatus(`Reading file: ${file.name} ...`, "info");
      const text = await file.text();
      const built = buildQuestionBank(text);
      applyImportResult(built, { fileName: file.name, sourceText: text });
    } catch (err) {
      console.error(err);
      setStatus(`Import failed: ${err.message}`, "error");
      els.quizSelect.disabled = true;
      els.startBtn.disabled = true;
    }
  });

  els.startBtn.addEventListener("click", startQuiz);
  els.resetBtn.addEventListener("click", resetAll);
  els.hintBtn.addEventListener("click", () => els.hintText.classList.toggle("hidden"));
  els.nextBtn.addEventListener("click", goNext);
  els.prevBtn.addEventListener("click", goPrev);
  els.finishBtn.addEventListener("click", finishQuiz);
  els.restartBtn.addEventListener("click", () => startQuiz());
  els.backToImportBtn.addEventListener("click", () => showImport());
  els.toggleSubjectsBtn?.addEventListener("click", () => {
    const hasSubjects = !!(els.quizSubjectTable && els.quizSubjectTable.children.length);
    const isVisible = hasSubjects
      ? !els.quizSubjectsBody?.classList.contains("hidden")
      : !els.quizSubjectsEmpty?.classList.contains("hidden");
    setSubjectsVisible(!isVisible);
  });

  document.addEventListener("keydown", (ev) => {
    if (els.quizCard.classList.contains("hidden")) return;
    if (ev.key === "ArrowRight" && !els.nextBtn.disabled) goNext();
    if (ev.key === "ArrowLeft") goPrev();
  });

  hiddenCsvInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const target = pendingImportTarget;
      pendingImportTarget = null;
      setStatus(`Reading file: ${file.name} ...`, "info");
      const text = await file.text();
      const built = buildQuestionBank(text);
      applyImportResult(built, {
        fileName: file.name,
        sourceText: text,
        subjectRef: target || null,
      });
    } catch (err) {
      console.error(err);
      setStatus(`Import failed: ${err.message}`, "error");
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key === SUBJECTS_KEY || event.key === COLOR_PALETTE_KEY) {
      renderSubjects();
      applySavedSubjectVisibility();
    }
    if (event.key === QUIZ_STORAGE_KEY) {
      restoreSavedImport();
    }
  });

  async function init() {
    resetAll();
    const remoteLoaded = await loadRemoteQuizSet();
    if (!remoteLoaded) restoreSavedImport();
    renderSubjects();
    applySavedSubjectVisibility();
  }

  void init();
})();
