(() => {
  const storageKey = "studyFlashcards_v1";

  const elements = {
    deckList: document.getElementById("deckList"),
    deckForm: document.getElementById("deckForm"),
    deckNameInput: document.getElementById("deckNameInput"),
    deckDescriptionInput: document.getElementById("deckDescriptionInput"),
    focusDeckNameBtn: document.getElementById("focusDeckNameBtn"),
    csvFileInput: document.getElementById("csvFileInput"),
    csvDeckSelect: document.getElementById("csvDeckSelect"),
    csvDelimiterSelect: document.getElementById("csvDelimiterSelect"),
    importCsvBtn: document.getElementById("importCsvBtn"),
    clearCsvBtn: document.getElementById("clearCsvBtn"),
    importStatus: document.getElementById("importStatus"),
    cardForm: document.getElementById("cardForm"),
    cardDeckSelect: document.getElementById("cardDeckSelect"),
    cardFrontInput: document.getElementById("cardFrontInput"),
    cardBackInput: document.getElementById("cardBackInput"),
    prefillActiveFrontBtn: document.getElementById("prefillActiveFrontBtn"),
    openCardModalBtn: document.getElementById("openCardModalBtn"),
    closeCardModalBtn: document.getElementById("closeCardModalBtn"),
    cardModal: document.getElementById("cardModal"),
    cardModalBackdrop: document.getElementById("cardModalBackdrop"),
    activeDeckTitle: document.getElementById("activeDeckTitle"),
    activeDeckMeta: document.getElementById("activeDeckMeta"),
    deckStats: document.getElementById("deckStats"),
    cardList: document.getElementById("cardList"),
    modeNormalBtn: document.getElementById("modeNormalBtn"),
    modeIntervalBtn: document.getElementById("modeIntervalBtn"),
    reviewModeLabel: document.getElementById("reviewModeLabel"),
    reviewStats: document.getElementById("reviewStats"),
    reviewCard: document.getElementById("reviewCard"),
    reviewFront: document.getElementById("reviewFront"),
    reviewBack: document.getElementById("reviewBack"),
    showAnswerBtn: document.getElementById("showAnswerBtn"),
    normalActions: document.getElementById("normalActions"),
    intervalActions: document.getElementById("intervalActions"),
    markKnownBtn: document.getElementById("markKnownBtn"),
    markRepeatBtn: document.getElementById("markRepeatBtn"),
    rebuildQueueBtn: document.getElementById("rebuildQueueBtn"),
    showUpcomingBtn: document.getElementById("showUpcomingBtn"),
    openCsvModalBtn: document.getElementById("openCsvModalBtn"),
    closeCsvModalBtn: document.getElementById("closeCsvModalBtn"),
    csvModal: document.getElementById("csvModal"),
    csvModalBackdrop: document.getElementById("csvModalBackdrop"),
  };

  const defaultDeck = () => ({
    id: `deck-${Date.now()}`,
    name: "Allgemein",
    description: "Sammle hier erste Karten oder importiere CSV.",
    cards: [],
  });

  const state = {
    decks: [],
    activeDeckId: null,
    mode: "normal",
    reviewQueue: [],
    currentCard: null,
    showAnswer: false,
  };

  function setModalState(modalEl, open) {
    if (!modalEl) return;
    modalEl.classList.toggle("is-open", open);
    modalEl.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        state.decks = parsed.decks || [];
        state.activeDeckId = parsed.activeDeckId || (state.decks[0] && state.decks[0].id);
        state.mode = parsed.mode || "normal";
        return;
      }
    } catch (err) {
      console.warn("Could not load flashcard state", err);
    }
    const starter = defaultDeck();
    state.decks = [starter];
    state.activeDeckId = starter.id;
    state.mode = "normal";
    saveState();
  }

  function saveState() {
    const payload = {
      decks: state.decks,
      activeDeckId: state.activeDeckId,
      mode: state.mode,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }

  function getActiveDeck() {
    return state.decks.find((deck) => deck.id === state.activeDeckId) || state.decks[0];
  }

  function setActiveDeck(deckId) {
    state.activeDeckId = deckId;
    buildQueue();
    saveState();
    render();
  }

  function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  function summarizeDeck(deck) {
    const now = Date.now();
    const total = deck.cards.length;
    const due = deck.cards.filter((card) => !card.due || card.due <= now).length;
    const newCards = deck.cards.filter((card) => !card.reviewCount || card.reviewCount === 0).length;
    return { total, due, newCards };
  }

  function renderDeckList() {
    const deck = getActiveDeck();
    elements.deckList.innerHTML = "";
    state.decks.forEach((d) => {
      const stats = summarizeDeck(d);
      const btn = document.createElement("button");
      btn.className = `deck-list-item ${deck && deck.id === d.id ? "deck-list-item-active" : ""}`;
      btn.type = "button";
      btn.innerHTML = `
        <div class="deck-list-title">${d.name}</div>
        <div class="deck-list-subtitle">${d.description || "Ohne Notiz"}</div>
        <div class="deck-list-meta">${stats.total} Karten • ${stats.due} fällig • ${stats.newCards} neu</div>
      `;
      btn.addEventListener("click", () => setActiveDeck(d.id));
      elements.deckList.appendChild(btn);
    });
  }

  function renderSelects() {
    const selectTargets = [elements.cardDeckSelect, elements.csvDeckSelect];
    selectTargets.forEach((select) => {
      select.innerHTML = "";
      state.decks.forEach((deck) => {
        const option = document.createElement("option");
        option.value = deck.id;
        option.textContent = deck.name;
        select.appendChild(option);
      });
      if (state.activeDeckId) {
        select.value = state.activeDeckId;
      }
    });
  }

  function renderActiveDeckMeta() {
    const deck = getActiveDeck();
    if (!deck) {
      elements.activeDeckTitle.textContent = "Kein Stapel";
      elements.activeDeckMeta.textContent = "0 Karten • 0 fällig";
      elements.deckStats.textContent = "";
      return;
    }
    const { total, due, newCards } = summarizeDeck(deck);
    elements.activeDeckTitle.textContent = deck.name;
    elements.activeDeckMeta.textContent = `${total} Karten • ${due} fällig • ${newCards} neu`;
    elements.deckStats.textContent = `${total} Karten insgesamt`;
  }

  function renderCardList() {
    const deck = getActiveDeck();
    elements.cardList.innerHTML = "";
    if (!deck || deck.cards.length === 0) {
      const empty = document.createElement("div");
      empty.className = "card-list-empty";
      empty.textContent = "Noch keine Karten im Stapel. Füge oben eine hinzu oder importiere eine CSV.";
      elements.cardList.appendChild(empty);
      return;
    }

    deck.cards
      .slice()
      .reverse()
      .forEach((card) => {
        const item = document.createElement("div");
        item.className = "card-list-item";
        const nextReview = card.due ? `Fällig: ${formatDateTime(card.due)}` : "Noch kein Intervall";
        item.innerHTML = `
          <div class="card-list-front">${card.front}</div>
          <div class="card-list-back">${card.back}</div>
          <div class="card-list-meta">${nextReview}</div>
          <button class="icon-btn icon-btn-ghost card-delete-btn" title="Karte löschen">✕</button>
        `;
        const deleteBtn = item.querySelector(".card-delete-btn");
        deleteBtn.addEventListener("click", () => {
          deck.cards = deck.cards.filter((c) => c.id !== card.id);
          buildQueue();
          saveState();
          render();
        });
        elements.cardList.appendChild(item);
      });
  }

  function setMode(mode) {
    state.mode = mode;
    elements.modeNormalBtn.classList.toggle("mode-btn-active", mode === "normal");
    elements.modeIntervalBtn.classList.toggle("mode-btn-active", mode === "interval");
    elements.reviewModeLabel.textContent = mode === "interval" ? "Intervall (Anki-ähnlich)" : "Normaler Durchgang";
    state.showAnswer = false;
    buildQueue();
    saveState();
    renderReview();
  }

  function scheduleCardInterval(card, rating) {
    const now = Date.now();
    const minEase = 1.3;
    const maxEase = 3.0;
    card.easeFactor = card.easeFactor || 2.5;
    card.intervalDays = card.intervalDays || 0;
    card.reviewCount = card.reviewCount || 0;
    card.lapses = card.lapses || 0;

    if (card.reviewCount === 0) {
      if (rating === "again") {
        card.intervalDays = 0.007;
      } else if (rating === "hard") {
        card.intervalDays = 0.02;
      } else if (rating === "good") {
        card.intervalDays = 1;
      } else {
        card.intervalDays = 3;
        card.easeFactor = Math.min(maxEase, card.easeFactor + 0.15);
      }
    } else {
      if (rating === "again") {
        card.intervalDays = 0.007;
        card.easeFactor = Math.max(minEase, card.easeFactor - 0.2);
        card.lapses += 1;
      } else if (rating === "hard") {
        card.intervalDays = Math.max(1, Math.round(card.intervalDays * 1.2));
        card.easeFactor = Math.max(minEase, card.easeFactor - 0.1);
      } else if (rating === "good") {
        card.intervalDays = Math.max(1, Math.round(card.intervalDays * card.easeFactor));
        card.easeFactor = Math.min(maxEase, card.easeFactor + 0.05);
      } else {
        card.intervalDays = Math.max(1, Math.round(card.intervalDays * (card.easeFactor + 0.15)));
        card.easeFactor = Math.min(maxEase, card.easeFactor + 0.1);
      }
    }

    card.reviewCount += 1;
    card.lastReviewed = now;
    card.due = now + card.intervalDays * 86400000;
  }

  function buildQueue(force) {
    const deck = getActiveDeck();
    if (!deck) {
      state.reviewQueue = [];
      state.currentCard = null;
      return;
    }
    if (state.mode === "interval") {
      const now = Date.now();
      const due = deck.cards.filter((card) => !card.due || card.due <= now);
      const upcoming = deck.cards
        .filter((card) => card.due && card.due > now)
        .sort((a, b) => (a.due || now) - (b.due || now));
      state.reviewQueue = due.length > 0 ? due : upcoming.slice(0, 5);
    } else {
      state.reviewQueue = shuffle(deck.cards.slice());
    }
    if (force || !state.currentCard) {
      state.currentCard = state.reviewQueue.shift() || null;
      state.showAnswer = false;
    }
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function renderReview() {
    const deck = getActiveDeck();
    const now = Date.now();
    if (!deck || deck.cards.length === 0) {
      elements.reviewFront.textContent = "Lege Karten an, um zu starten.";
      elements.reviewBack.textContent = "";
      elements.reviewStats.textContent = "Keine Karten vorhanden.";
      elements.reviewBack.classList.remove("review-back-visible");
      elements.showAnswerBtn.disabled = true;
      toggleActionButtons(false);
      return;
    }

    const { due } = summarizeDeck(deck);
    elements.reviewStats.textContent =
      state.mode === "interval" ? `${due} fällig • alle Zeiten nach Feedback` : `${deck.cards.length} Karten bereit`;

    if (!state.currentCard) {
      elements.reviewFront.textContent = due === 0 && state.mode === "interval"
        ? "Gerade nichts fällig. Schau dir die nächsten Karten an oder ändere den Modus."
        : "Keine Karte geladen. Mische neu, um zu starten.";
      elements.reviewBack.textContent = "";
      elements.reviewBack.classList.remove("review-back-visible");
      elements.showAnswerBtn.disabled = true;
      toggleActionButtons(false);
      return;
    }

    elements.showAnswerBtn.disabled = false;
    elements.reviewFront.textContent = state.currentCard.front;
    elements.reviewBack.textContent = state.currentCard.back;
    elements.reviewBack.classList.toggle("review-back-visible", state.showAnswer);
    toggleActionButtons(state.showAnswer);
    applyKatex();
  }

  function applyKatex() {
    if (!window.renderMathInElement) return;
    const delimiters = [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false },
      { left: "\\[", right: "\\]", display: true },
    ];
    renderMathInElement(elements.reviewCard, { delimiters, throwOnError: false });
    renderMathInElement(elements.cardList, { delimiters, throwOnError: false });
  }

  function toggleActionButtons(show) {
    elements.normalActions.style.display = state.mode === "normal" && show ? "flex" : "none";
    elements.intervalActions.style.display = state.mode === "interval" && show ? "flex" : "none";
  }

  function moveToNextCard() {
    const deck = getActiveDeck();
    if (!deck) return;
    state.currentCard = state.reviewQueue.shift() || null;
    if (!state.currentCard) {
      buildQueue(true);
    }
    state.showAnswer = false;
    render();
  }

  function handleNormalReview(known) {
    if (!state.currentCard) return;
    const card = state.currentCard;
    card.lastReviewed = Date.now();
    if (!card.reviewCount) card.reviewCount = 0;
    card.reviewCount += 1;
    if (!known) {
      state.reviewQueue.push(card);
    }
    saveState();
    moveToNextCard();
  }

  function handleIntervalReview(rating) {
    if (!state.currentCard) return;
    scheduleCardInterval(state.currentCard, rating);
    saveState();
    moveToNextCard();
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const chosen = elements.csvDelimiterSelect ? elements.csvDelimiterSelect.value : "auto";
    const delimiter = chosen === "auto" ? detectDelimiter(lines) : chosen === "tab" ? "\t" : chosen;
    const rows = [];
    lines.forEach((line) => {
      const cells = splitCsvLine(line, delimiter)
        .map((part) => part.trim().replace(/^"|"$/g, ""))
        .filter((value) => value !== "");
      if (cells.length >= 2) {
        rows.push({ front: cells[0], back: cells[1] });
      }
    });
    return { rows, delimiter };
  }

  function detectDelimiter(lines) {
    const candidates = [",", ";", "|", "\t"];
    let best = ",";
    let bestScore = -1;
    candidates.forEach((delim) => {
      const score = lines.reduce((acc, line) => acc + (line.split(delim).length - 1), 0);
      if (score > bestScore) {
        bestScore = score;
        best = delim;
      }
    });
    return best;
  }

  function splitCsvLine(line, delimiter) {
    const cells = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === delimiter && !inQuotes) {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells;
  }

  function handleImportCsv() {
    const file = elements.csvFileInput.files && elements.csvFileInput.files[0];
    if (!file) {
      elements.importStatus.textContent = "Bitte eine CSV-Datei wählen.";
      return;
    }
    const targetDeck = state.decks.find((d) => d.id === elements.csvDeckSelect.value);
    if (!targetDeck) {
      elements.importStatus.textContent = "Kein Ziel-Stapel ausgewählt.";
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const { rows, delimiter } = parseCsv(event.target.result);
      if (rows.length === 0) {
        elements.importStatus.textContent = "Keine gültigen Zeilen gefunden (erwarte mindestens 2 Spalten).";
        return;
      }
      rows.forEach((row) => {
        targetDeck.cards.push({
          id: `card-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          front: row.front,
          back: row.back,
          deckId: targetDeck.id,
          createdAt: Date.now(),
          due: Date.now(),
          easeFactor: 2.5,
          intervalDays: 0,
          reviewCount: 0,
        });
      });
      const delimiterLabel = delimiter === "\t" ? "Tab" : delimiter;
      elements.importStatus.textContent = `${rows.length} Karten importiert (Trennung: ${delimiterLabel}).`;
      state.activeDeckId = targetDeck.id;
      setModalState(elements.csvModal, false);
      buildQueue(true);
      saveState();
      render();
      elements.csvFileInput.value = "";
    };
    reader.readAsText(file);
  }

  function showUpcoming() {
    const deck = getActiveDeck();
    if (!deck) return;
    const now = Date.now();
    const list = deck.cards
      .slice()
      .sort((a, b) => (a.due || now) - (b.due || now))
      .slice(0, 5)
      .map((card) => {
        const dueText = card.due ? formatDateTime(card.due) : "kein Intervall";
        return `• ${card.front.slice(0, 80)} – ${dueText}`;
      })
      .join("\n");
    elements.reviewStats.textContent = list || "Keine Karten im Stapel.";
  }

  function render() {
    renderDeckList();
    renderSelects();
    renderActiveDeckMeta();
    renderCardList();
    renderReview();
    applyKatex();
  }

  function init() {
    loadState();
    buildQueue(true);
    render();

    elements.deckForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = elements.deckNameInput.value.trim();
      const desc = elements.deckDescriptionInput.value.trim();
      if (!name) return;
      const newDeck = {
        id: `deck-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        description: desc,
        cards: [],
      };
      state.decks.push(newDeck);
      state.activeDeckId = newDeck.id;
      elements.deckForm.reset();
      buildQueue(true);
      saveState();
      render();
    });

    elements.focusDeckNameBtn.addEventListener("click", () => {
      elements.deckNameInput.focus();
    });

    elements.cardForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const deckId = elements.cardDeckSelect.value;
      const deck = state.decks.find((d) => d.id === deckId);
      if (!deck) return;
      const front = elements.cardFrontInput.value.trim();
      const back = elements.cardBackInput.value.trim();
      if (!front || !back) return;
      const card = {
        id: `card-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        deckId,
        front,
        back,
        createdAt: Date.now(),
        due: Date.now(),
        intervalDays: 0,
        easeFactor: 2.5,
        reviewCount: 0,
      };
      deck.cards.push(card);
      state.activeDeckId = deckId;
      elements.cardForm.reset();
      setModalState(elements.cardModal, false);
      buildQueue(true);
      saveState();
      render();
    });

    elements.prefillActiveFrontBtn.addEventListener("click", () => {
      const deck = getActiveDeck();
      if (!deck) return;
      elements.cardFrontInput.value = deck.name + " – ";
      elements.cardFrontInput.focus();
    });

    const openCardModal = () => setModalState(elements.cardModal, true);
    const closeCardModal = () => setModalState(elements.cardModal, false);
    const openCsvModal = () => setModalState(elements.csvModal, true);
    const closeCsvModal = () => setModalState(elements.csvModal, false);

    elements.openCardModalBtn.addEventListener("click", openCardModal);
    elements.closeCardModalBtn.addEventListener("click", closeCardModal);
    elements.cardModalBackdrop.addEventListener("click", closeCardModal);

    elements.openCsvModalBtn.addEventListener("click", openCsvModal);
    elements.closeCsvModalBtn.addEventListener("click", closeCsvModal);
    elements.csvModalBackdrop.addEventListener("click", closeCsvModal);

    elements.importCsvBtn.addEventListener("click", handleImportCsv);
    elements.clearCsvBtn.addEventListener("click", () => {
      elements.csvFileInput.value = "";
      elements.importStatus.textContent = "";
    });

    elements.modeNormalBtn.addEventListener("click", () => setMode("normal"));
    elements.modeIntervalBtn.addEventListener("click", () => setMode("interval"));

    elements.showAnswerBtn.addEventListener("click", () => {
      state.showAnswer = true;
      renderReview();
    });

    elements.markKnownBtn.addEventListener("click", () => handleNormalReview(true));
    elements.markRepeatBtn.addEventListener("click", () => handleNormalReview(false));

    elements.intervalActions.querySelectorAll("[data-rating]").forEach((btn) => {
      btn.addEventListener("click", () => handleIntervalReview(btn.dataset.rating));
    });

    elements.rebuildQueueBtn.addEventListener("click", () => {
      buildQueue(true);
      render();
    });

    elements.showUpcomingBtn.addEventListener("click", () => showUpcoming());

    window.addEventListener("keydown", (event) => {
      if (event.key === " ") {
        event.preventDefault();
        if (!state.showAnswer) {
          state.showAnswer = true;
          renderReview();
        }
      }
    });
  }

  init();
})();
