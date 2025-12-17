(() => {
  const StudyPlanner = window.StudyPlanner || {};
  const Notes = StudyPlanner.Notes || null;
  const Storage = StudyPlanner.Storage || null;

  const FLASHCARDS_KEY = "studyFlashcards_v1";
  const IMPORT_LOG_KEY = "studyFlashcardImports_v1";

  const ui = {
    openBtn: document.getElementById("notesToFlashcardsBtn"),
    notesEditor: document.getElementById("notesEditor"),
    modal: document.getElementById("flashcardGenModal"),
    backdrop: document.getElementById("flashcardGenModalBackdrop"),
    closeBtn: document.getElementById("closeFlashcardGenBtn"),
    cancelBtn: document.getElementById("flashcardGenCancelBtn"),
    importBtn: document.getElementById("flashcardGenImportBtn"),
    deckSelect: document.getElementById("flashcardGenDeckSelect"),
    newDeckInput: document.getElementById("flashcardGenNewDeck"),
    status: document.getElementById("flashcardGenStatus"),
    list: document.getElementById("flashcardGenList"),
  };

  if (!ui.openBtn || !ui.notesEditor || !ui.modal || !ui.importBtn || !ui.list || !ui.deckSelect) return;

  function safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function getRaw(key, fallback = null) {
    if (Storage) return Storage.getRaw(key, fallback);
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }

  function setRaw(key, value, { debounceMs = 0 } = {}) {
    if (Storage) return Storage.setRaw(key, value, { debounceMs });
    try {
      localStorage.setItem(key, value);
    } catch {}
  }

  function getJSON(key, fallback) {
    const raw = getRaw(key, null);
    if (!raw) return fallback;
    const parsed = safeJsonParse(raw);
    return parsed == null ? fallback : parsed;
  }

  function setJSON(key, value, { debounceMs = 0 } = {}) {
    if (Storage) return Storage.setJSON(key, value, { debounceMs });
    setRaw(key, JSON.stringify(value), { debounceMs });
  }

  function setStatus(message, tone = "muted") {
    if (!ui.status) return;
    ui.status.textContent = String(message || "");
    ui.status.dataset.tone = tone;
  }

  function openModal() {
    ui.modal.classList.add("is-open");
    ui.modal.setAttribute("aria-hidden", "false");
    if (typeof syncBodyModalState === "function") syncBodyModalState();
  }

  function closeModal() {
    if (!ui.modal.classList.contains("is-open")) return;
    ui.modal.classList.remove("is-open");
    ui.modal.setAttribute("aria-hidden", "true");
    if (typeof syncBodyModalState === "function") syncBodyModalState();
  }

  function createId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  }

  function normalizeFlashcardsState(state) {
    const s = state && typeof state === "object" ? state : {};
    const decks = Array.isArray(s.decks) ? s.decks : [];
    const activeDeckId = s.activeDeckId || (decks[0] && decks[0].id) || null;
    const mode = s.mode || "normal";
    return { decks, activeDeckId, mode };
  }

  function loadFlashcardsState() {
    const raw = getRaw(FLASHCARDS_KEY, null);
    if (!raw) return normalizeFlashcardsState({ decks: [] });
    return normalizeFlashcardsState(safeJsonParse(raw) || { decks: [] });
  }

  function saveFlashcardsState(state) {
    setRaw(FLASHCARDS_KEY, JSON.stringify(state), { debounceMs: 0 });
  }

  function renderDeckSelect() {
    const state = loadFlashcardsState();
    ui.deckSelect.replaceChildren();
    if (!state.decks.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No decks yet";
      ui.deckSelect.appendChild(opt);
      ui.deckSelect.disabled = true;
      return;
    }
    ui.deckSelect.disabled = false;
    state.decks.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.name || "Deck";
      ui.deckSelect.appendChild(opt);
    });
    ui.deckSelect.value = state.activeDeckId || state.decks[0].id;
  }

  function trimLine(s) {
    return String(s || "").replace(/\s+/g, " ").trim();
  }

  function parseCardsFromText(text) {
    const lines = String(text || "").split(/\r?\n/);
    const cards = [];

    const push = (front, back, hint = "") => {
      const f = trimLine(front);
      const b = trimLine(back);
      const h = trimLine(hint);
      if (f.length < 2 || b.length < 2) return;
      cards.push({ id: createId("gen"), front: f, back: b, hint: h });
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Q/A blocks
      const qMatch = line.match(/^Q:\s*(.+)$/i);
      if (qMatch) {
        const q = qMatch[1];
        const next = (lines[i + 1] || "").trim();
        const aMatch = next.match(/^A:\s*(.+)$/i);
        if (aMatch) {
          push(q, aMatch[1]);
          i += 1;
          continue;
        }
      }

      // Term: Definition
      const colon = line.indexOf(":");
      if (colon > 1 && colon < line.length - 2) {
        const left = line.slice(0, colon);
        const right = line.slice(colon + 1);
        if (left.length <= 80 && right.trim().length >= 2) {
          push(left, right);
          continue;
        }
      }

      // List item: - Term — Definition / - Term - Definition
      const li = line.match(/^[-*]\s+(.+)$/);
      if (li) {
        const body = li[1];
        const sep = body.includes("—") ? "—" : body.includes(" - ") ? " - " : body.includes(" – ") ? " – " : null;
        if (sep) {
          const parts = body.split(sep);
          if (parts.length >= 2) push(parts[0], parts.slice(1).join(sep));
          continue;
        }
      }

      // Heading: ## Term then next paragraph as definition
      const h = line.match(/^#{2,3}\s+(.+)$/);
      if (h) {
        const term = h[1];
        let j = i + 1;
        const para = [];
        while (j < lines.length) {
          const next = lines[j].trim();
          if (!next) break;
          if (/^#{2,3}\s+/.test(next)) break;
          if (/^[-*]\s+/.test(next)) break;
          para.push(next);
          j += 1;
        }
        if (para.length) {
          push(term, para.join(" "));
          i = j - 1;
          continue;
        }
      }
    }

    return cards;
  }

  function getSelectedOrSectionText() {
    const value = ui.notesEditor.value || "";
    const start = ui.notesEditor.selectionStart || 0;
    const end = ui.notesEditor.selectionEnd || 0;
    if (end > start) return value.slice(start, end);

    // No selection: use current heading block (## / ###) around cursor; fallback to full note.
    const lines = value.split(/\r?\n/);
    let pos = 0;
    let cursorLine = 0;
    for (let i = 0; i < lines.length; i++) {
      const nextPos = pos + lines[i].length + 1;
      if (start < nextPos) {
        cursorLine = i;
        break;
      }
      pos = nextPos;
    }
    let headingLine = -1;
    for (let i = cursorLine; i >= 0; i--) {
      if (/^#{2,3}\s+/.test(lines[i].trim())) {
        headingLine = i;
        break;
      }
    }
    if (headingLine === -1) return value;
    const out = [lines[headingLine]];
    for (let i = headingLine + 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^#{2,3}\s+/.test(l.trim())) break;
      out.push(l);
    }
    return out.join("\n");
  }

  let generated = [];

  function renderGenerated() {
    ui.list.replaceChildren();
    if (!generated.length) {
      const empty = document.createElement("div");
      empty.className = "calendar-empty";
      empty.textContent = "No cards generated. Try selecting a section with clear “Term: Definition” lines.";
      ui.list.appendChild(empty);
      ui.importBtn.disabled = true;
      return;
    }
    ui.importBtn.disabled = false;
    generated.forEach((c) => {
      const row = document.createElement("div");
      row.className = "calendar-upcoming-row";
      row.dataset.cardId = c.id;

      const front = document.createElement("textarea");
      front.rows = 2;
      front.value = c.front;
      front.addEventListener("input", () => (c.front = front.value));

      const back = document.createElement("textarea");
      back.rows = 3;
      back.value = c.back;
      back.addEventListener("input", () => (c.back = back.value));

      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-secondary";
      del.textContent = "Remove";
      del.addEventListener("click", () => {
        generated = generated.filter((x) => x.id !== c.id);
        renderGenerated();
      });

      row.appendChild(front);
      row.appendChild(back);
      row.appendChild(del);
      ui.list.appendChild(row);
    });
  }

  function openGenerator() {
    renderDeckSelect();
    const text = getSelectedOrSectionText();
    generated = parseCardsFromText(text);
    setStatus(`${generated.length} card(s) generated. Review before import.`, generated.length ? "muted" : "error");
    renderGenerated();
    openModal();
  }

  function importCards() {
    const targetDeckId = ui.deckSelect.value;
    const newDeckName = String(ui.newDeckInput.value || "").trim();
    const state = loadFlashcardsState();
    let deckId = targetDeckId;
    if (newDeckName) {
      deckId = `deck-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      state.decks.push({ id: deckId, name: newDeckName, description: "Imported from notes.", cards: [] });
      state.activeDeckId = deckId;
    }
    const deck = state.decks.find((d) => d.id === deckId) || state.decks[0];
    if (!deck) {
      setStatus("No deck available. Open Karteikarten first to create a deck.", "error");
      return;
    }
    const cardsToAdd = generated
      .map((c) => ({
        id: `card-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        deckId: deck.id,
        front: String(c.front || "").trim(),
        back: String(c.back || "").trim(),
        hint: "",
        createdAt: Date.now(),
        due: Date.now(),
        intervalDays: 0,
        easeFactor: 2.5,
        reviewCount: 0
      }))
      .filter((c) => c.front && c.back);

    if (!cardsToAdd.length) {
      setStatus("Nothing to import after filtering empty cards.", "error");
      return;
    }
    deck.cards = Array.isArray(deck.cards) ? deck.cards : [];
    deck.cards.push(...cardsToAdd);
    saveFlashcardsState(state);

    const ctx = Notes && Notes.getOpenContext ? Notes.getOpenContext() : null;
    const log = getJSON(IMPORT_LOG_KEY, []);
    const next = Array.isArray(log) ? log : [];
    next.push({
      ts: new Date().toISOString(),
      count: cardsToAdd.length,
      deckId: deck.id,
      source: ctx ? { scope: ctx.scope, scopeId: ctx.scopeId } : null
    });
    while (next.length > 200) next.shift();
    setJSON(IMPORT_LOG_KEY, next, { debounceMs: 0 });

    setStatus(`Imported ${cardsToAdd.length} cards to “${deck.name || "Deck"}”.`, "success");
    try {
      window.dispatchEvent(new CustomEvent("study:flashcards-changed"));
    } catch {}
    closeModal();
  }

  ui.openBtn.addEventListener("click", openGenerator);
  ui.closeBtn?.addEventListener("click", closeModal);
  ui.cancelBtn?.addEventListener("click", closeModal);
  ui.backdrop?.addEventListener("click", (e) => {
    if (e.target === ui.backdrop) closeModal();
  });
  ui.importBtn.addEventListener("click", importCards);

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (ui.modal && ui.modal.classList.contains("is-open")) {
      event.preventDefault();
      closeModal();
    }
  });
})();
