(() => {
  const existing = window.StudyPlanner && typeof window.StudyPlanner === "object" ? window.StudyPlanner : {};
  const StudyPlanner = (window.StudyPlanner = existing);
  const Storage = StudyPlanner.Storage || null;

  const SETTINGS_KEY = "studyReviewSettings_v1";
  const EXAM_MODE_KEY = "studyExamMode_v1";

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

  function nowMs() {
    return Date.now();
  }

  function startOfDayMs(ms) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function minutes(val) {
    return Math.max(0, Math.round(Number(val) || 0));
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function loadSettings() {
    const raw = getJSON(SETTINGS_KEY, {});
    const s = raw && typeof raw === "object" ? raw : {};
    return {
      dailyTargetMinutes: minutes(s.dailyTargetMinutes || 30) || 30,
      includeFiles: s.includeFiles !== false,
      includeExams: s.includeExams !== false,
      includeAssignments: !!s.includeAssignments
    };
  }

  function saveSettings(next) {
    const cur = loadSettings();
    const n = next && typeof next === "object" ? next : {};
    const out = {
      dailyTargetMinutes: n.dailyTargetMinutes != null ? minutes(n.dailyTargetMinutes) : cur.dailyTargetMinutes,
      includeFiles: n.includeFiles != null ? !!n.includeFiles : cur.includeFiles,
      includeExams: n.includeExams != null ? !!n.includeExams : cur.includeExams,
      includeAssignments: n.includeAssignments != null ? !!n.includeAssignments : cur.includeAssignments
    };
    setJSON(SETTINGS_KEY, out, { debounceMs: 0 });
    try {
      window.dispatchEvent(new CustomEvent("study:review-settings-changed"));
    } catch {}
    return out;
  }

  function loadSubjects() {
    const subjects = getJSON("studySubjects_v1", []);
    return Array.isArray(subjects) ? subjects : [];
  }

  function loadAssignments() {
    const list = getJSON("studyAssignments", []);
    return Array.isArray(list) ? list : [];
  }

  function computeFileDueScore(file, now) {
    const conf = Number(file && file.confidence);
    const confidence = Number.isFinite(conf) ? conf : 50;
    const last = file && file.lastReviewed ? new Date(file.lastReviewed).getTime() : 0;
    const ageDays = last ? Math.max(0, (now - last) / 86400000) : 999;
    // Explainable: low confidence + not reviewed recently.
    const confNeed = (100 - confidence) / 100; // 0..1
    const ageNeed = clamp(ageDays / 7, 0, 1.8); // 0..~1.8
    const score = confNeed * 60 + ageNeed * 40; // 0..132
    const due = score >= 55 || ageDays >= 10;
    return { score, due, confidence, ageDays };
  }

  function dueFiles(now) {
    const out = [];
    const subjects = loadSubjects();
    subjects.forEach((subj) => {
      const files = Array.isArray(subj.files) ? subj.files : [];
      files.forEach((file) => {
        const res = computeFileDueScore(file, now);
        if (!res.due) return;
        out.push({
          kind: "file",
          score: res.score,
          title: `${subj.name || "Subject"} – ${file.name || "File"}`,
          subjectId: subj.id,
          fileId: file.id,
          confidence: res.confidence,
          ageDays: res.ageDays,
          estMinutes: 25
        });
      });
    });
    out.sort((a, b) => b.score - a.score);
    return out;
  }

  function loadExamModeMap() {
    const map = getJSON(EXAM_MODE_KEY, {});
    return map && typeof map === "object" && !Array.isArray(map) ? map : {};
  }

  function dueExamSyllabus(now) {
    const out = [];
    const assignments = loadAssignments().filter((a) => a && a.type === "exam" && a.status !== "done");
    const examMode = loadExamModeMap();
    assignments.forEach((exam) => {
      const due = exam.dueAt ? new Date(exam.dueAt).getTime() : 0;
      if (!due || Number.isNaN(due)) return;
      const daysLeft = Math.max(0, Math.round((due - now) / 86400000));
      const weight = clamp((60 - daysLeft) / 60, 0, 1); // ramps up in last 60 days
      const items = Array.isArray(examMode[exam.id]?.items) ? examMode[exam.id].items : [];
      items.forEach((it) => {
        if (!it || it.done) return;
        const last = it.lastReviewedAt ? new Date(it.lastReviewedAt).getTime() : 0;
        const ageDays = last ? Math.max(0, (now - last) / 86400000) : 999;
        const base = clamp(ageDays / 5, 0, 2) * 45;
        const score = base + weight * 55;
        if (score < 40) return;
        out.push({
          kind: "exam_item",
          score,
          title: `${exam.title || "Exam"} – ${it.title || "Syllabus item"}`,
          examId: exam.id,
          itemId: it.id,
          subjectId: it.subjectId || exam.subjectId || null,
          fileId: it.fileId || null,
          daysLeft,
          estMinutes: minutes(it.estimateMinutes || 20) || 20
        });
      });
    });
    out.sort((a, b) => b.score - a.score);
    return out;
  }

  function dueAssignmentsSoon(now) {
    const horizon = now + 7 * 86400000;
    const list = loadAssignments()
      .filter((a) => a && a.status !== "done" && a.type !== "exam" && a.dueAt)
      .map((a) => {
        const due = new Date(a.dueAt).getTime();
        if (!due || Number.isNaN(due)) return null;
        if (due < now - 86400000 || due > horizon) return null;
        const daysLeft = Math.max(0, Math.round((due - now) / 86400000));
        const score = 70 - daysLeft * 8;
        return {
          kind: "assignment",
          score,
          title: `Assignment: ${a.title}`,
          assignmentId: a.id,
          subjectId: a.subjectId || null,
          fileId: a.fileId || null,
          daysLeft,
          estMinutes: minutes(a.estimateMinutes || 30) || 30
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
    return list;
  }

  function capToBudget(items, sessions) {
    const budget = StudyPlanner.TimeBudget?.load ? StudyPlanner.TimeBudget.load() : null;
    if (!budget || !budget.dailyMaxMinutes) return items;
    const used = StudyPlanner.TimeBudget?.computeUsage ? StudyPlanner.TimeBudget.computeUsage(sessions || [], nowMs()) : { dayMin: 0 };
    const remaining = Math.max(0, budget.dailyMaxMinutes - (used.dayMin || 0));
    if (!remaining) return items.slice(0, 3);
    let sum = 0;
    const out = [];
    for (const it of items) {
      out.push(it);
      sum += minutes(it.estMinutes || 0) || 20;
      if (sum >= remaining) break;
    }
    return out;
  }

  function loadSessions() {
    const list = getJSON("studySessions_v1", []);
    return Array.isArray(list) ? list : [];
  }

  function getQueue({ limit = 10 } = {}) {
    const now = nowMs();
    const settings = loadSettings();
    let items = [];
    if (settings.includeFiles) items = items.concat(dueFiles(now));
    if (settings.includeExams) items = items.concat(dueExamSyllabus(now));
    if (settings.includeAssignments) items = items.concat(dueAssignmentsSoon(now));
    items.sort((a, b) => b.score - a.score);
    const capped = capToBudget(items, loadSessions());
    return capped.slice(0, Math.max(1, Number(limit) || 10));
  }

  function actionFor(item) {
    if (!item) return null;
    if (item.kind === "file") {
      return { type: "navigate", href: `index.html?mode=board&startStudy=1&subjectId=${encodeURIComponent(item.subjectId)}&fileId=${encodeURIComponent(item.fileId)}` };
    }
    if (item.kind === "exam_item") {
      return { type: "navigate", href: `calendar.html?openExamMode=1&examId=${encodeURIComponent(item.examId)}&examItemId=${encodeURIComponent(item.itemId)}` };
    }
    if (item.kind === "assignment") {
      return { type: "navigate", href: `calendar.html?openAssignmentId=${encodeURIComponent(item.assignmentId)}` };
    }
    return null;
  }

  StudyPlanner.ReviewEngine = Object.assign(StudyPlanner.ReviewEngine || {}, {
    SETTINGS_KEY,
    loadSettings,
    saveSettings,
    getQueue,
    actionFor
  });
})();
