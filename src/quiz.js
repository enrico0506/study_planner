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
    savedQuizList: document.getElementById("savedQuizList"),
    manageModal: document.getElementById("quizManageModal"),
    manageName: document.getElementById("quizManageName"),
    manageSave: document.getElementById("quizManageSave"),
    manageDelete: document.getElementById("quizManageDelete"),
    manageClose: document.getElementById("quizManageClose"),
    manageSubject: document.getElementById("quizManageSubject"),
    manageTask: document.getElementById("quizManageTask"),
  };

  if (!els.csvFile || !els.quizCard) return;

  const STORAGE_KEY = "studyQuizBank_v1";
  const SUBJECTS_KEY = "studySubjects_v1";
  let savedBank = {};
  let bank = {};
  let manageTarget = "";
  let subjects = [];
  let currentQuizName = "";
  let questions = [];
  let idx = 0;
  let answers = [];
  let score = 0;

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

  function loadSavedBank() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
      console.warn("Could not load saved quizzes", err);
      return {};
    }
  }

  function loadSubjects() {
    try {
      const raw = localStorage.getItem(SUBJECTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      subjects = Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      subjects = [];
    }
  }

  function getSubjectColor(subjectId) {
    const subj = subjects.find((s) => s.id === subjectId);
    return subj?.color || "";
  }

  function saveBank() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedBank));
    } catch (err) {
      console.warn("Could not save quizzes", err);
    }
  }

  function renderQuizSelect() {
    if (!els.quizSelect) return;
    els.quizSelect.innerHTML = "";
    const names = Object.keys(savedBank).sort((a, b) => a.localeCompare(b));
    if (!names.length) {
      els.quizSelect.innerHTML = `<option value="">Import first…</option>`;
      els.quizSelect.disabled = true;
      els.startBtn.disabled = true;
      renderSavedList();
      return;
    }
    names.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = `${name} (${savedBank[name].length} q)`;
      if (currentQuizName === name) opt.selected = true;
      els.quizSelect.appendChild(opt);
    });
    els.quizSelect.disabled = false;
    updateStartDisabled();
    renderSavedList();
  }

  function renderSavedList() {
    if (!els.savedQuizList) return;
    els.savedQuizList.innerHTML = "";
    const names = Object.keys(savedBank).sort((a, b) => a.localeCompare(b));
    if (!names.length) {
      const empty = document.createElement("div");
      empty.className = "quiz-help";
      empty.textContent = "No saved quizzes yet. Import a CSV to keep it here.";
      els.savedQuizList.appendChild(empty);
      return;
    }
    names.forEach((name) => {
      const item = document.createElement("div");
      item.className = "saved-item";
      if (currentQuizName === name) item.classList.add("active");
      const infoWrap = document.createElement("div");
      infoWrap.addEventListener("click", () => {
        currentQuizName = name;
        els.quizSelect.value = name;
        renderSavedList();
        updateStartDisabled();
      });
      const title = document.createElement("div");
      title.className = "saved-item-title";
      title.textContent = name;
      const meta = document.createElement("div");
      meta.className = "saved-item-meta";
      const subjColor = getSubjectColor(savedBank[name]._meta?.subjectId);
      const subjectTag = savedBank[name]._meta?.subjectId
        ? `<span class="subject-chip" style="${subjColor ? `background:${subjColor}22;border-color:${subjColor}44;` : ""}">${savedBank[name]._meta.subjectName || "Subject"}</span>`
        : "";
      meta.innerHTML = `${savedBank[name].length} question${savedBank[name].length === 1 ? "" : "s"} ${subjectTag}`;
      infoWrap.appendChild(title);
      infoWrap.appendChild(meta);
      item.appendChild(infoWrap);

      const actions = document.createElement("div");
      actions.className = "saved-item-actions";
      const manageBtn = document.createElement("button");
      manageBtn.className = "chip-btn";
      manageBtn.type = "button";
      manageBtn.textContent = "Optionen";
      manageBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        openManageModal(name);
      });
      actions.appendChild(manageBtn);
      item.appendChild(actions);

      els.savedQuizList.appendChild(item);
    });
  }

  function openManageModal(name) {
    manageTarget = name;
    if (els.manageName) els.manageName.value = name;
    populateSubjectSelects();
    const meta = savedBank[name]?._meta || {};
    if (els.manageSubject) els.manageSubject.value = meta.subjectId || "";
    populateTaskSelect(meta.subjectId || "", meta.fileId || "");
    if (els.manageModal) els.manageModal.classList.add("is-open");
  }

  function closeManageModal() {
    manageTarget = "";
    if (els.manageModal) els.manageModal.classList.remove("is-open");
  }

  function renameQuiz(newName) {
    if (!manageTarget || !newName || newName === manageTarget) return;
    if (savedBank[newName]) {
      alert("A quiz with that name already exists.");
      return;
    }
    const prevMeta = savedBank[manageTarget]?._meta;
    savedBank[newName] = savedBank[manageTarget];
    if (prevMeta) savedBank[newName]._meta = prevMeta;
    delete savedBank[manageTarget];
    if (currentQuizName === manageTarget) currentQuizName = newName;
    saveBank();
    renderQuizSelect();
    renderSavedList();
    closeManageModal();
  }

  function deleteQuiz() {
    if (!manageTarget) return;
    if (!confirm("Remove this quiz from the library?")) return;
    delete savedBank[manageTarget];
    if (currentQuizName === manageTarget) currentQuizName = "";
    saveBank();
    bank = { ...savedBank };
    renderQuizSelect();
    renderSavedList();
    updateStartDisabled();
    closeManageModal();
  }

  function populateSubjectSelects() {
    if (!els.manageSubject) return;
    const current = els.manageSubject.value;
    els.manageSubject.innerHTML = `<option value="">No subject</option>`;
    subjects.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name || "Subject";
      if (current && current === s.id) opt.selected = true;
      els.manageSubject.appendChild(opt);
    });
  }

  function populateTaskSelect(subjectId, selectedFileId = "") {
    if (!els.manageTask) return;
    els.manageTask.innerHTML = `<option value="">No task</option>`;
    if (!subjectId) return;
    const subj = subjects.find((s) => s.id === subjectId);
    const files = Array.isArray(subj?.files) ? subj.files : [];
    files.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.name || "Task";
      if (selectedFileId && selectedFileId === f.id) opt.selected = true;
      els.manageTask.appendChild(opt);
    });
  }

  function saveLinksForQuiz(name, subjectId, fileId) {
    const subj = subjects.find((s) => s.id === subjectId);
    const files = Array.isArray(subj?.files) ? subj.files : [];
    const file = files.find((f) => f.id === fileId);
    if (!savedBank[name]) return;
    savedBank[name]._meta = {
      subjectId: subjectId || "",
      subjectName: subj?.name || "",
      fileId: fileId || "",
      fileName: file?.name || "",
    };
    saveBank();
    renderSavedList();
  }

  function updateStartDisabled() {
    const selected = els.quizSelect.value;
    const has = selected && savedBank[selected];
    els.startBtn.disabled = !has;
    els.resetBtn.disabled = !Object.keys(savedBank).length;
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
    bank = { ...savedBank };
    currentQuizName = "";
    questions = [];
    answers = [];
    idx = 0;
    score = 0;
    renderQuizSelect();
    const names = Object.keys(savedBank).sort((a, b) => a.localeCompare(b));
    if (names.length) {
      currentQuizName = names[0];
      els.quizSelect.value = currentQuizName;
      renderSavedList();
    }
    els.resetBtn.disabled = !Object.keys(savedBank).length;
    if (els.csvFile) els.csvFile.value = "";
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

  els.csvFile.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      setStatus(`Reading file: ${file.name} ...`, "info");
      const text = await file.text();
      const built = buildQuestionBank(text);
      Object.entries(built.bank).forEach(([name, questions]) => {
        const existingMeta = savedBank[name]?._meta;
        savedBank[name] = questions;
        if (existingMeta) savedBank[name]._meta = existingMeta;
      });
      bank = { ...savedBank };
      currentQuizName = built.quizNames[0] || currentQuizName;
      saveBank();
      renderQuizSelect();
      if (currentQuizName) els.quizSelect.value = currentQuizName;
      updateStartDisabled();

      const totalQuestions = Object.values(savedBank).reduce((acc, arr) => acc + arr.length, 0);
      const delimText = built.delimiter === "\t" ? "\\t" : built.delimiter;
      setStatus(
        `Import successful: ${built.quizNames.length} set(s), ${totalQuestions} question(s). Delimiter: "${delimText}".`,
        "ok"
      );
      if (e.target) e.target.value = "";
    } catch (err) {
      console.error(err);
      setStatus(`Import failed: ${err.message}`, "error");
      updateStartDisabled();
    }
  });

  els.startBtn.addEventListener("click", startQuiz);
  els.quizSelect.addEventListener("change", () => {
    currentQuizName = els.quizSelect.value;
    renderSavedList();
    updateStartDisabled();
  });
  els.resetBtn.addEventListener("click", resetAll);
  els.hintBtn.addEventListener("click", () => els.hintText.classList.toggle("hidden"));
  els.nextBtn.addEventListener("click", goNext);
  els.prevBtn.addEventListener("click", goPrev);
  els.finishBtn.addEventListener("click", finishQuiz);
  els.restartBtn.addEventListener("click", () => startQuiz());
  els.backToImportBtn.addEventListener("click", () => showImport());
  els.manageClose?.addEventListener("click", closeManageModal);
  els.manageModal?.querySelector(".quiz-modal-backdrop")?.addEventListener("click", closeManageModal);
  els.manageSave?.addEventListener("click", () => {
    if (els.manageName) renameQuiz(els.manageName.value.trim());
    if (manageTarget) {
      saveLinksForQuiz(manageTarget, els.manageSubject?.value || "", els.manageTask?.value || "");
    }
    closeManageModal();
  });
  els.manageDelete?.addEventListener("click", deleteQuiz);
  els.manageSubject?.addEventListener("change", () => {
    populateTaskSelect(els.manageSubject.value || "", "");
  });

  document.addEventListener("keydown", (ev) => {
    if (els.quizCard.classList.contains("hidden")) return;
    if (ev.key === "ArrowRight" && !els.nextBtn.disabled) goNext();
    if (ev.key === "ArrowLeft") goPrev();
  });

  savedBank = loadSavedBank();
  loadSubjects();
  bank = { ...savedBank };
  renderQuizSelect();
  resetAll();
})();
