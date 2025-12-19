(() => {
  const storageKey = "studyFlashcards_v1";
  const Storage = window.StudyPlanner && window.StudyPlanner.Storage ? window.StudyPlanner.Storage : null;

  const elementKeys = [
    "deckList",
    "deckForm",
    "deckNameInput",
    "deckDescriptionInput",
    "csvFileInput",
    "csvDeckSelect",
    "csvDelimiterSelect",
    "importCsvBtn",
    "clearCsvBtn",
    "importStatus",
    "cardForm",
    "cardDeckSelect",
    "cardFrontInput",
    "cardBackInput",
    "prefillActiveFrontBtn",
    "openCardModalBtnSecondary",
    "closeCardModalBtn",
    "cardModal",
    "cardModalBackdrop",
    "activeDeckTitle",
    "activeDeckMeta",
    "deckStats",
    "cardList",
    "cardSearchInput",
    "bulkDeleteBtn",
    "modeNormalBtn",
    "modeIntervalBtn",
    "reviewDeckSelect",
    "fullReviewBtn",
    "reviewModeLabel",
    "reviewStats",
    "reviewCard",
    "reviewFront",
    "reviewBack",
    "showAnswerBtn",
    "normalActions",
    "intervalActions",
    "markKnownBtn",
    "markRepeatBtn",
    "rebuildQueueBtn",
    "showUpcomingBtn",
    "startReviewBtn",
    "reviewProgress",
    "closeCsvModalBtn",
    "csvModal",
    "csvModalBackdrop",
    "csvForm",
    "csvPreview",
    "csvError",
    "csvStatus",
    "cardHintInput",
    "cardFormStatus",
    "sessionHeaderMount",
    "deckModal",
    "deckModalBackdrop",
    "closeDeckModalBtn",
    "deckFormStatus",
    "deckListModal",
    "deckListModalBackdrop",
    "closeDeckListModalBtn",
    "deckModalList",
    "openManageModalBtn",
    "manageModal",
    "manageModalBackdrop",
    "closeManageModalBtn",
    "manageOpenCsvBtn",
    "manageExportBtn",
    "manageNewDeckBtn",
    "manageViewDecksBtn",
    "manageNewCardBtn",
  ];

  const elements = {};
  const missingElements = [];

  function cacheElements() {
    missingElements.length = 0;
    elementKeys.forEach((key) => {
      elements[key] = document.getElementById(key);
      if (!elements[key]) missingElements.push(key);
    });
  }

  function on(el, event, handler) {
    if (!el || !el.addEventListener) return () => {};
    el.addEventListener(event, handler);
    return () => el.removeEventListener(event, handler);
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text == null ? "" : String(text);
  }

  function setHTML(el, html) {
    if (!el) return;
    el.innerHTML = html == null ? "" : String(html);
  }

  function toggleClass(el, className, force) {
    if (!el) return;
    el.classList.toggle(className, force);
  }

  const CARD_LIST_PAGE_SIZE = 200;
  const KATEX_DELIMITERS = [
    { left: "$$", right: "$$", display: true },
    { left: "$", right: "$", display: false },
    { left: "\\(", right: "\\)", display: false },
    { left: "\\[", right: "\\]", display: true },
  ];

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
    cardListLimit: CARD_LIST_PAGE_SIZE,
    reviewQueue: [],
    currentCard: null,
    showAnswer: false,
    reviewDone: 0,
    reviewKnown: 0,
    reviewTotal: 0,
    editingCardId: null,
    selectedCardIds: new Set(),
    cardSearch: "",
    csvCandidate: null,
    searchTimer: null,
    sessionHeader: null,
    sessionStartedHere: false,
  };

  function updateSessionHeaderContext() {
    if (!state.sessionHeader) return;
    const deck = getActiveDeck();
    state.sessionHeader.setContext?.({
      source: "flashcards",
      deckId: deck ? deck.id : null,
      mode: state.mode,
      minMs: 0,
    });
  }

  function ensureSessionHeader() {
    if (state.sessionHeader || !elements.sessionHeaderMount) return;
    const mount = window.StudyPlanner && window.StudyPlanner.mountSessionHeader ? window.StudyPlanner.mountSessionHeader : null;
    if (!mount) return;
    state.sessionHeader = mount({
      mountEl: elements.sessionHeaderMount,
      variant: "compact",
      context: { source: "flashcards", mode: state.mode, minMs: 0 },
    });
    updateSessionHeaderContext();
  }

  function startFlashcardsTimer() {
    ensureSessionHeader();
    updateSessionHeaderContext();
    state.sessionStartedHere = true;
    state.sessionHeader?.start?.();
  }

  function pauseFlashcardsTimer(reason = "manual") {
    state.sessionStartedHere = false;
    state.sessionHeader?.pause?.(reason);
  }

  function stopFlashcardsTimer(reason = "manual") {
    if (!state.sessionHeader) return;
    state.sessionStartedHere = false;
    // Pause first to capture elapsed, then stop to persist session to journal.
    state.sessionHeader.pause?.(reason);
    state.sessionHeader.stop?.();
  }

  function ensureReviewTimerRunning() {
    if (state.sessionStartedHere) return;
    startFlashcardsTimer();
  }

  function computeReviewTotal() {
    const remaining = (state.currentCard ? 1 : 0) + (state.reviewQueue ? state.reviewQueue.length : 0);
    return Math.max(0, remaining);
  }

  function resetReviewCounters() {
    state.reviewDone = 0;
    state.reviewKnown = 0;
    state.reviewTotal = computeReviewTotal();
  }

  function ensureReviewSession() {
    if (!state.reviewTotal) resetReviewCounters();
    ensureReviewTimerRunning();
  }

  function toggleReviewMaximize(force) {
    const next = typeof force === "boolean" ? force : !document.body.classList.contains("is-review-maximized");
    toggleClass(document.body, "is-review-maximized", next);
    if (elements.fullReviewBtn) {
      elements.fullReviewBtn.setAttribute("aria-pressed", next ? "true" : "false");
      setText(elements.fullReviewBtn, next ? "Vollbild beenden" : "Vollbild-Abfrage");
    }
    if (next) {
      (elements.showAnswerBtn || elements.reviewCard || elements.reviewPanel)?.focus?.();
    }
  }

  function isInteractiveTarget(target) {
    const el = target && target.nodeType === 1 ? target : null;
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON";
  }

  function setStatus(el, message, { tone = "neutral" } = {}) {
    if (!el) return;
    setText(el, message ? String(message) : "");
    if (tone === "danger") el.style.color = "rgba(185, 28, 28, 0.95)";
    else if (tone === "good") el.style.color = "rgba(15, 118, 110, 0.95)";
    else el.style.color = "";
  }

  function setModalState(modalEl, open) {
    if (!modalEl) return;
    toggleClass(modalEl, "is-open", open);
    modalEl.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function openDeckModal() {
    setStatus(elements.deckFormStatus, "");
    setModalState(elements.deckModal, true);
    focusFirstField(elements.deckModal);
  }

  function closeDeckModal() {
    setModalState(elements.deckModal, false);
  }

  function openDeckListModal() {
    renderDeckModalList();
    setModalState(elements.deckListModal, true);
  }

  function closeDeckListModal() {
    setModalState(elements.deckListModal, false);
  }

  function focusFirstField(containerEl) {
    if (!containerEl) return;
    const candidate = containerEl.querySelector("textarea, input, select, button");
    if (candidate) candidate.focus();
  }

  function normalizeCard(raw, deckId) {
    const now = Date.now();
    const card = raw && typeof raw === "object" ? { ...raw } : {};
    if (!card.id) card.id = `card-${now}-${Math.random().toString(16).slice(2)}`;
    card.deckId = card.deckId || deckId || null;
    card.front = String(card.front || "");
    card.back = String(card.back || "");
    if (card.hint != null) card.hint = String(card.hint);
    else card.hint = "";
    card.createdAt = Number(card.createdAt || now) || now;
    if (card.due != null) card.due = Number(card.due) || 0;
    if (card.lastReviewed != null) card.lastReviewed = Number(card.lastReviewed) || 0;
    if (card.reviewCount != null) card.reviewCount = Number(card.reviewCount) || 0;
    if (card.intervalDays != null) card.intervalDays = Number(card.intervalDays) || 0;
    if (card.easeFactor != null) card.easeFactor = Number(card.easeFactor) || 2.5;
    if (card.lapses != null) card.lapses = Number(card.lapses) || 0;
    return card;
  }

  function normalizeDeck(raw) {
    const deck = raw && typeof raw === "object" ? { ...raw } : {};
    if (!deck.id) deck.id = `deck-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    deck.name = String(deck.name || "Deck");
    deck.description = String(deck.description || "");
    const cards = Array.isArray(deck.cards) ? deck.cards : [];
    deck.cards = cards.map((c) => normalizeCard(c, deck.id));
    return deck;
  }

  function loadState() {
    try {
      const saved = Storage ? Storage.getRaw(storageKey, null) : localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const decks = Array.isArray(parsed.decks) ? parsed.decks.map(normalizeDeck) : [];
        state.decks = decks.length ? decks : [];
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
    if (Storage) Storage.setJSON(storageKey, payload, { debounceMs: 150 });
    else localStorage.setItem(storageKey, JSON.stringify(payload));
  }

  function getActiveDeck() {
    return state.decks.find((deck) => deck.id === state.activeDeckId) || state.decks[0];
  }

  function setActiveDeck(deckId) {
    state.activeDeckId = deckId;
    state.editingCardId = null;
    state.selectedCardIds.clear();
    state.cardSearch = "";
    state.cardListLimit = CARD_LIST_PAGE_SIZE;
    if (elements.cardSearchInput) elements.cardSearchInput.value = "";
    buildQueue();
    resetReviewCounters();
    saveState();
    render();
    updateSessionHeaderContext();
  }

  function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  function summarizeDeck(deck) {
    const now = Date.now();
    const total = deck.cards.length;
    let due = 0;
    let newCards = 0;
    for (let i = 0; i < deck.cards.length; i += 1) {
      const card = deck.cards[i];
      if (!card.due || card.due <= now) due += 1;
      if (!card.reviewCount || card.reviewCount === 0) newCards += 1;
    }
    return { total, due, newCards };
  }

  function renderDeckList() {
    if (!elements.deckList) return;
    const deck = getActiveDeck();
    elements.deckList.replaceChildren();
    if (elements.reviewDeckSelect) {
      setHTML(elements.reviewDeckSelect, "");
      state.decks.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = d.name;
        if (deck && deck.id === d.id) opt.selected = true;
        elements.reviewDeckSelect.appendChild(opt);
      });
    }
    if (!state.decks.length) {
      const empty = document.createElement("div");
      empty.className = "cards-empty-cta";
      empty.textContent = "Keine Stapel vorhanden.";
      const actions = document.createElement("div");
      actions.className = "cards-empty-actions";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn";
      btn.textContent = "+ Neuer Stapel";
      btn.addEventListener("click", () => {
        openDeckModal();
      });
      actions.appendChild(btn);
      empty.appendChild(actions);
      elements.deckList.appendChild(empty);
      return;
    }
    state.decks.forEach((d) => {
      const stats = summarizeDeck(d);
      const item = document.createElement("div");
      item.className = `deck-list-item ${deck && deck.id === d.id ? "deck-list-item-active" : ""}`;
      item.dataset.deckId = d.id;
      item.setAttribute("role", "button");
      item.tabIndex = 0;

      const info = document.createElement("div");
      info.className = "deck-list-info";
      const title = document.createElement("div");
      title.className = "deck-list-title";
      title.textContent = d.name || "Deck";

      const subtitle = document.createElement("div");
      subtitle.className = "deck-list-subtitle";
      subtitle.textContent = d.description || "Ohne Notiz";

      const meta = document.createElement("div");
      meta.className = "deck-list-meta";
      meta.textContent = `${stats.total} Karten • ${stats.due} fällig • ${stats.newCards} neu`;

      info.appendChild(title);
      info.appendChild(subtitle);
      info.appendChild(meta);

      const learnBtn = document.createElement("button");
      learnBtn.type = "button";
      learnBtn.className = "deck-list-learn";
      learnBtn.dataset.action = "learn";
      learnBtn.textContent = "Lernen";

      item.appendChild(info);
      item.appendChild(learnBtn);
      elements.deckList.appendChild(item);
    });
  }

  function renderDeckModalList() {
    if (!elements.deckModalList) return;
    elements.deckModalList.replaceChildren();
    if (!state.decks.length) {
      const empty = document.createElement("div");
      empty.className = "deck-list-empty";
      empty.textContent = "Keine Stapel vorhanden.";
      elements.deckModalList.appendChild(empty);
      return;
    }
    state.decks.forEach((deck) => {
      const stats = summarizeDeck(deck);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "deck-modal-row";
      row.dataset.deckId = deck.id;
      const title = document.createElement("div");
      title.className = "deck-modal-title";
      title.textContent = deck.name || "Deck";
      const meta = document.createElement("div");
      meta.className = "deck-modal-meta";
      meta.textContent = `${stats.total} Karten • ${stats.due} fällig • ${stats.newCards} neu`;
      row.append(title, meta);
      elements.deckModalList.appendChild(row);
    });
  }

  function renderSelects() {
    const selectTargets = [elements.cardDeckSelect, elements.csvDeckSelect].filter(Boolean);
    if (!selectTargets.length) return;
    selectTargets.forEach((select) => {
      setHTML(select, "");
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
      setText(elements.activeDeckTitle, "Kein Stapel");
      setText(elements.activeDeckMeta, "0 Karten • 0 fällig");
      if (elements.deckStats) setText(elements.deckStats, "");
      return;
    }
    const { total, due, newCards } = summarizeDeck(deck);
    setText(elements.activeDeckTitle, deck.name);
    setText(elements.activeDeckMeta, `${total} Karten • ${due} fällig • ${newCards} neu`);
    if (elements.deckStats) setText(elements.deckStats, `${total} Karten insgesamt`);
  }

  function renderCardList() {
    if (!elements.cardList) return;
    const deck = getActiveDeck();
    elements.cardList.replaceChildren();
    if (!deck || deck.cards.length === 0) {
      const wrap = document.createElement("div");
      wrap.className = "cards-empty-cta";

      const headline = document.createElement("div");
      headline.style.fontWeight = "800";
      headline.textContent = "Noch keine Karten in diesem Stapel.";

      const hint = document.createElement("div");
      hint.style.color = "var(--ink-muted)";
      hint.textContent = "Starte mit einer Karte oder importiere CSV (Spalten: Vorderseite, Rückseite, optional Hinweis).";

      const actions = document.createElement("div");
      actions.className = "cards-empty-actions";

      const createBtn = document.createElement("button");
      createBtn.className = "btn";
      createBtn.type = "button";
      createBtn.textContent = "Erste Karte anlegen";
      createBtn.addEventListener("click", () => {
        state.editingCardId = null;
        elements.cardForm.reset();
        if (elements.cardDeckSelect && state.activeDeckId) elements.cardDeckSelect.value = state.activeDeckId;
        setStatus(elements.cardFormStatus, "");
        setModalState(elements.cardModal, true);
        focusFirstField(elements.cardModal);
      });

      const importBtn = document.createElement("button");
      importBtn.className = "btn btn-secondary";
      importBtn.type = "button";
      importBtn.textContent = "CSV importieren";
      importBtn.addEventListener("click", () => {
        setStatus(elements.csvStatus, "");
        elements.csvPreview.hidden = true;
        elements.csvError.hidden = true;
        setModalState(elements.csvModal, true);
        focusFirstField(elements.csvModal);
      });

      actions.appendChild(createBtn);
      actions.appendChild(importBtn);

      wrap.appendChild(headline);
      wrap.appendChild(hint);
      wrap.appendChild(actions);
      elements.cardList.appendChild(wrap);
      return;
    }

    const query = String(state.cardSearch || "").trim().toLowerCase();
    const now = Date.now();
    const limit = state.cardListLimit || CARD_LIST_PAGE_SIZE;
    const results = [];
    for (let i = deck.cards.length - 1; i >= 0; i -= 1) {
      if (results.length >= limit + 1) break;
      const card = deck.cards[i];
      if (!card) continue;
      if (query) {
        const haystack = `${card.front || ""}\n${card.back || ""}\n${card.hint || ""}`.toLowerCase();
        if (!haystack.includes(query)) continue;
      }
      results.push(card);
    }

    const hasMore = results.length > limit;
    if (hasMore) results.length = limit;

    if (!results.length) {
      const empty = document.createElement("div");
      empty.className = "card-list-empty";
      empty.textContent = "Keine Treffer. Passe die Suche an oder lösche den Filter.";
      elements.cardList.appendChild(empty);
      return;
    }

    results.forEach((card) => {
      const item = document.createElement("div");
      item.className = "card-list-item";
      item.dataset.cardId = card.id;

      if (state.selectedCardIds.has(card.id)) item.classList.add("card-selected");

      const isNew = !card.reviewCount;
      const isDue = !card.due || card.due <= now;
      const badge = document.createElement("div");
      badge.className = "card-badge";
      if (isNew) {
        badge.classList.add("new");
        badge.textContent = "Neu";
      } else if (isDue) {
        badge.classList.add("due");
        badge.textContent = "Fällig";
      } else {
        badge.classList.add("learning");
        badge.textContent = "Lernen";
      }

      const meta = document.createElement("div");
      meta.className = "card-list-meta";
      meta.textContent = card.due ? `Fällig: ${formatDateTime(card.due)}` : "Noch kein Intervall";

      const front = document.createElement("div");
      front.className = "card-list-front";
      front.textContent = card.front || "";

      const back = document.createElement("div");
      back.className = "card-list-back";
      back.textContent = card.back || "";

      const hint = document.createElement("div");
      hint.className = "card-list-meta";
      hint.textContent = card.hint ? `Hinweis: ${card.hint}` : "";

      const select = document.createElement("input");
      select.type = "checkbox";
      select.className = "card-select";
      select.checked = state.selectedCardIds.has(card.id);
      select.setAttribute("aria-label", "Karte auswählen");
      select.dataset.action = "select";

      const editBtn = document.createElement("button");
      editBtn.className = "icon-btn icon-btn-ghost card-edit-btn";
      editBtn.type = "button";
      editBtn.title = "Karte bearbeiten";
      editBtn.setAttribute("aria-label", "Karte bearbeiten");
      editBtn.textContent = "✎";
      editBtn.dataset.action = "edit";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "icon-btn icon-btn-ghost card-delete-btn";
      deleteBtn.type = "button";
      deleteBtn.title = "Karte löschen";
      deleteBtn.setAttribute("aria-label", "Karte löschen");
      deleteBtn.textContent = "✕";
      deleteBtn.dataset.action = "delete";

      item.appendChild(badge);
      item.appendChild(front);
      item.appendChild(back);
      if (card.hint) item.appendChild(hint);
      item.appendChild(meta);
      item.appendChild(select);
      item.appendChild(editBtn);
      item.appendChild(deleteBtn);

      elements.cardList.appendChild(item);
    });

    if (hasMore) {
      const loadMore = document.createElement("button");
      loadMore.type = "button";
      loadMore.className = "btn btn-secondary card-list-load-more";
      loadMore.textContent = "Mehr laden";
      loadMore.addEventListener("click", () => {
        state.cardListLimit = (state.cardListLimit || CARD_LIST_PAGE_SIZE) + CARD_LIST_PAGE_SIZE;
        renderCardList();
        refreshSelectionFromDom();
      });
      elements.cardList.appendChild(loadMore);
    }

    applyKatex(elements.cardList);
  }

  function setMode(mode) {
    state.mode = mode;
    elements.modeNormalBtn.classList.toggle("mode-btn-active", mode === "normal");
    elements.modeIntervalBtn.classList.toggle("mode-btn-active", mode === "interval");
    elements.reviewModeLabel.textContent = mode === "interval" ? "Intervall (Anki-ähnlich)" : "Normaler Durchgang";
    state.showAnswer = false;
    buildQueue();
    resetReviewCounters();
    saveState();
    renderReview();
    updateSessionHeaderContext();
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
    if (!elements.reviewFront || !elements.reviewBack || !elements.reviewStats) return;
    const deck = getActiveDeck();
    const now = Date.now();
    if (!deck || deck.cards.length === 0) {
      setText(elements.reviewFront, "Lege Karten an, um zu starten.");
      setText(elements.reviewBack, "");
      setText(elements.reviewStats, "Keine Karten vorhanden.");
      if (elements.startReviewBtn) elements.startReviewBtn.disabled = true;
      if (elements.reviewProgress) elements.reviewProgress.textContent = "";
      elements.reviewBack?.classList.remove("review-back-visible");
      if (elements.showAnswerBtn) elements.showAnswerBtn.disabled = true;
      toggleActionButtons(false);
      return;
    }

    const { due } = summarizeDeck(deck);
    setText(
      elements.reviewStats,
      state.mode === "interval" ? `${due} fällig • alle Zeiten nach Feedback` : `${deck.cards.length} Karten bereit`
    );
    if (elements.startReviewBtn) {
      const canStart = deck.cards.length > 0;
      elements.startReviewBtn.disabled = !canStart;
    }
    if (elements.reviewProgress) {
      const total = state.reviewTotal || 0;
      setText(elements.reviewProgress, total ? `${state.reviewKnown} / ${total}` : "");
    }

    if (!state.currentCard) {
      setText(
        elements.reviewFront,
        due === 0 && state.mode === "interval"
          ? "Gerade nichts fällig. Schau dir die nächsten Karten an oder ändere den Modus."
          : "Keine Karte geladen. Mische neu, um zu starten."
      );
      setText(elements.reviewBack, "");
      elements.reviewBack.classList.remove("review-back-visible");
      if (elements.showAnswerBtn) elements.showAnswerBtn.disabled = true;
      if (elements.reviewProgress) setText(elements.reviewProgress, "");
      toggleActionButtons(false);
      return;
    }

    elements.showAnswerBtn.disabled = false;
    setText(elements.reviewFront, state.currentCard.front);
    setText(elements.reviewBack, state.currentCard.back);
    elements.reviewBack.classList.toggle("review-back-visible", state.showAnswer);
    toggleActionButtons(state.showAnswer);
    applyKatex(elements.reviewCard);
  }

  function applyKatex(scopeEl) {
    if (!scopeEl || !window.renderMathInElement) return;
    renderMathInElement(scopeEl, { delimiters: KATEX_DELIMITERS, throwOnError: false });
  }

  function toggleActionButtons(show) {
    if (!elements.normalActions || !elements.intervalActions) return;
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
    renderReview();
    renderActiveDeckMeta();
    renderDeckList();
    renderDeckModalList();
  }

  function handleNormalReview(known) {
    if (!state.currentCard) return;
    ensureReviewSession();
    const card = state.currentCard;
    card.lastReviewed = Date.now();
    if (!card.reviewCount) card.reviewCount = 0;
    card.reviewCount += 1;
    if (!known) {
      state.reviewQueue.push(card);
    } else {
      state.reviewKnown += 1;
    }
    state.reviewDone += 1;
    saveState();
    moveToNextCard();
  }

  function handleIntervalReview(rating) {
    if (!state.currentCard) return;
    ensureReviewSession();
    scheduleCardInterval(state.currentCard, rating);
    if (rating !== "again") state.reviewKnown += 1;
    state.reviewDone += 1;
    saveState();
    moveToNextCard();
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const chosen = elements.csvDelimiterSelect ? elements.csvDelimiterSelect.value : "auto";
    const delimiter = chosen === "auto" ? detectDelimiter(lines) : chosen === "tab" ? "\t" : chosen;
    const rows = [];
    let invalid = 0;
    lines.forEach((line) => {
      const cells = splitCsvLine(line, delimiter).map((part) => part.trim().replace(/^"|"$/g, ""));
      if (cells.length >= 2 && (cells[0].trim() || cells[1].trim())) {
        rows.push({ front: cells[0], back: cells[1], hint: cells[2] || "" });
      } else {
        invalid += 1;
      }
    });
    return { rows, delimiter, invalid, totalLines: lines.length };
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
    const candidate = state.csvCandidate;
    if (!candidate || !Array.isArray(candidate.rows)) {
      setStatus(elements.csvStatus, "Bitte zuerst eine CSV-Datei auswählen.", { tone: "danger" });
      return;
    }
    const file = elements.csvFileInput.files && elements.csvFileInput.files[0];
    if (!file) {
      setStatus(elements.csvStatus, "Bitte eine CSV-Datei wählen.", { tone: "danger" });
      return;
    }
    const targetDeck = state.decks.find((d) => d.id === elements.csvDeckSelect.value);
    if (!targetDeck) {
      setStatus(elements.csvStatus, "Kein Ziel-Stapel ausgewählt.", { tone: "danger" });
      return;
    }
    if (!candidate.rows.length) {
      setStatus(elements.csvStatus, "Keine gültigen Zeilen gefunden (erwarte mindestens 2 Spalten).", { tone: "danger" });
      return;
    }
    const delimiterLabel = candidate.delimiter === "\t" ? "Tab" : candidate.delimiter;
    const confirmText = `Importiere ${candidate.rows.length} Karten in „${targetDeck.name}“? (Trennung: ${delimiterLabel})`;
    if (!window.confirm(confirmText)) return;

    candidate.rows.forEach((row) => {
      targetDeck.cards.push(
        normalizeCard(
          {
            id: `card-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            front: row.front,
            back: row.back,
            hint: row.hint || "",
            deckId: targetDeck.id,
            createdAt: Date.now(),
            due: Date.now(),
            easeFactor: 2.5,
            intervalDays: 0,
            reviewCount: 0,
          },
          targetDeck.id
        )
      );
    });

    setStatus(elements.importStatus, `${candidate.rows.length} Karten importiert (Trennung: ${delimiterLabel}).`, { tone: "good" });
    setStatus(elements.csvStatus, `Import abgeschlossen: ${candidate.rows.length} Karten.`, { tone: "good" });
    state.activeDeckId = targetDeck.id;
    state.cardListLimit = CARD_LIST_PAGE_SIZE;
    setModalState(elements.csvModal, false);
    buildQueue(true);
    resetReviewCounters();
    saveState();
    render();
    elements.csvFileInput.value = "";
    state.csvCandidate = null;
    renderCsvPreview(null);
  }

  function renderCsvPreview(candidate) {
    if (!elements.csvPreview || !elements.csvError) return;
    if (!candidate) {
      elements.csvPreview.hidden = true;
      elements.csvError.hidden = true;
      elements.csvPreview.replaceChildren();
      setStatus(elements.csvStatus, "");
      return;
    }

    elements.csvPreview.replaceChildren();
    const previewWrap = document.createElement("div");
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Vorderseite", "Rückseite", "Hinweis"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    candidate.rows.slice(0, 6).forEach((row) => {
      const tr = document.createElement("tr");
      const cells = [row.front, row.back, row.hint || ""];
      cells.forEach((value) => {
        const td = document.createElement("td");
        td.textContent = String(value || "");
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    previewWrap.appendChild(table);
    elements.csvPreview.appendChild(previewWrap);
    elements.csvPreview.hidden = false;

    const delimiterLabel = candidate.delimiter === "\t" ? "Tab" : candidate.delimiter;
    setStatus(elements.csvStatus, `${candidate.rows.length} gültige Zeilen • Trennung: ${delimiterLabel}`, {
      tone: candidate.rows.length ? "neutral" : "danger",
    });

    if (candidate.invalid) {
      elements.csvError.textContent = `${candidate.invalid} Zeilen ignoriert (brauchen mindestens 2 Spalten).`;
      elements.csvError.hidden = false;
    } else {
      elements.csvError.textContent = "";
      elements.csvError.hidden = true;
    }
  }

  function updateCsvCandidate() {
    const file = elements.csvFileInput.files && elements.csvFileInput.files[0];
    if (!file) {
      state.csvCandidate = null;
      renderCsvPreview(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target.result || "");
      const candidate = parseCsv(text);
      state.csvCandidate = candidate;
      renderCsvPreview(candidate);
    };
    reader.onerror = () => {
      state.csvCandidate = null;
      renderCsvPreview(null);
      setStatus(elements.csvStatus, "CSV konnte nicht gelesen werden.", { tone: "danger" });
    };
    reader.readAsText(file);
  }

  function exportActiveDeckCsv() {
    const deck = getActiveDeck();
    if (!deck) {
      setStatus(elements.importStatus, "Kein Stapel ausgewählt.", { tone: "danger" });
      return;
    }
    if (!deck.cards || !deck.cards.length) {
      setStatus(elements.importStatus, "Dieser Stapel enthält keine Karten zum Export.", { tone: "danger" });
      return;
    }
    const escapeCell = (value) => {
      const raw = String(value == null ? "" : value);
      const needsQuotes = /[",\n\r]/.test(raw);
      const escaped = raw.replace(/"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    };
    const header = ["front", "back", "hint"];
    const lines = [header.join(",")];
    deck.cards.forEach((card) => {
      lines.push([escapeCell(card.front), escapeCell(card.back), escapeCell(card.hint || "")].join(","));
    });
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = String(deck.name || "deck").replace(/[^\w\d-_]+/g, "_").slice(0, 40) || "deck";
    a.download = `studyplanner_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus(elements.importStatus, `CSV exportiert: ${deck.cards.length} Karten.`, { tone: "good" });
  }

  function openEditCard(cardId) {
    const deck = getActiveDeck();
    if (!deck) return;
    const card = deck.cards.find((c) => c.id === cardId);
    if (!card) return;
    state.editingCardId = card.id;
    elements.cardForm.reset();
    if (elements.cardDeckSelect) elements.cardDeckSelect.value = deck.id;
    elements.cardFrontInput.value = card.front || "";
    elements.cardBackInput.value = card.back || "";
    if (elements.cardHintInput) elements.cardHintInput.value = card.hint || "";
    setStatus(elements.cardFormStatus, "Bearbeiten: Änderungen speichern, um zu übernehmen.");
    setModalState(elements.cardModal, true);
    focusFirstField(elements.cardModal);
  }

  function deleteCardById(cardId) {
    const deck = getActiveDeck();
    if (!deck) return false;
    const before = deck.cards.length;
    deck.cards = deck.cards.filter((c) => c.id !== cardId);
    if (deck.cards.length === before) return false;
    state.selectedCardIds.delete(cardId);
    buildQueue(true);
    saveState();
    render();
    return true;
  }

  function deleteSelectedCards() {
    const deck = getActiveDeck();
    if (!deck) return;
    const ids = Array.from(state.selectedCardIds || []);
    if (!ids.length) return;
    if (!window.confirm(`${ids.length} ausgewählte Karten löschen?`)) return;
    const keep = new Set(ids);
    deck.cards = deck.cards.filter((c) => !keep.has(c.id));
    state.selectedCardIds.clear();
    buildQueue(true);
    saveState();
    render();
  }

  function toggleSelected(cardId, selected) {
    if (!cardId) return;
    if (selected) state.selectedCardIds.add(cardId);
    else state.selectedCardIds.delete(cardId);
    if (elements.bulkDeleteBtn) elements.bulkDeleteBtn.disabled = state.selectedCardIds.size === 0;
  }

  function refreshSelectionFromDom() {
    if (!elements.cardList) return;
    elements.cardList.querySelectorAll(".card-list-item").forEach((el) => {
      const id = el.dataset.cardId;
      const selected = id && state.selectedCardIds.has(id);
      el.classList.toggle("card-selected", !!selected);
      const checkbox = el.querySelector("input.card-select");
      if (checkbox) checkbox.checked = !!selected;
    });
  }

  function startReview() {
    buildQueue(true);
    resetReviewCounters();
    renderReview();
    if (elements.showAnswerBtn) elements.showAnswerBtn.focus();
    startFlashcardsTimer();
  }

  function exitReview() {
    state.showAnswer = false;
    state.currentCard = null;
    state.reviewQueue = [];
    state.reviewDone = 0;
    state.reviewKnown = 0;
    state.reviewTotal = 0;
    stopFlashcardsTimer("exit-review");
    toggleReviewMaximize(false);
    render();
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
    renderDeckModalList();
    renderActiveDeckMeta();
    renderCardList();
    renderReview();
    if (elements.bulkDeleteBtn) elements.bulkDeleteBtn.disabled = state.selectedCardIds.size === 0;
  }

  function init() {
    cacheElements();
    if (missingElements.length) {
      console.warn("[karteikarten] Missing elements (non-blocking):", missingElements);
    }
    loadState();
    buildQueue(true);
    render();
    ensureSessionHeader();
    updateSessionHeaderContext();

    // Deep links: open a deck and optionally start review.
    try {
      const params = new URLSearchParams(window.location.search || "");
      const deckId = params.get("deckId");
      const start = params.get("startReview");
      if (deckId && state.decks.some((d) => d.id === deckId)) {
        setActiveDeck(deckId);
      }
      if (start && (start === "1" || start === "true")) {
        startReview();
      }
    } catch {}

    on(elements.deckList, "click", (event) => {
      const actionBtn = event.target && event.target.closest ? event.target.closest("[data-action]") : null;
      const item = event.target && event.target.closest ? event.target.closest("[data-deck-id]") : null;
      if (!item) return;
      const id = item.dataset.deckId;
      if (!id) return;
      if (actionBtn && actionBtn.dataset.action === "learn") {
        setActiveDeck(id);
        startReview();
        elements.reviewCard?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        return;
      }
      setActiveDeck(id);
    });

    on(elements.deckList, "keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const actionBtn = event.target && event.target.closest ? event.target.closest("[data-action]") : null;
      if (actionBtn) return;
      const item = event.target && event.target.closest ? event.target.closest("[data-deck-id]") : null;
      if (!item) return;
      event.preventDefault();
      const id = item.dataset.deckId;
      if (!id) return;
      setActiveDeck(id);
    });

    on(elements.deckForm, "submit", (event) => {
      event.preventDefault();
      const nameInput = elements.deckNameInput.value.trim();
      const desc = elements.deckDescriptionInput.value.trim();
      if (!nameInput) {
        setStatus(elements.deckFormStatus, "Bitte Namen angeben.", { tone: "danger" });
        return;
      }
      let name = nameInput;
      let suffix = 2;
      while (state.decks.some((d) => d.name === name)) {
        name = `${nameInput} (${suffix})`;
        suffix += 1;
      }
      const newDeck = {
        id: `deck-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        description: desc,
        cards: [],
      };
      state.decks.push(newDeck);
      state.activeDeckId = newDeck.id;
      state.cardListLimit = CARD_LIST_PAGE_SIZE;
      elements.deckForm.reset();
      setStatus(elements.deckFormStatus, "Stapel gespeichert.", { tone: "good" });
      setModalState(elements.deckModal, false);
      buildQueue(true);
      saveState();
      render();
    });

    on(elements.cardForm, "submit", (event) => {
      event.preventDefault();
      const deckId = elements.cardDeckSelect.value;
      const deck = state.decks.find((d) => d.id === deckId);
      if (!deck) return;
      const front = elements.cardFrontInput.value.trim();
      const back = elements.cardBackInput.value.trim();
      if (!front || !back) return;
      const hint = elements.cardHintInput ? elements.cardHintInput.value.trim() : "";

      if (state.editingCardId) {
        let sourceDeck = null;
        let existing = null;
        for (const candidateDeck of state.decks) {
          const found = candidateDeck.cards.find((c) => c.id === state.editingCardId);
          if (found) {
            sourceDeck = candidateDeck;
            existing = found;
            break;
          }
        }
        if (existing) {
          existing.front = front;
          existing.back = back;
          existing.hint = hint;
          if (sourceDeck && sourceDeck.id !== deck.id) {
            sourceDeck.cards = sourceDeck.cards.filter((c) => c.id !== existing.id);
            existing.deckId = deck.id;
            deck.cards.push(existing);
          }
          setStatus(elements.cardFormStatus, "Karte aktualisiert.", { tone: "good" });
        } else state.editingCardId = null;
      }

      if (!state.editingCardId) {
        const card = normalizeCard(
          {
            id: `card-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            deckId,
            front,
            back,
            hint,
            createdAt: Date.now(),
            due: Date.now(),
            intervalDays: 0,
            easeFactor: 2.5,
            reviewCount: 0,
          },
          deckId
        );
        deck.cards.push(card);
        setStatus(elements.cardFormStatus, "Karte gespeichert.", { tone: "good" });
      }

      state.activeDeckId = deckId;
      elements.cardForm.reset();
      state.editingCardId = null;
      setModalState(elements.cardModal, false);
      buildQueue(true);
      resetReviewCounters();
      saveState();
      render();
    });

    on(elements.prefillActiveFrontBtn, "click", () => {
      const deck = getActiveDeck();
      if (!deck) return;
      elements.cardFrontInput.value = deck.name + " – ";
      elements.cardFrontInput.focus();
    });

    const openCardModal = () => setModalState(elements.cardModal, true);
    const closeCardModal = () => setModalState(elements.cardModal, false);
    const openCsvModal = () => setModalState(elements.csvModal, true);
    const closeCsvModal = () => {
      setModalState(elements.csvModal, false);
      if (elements.csvFileInput) elements.csvFileInput.value = "";
      state.csvCandidate = null;
      renderCsvPreview(null);
      setStatus(elements.csvStatus, "");
    };
    const openManageModal = () => setModalState(elements.manageModal, true);
    const closeManageModal = () => setModalState(elements.manageModal, false);

    const openCardForm = () => {
      state.editingCardId = null;
      elements.cardForm.reset();
      if (elements.cardDeckSelect && state.activeDeckId) elements.cardDeckSelect.value = state.activeDeckId;
      setStatus(elements.cardFormStatus, "");
      openCardModal();
      focusFirstField(elements.cardModal);
    };

    on(elements.openCardModalBtnSecondary, "click", openCardForm);
    on(elements.closeCardModalBtn, "click", () => {
      state.editingCardId = null;
      closeCardModal();
    });
    on(elements.cardModalBackdrop, "click", closeCardModal);

    on(elements.closeDeckModalBtn, "click", closeDeckModal);
    on(elements.deckModalBackdrop, "click", closeDeckModal);
    on(elements.deckListModalBackdrop, "click", closeDeckListModal);
    on(elements.closeDeckListModalBtn, "click", closeDeckListModal);
    on(elements.deckModalList, "click", (event) => {
      const row = event.target && event.target.closest ? event.target.closest(".deck-modal-row") : null;
      if (!row) return;
      const deckId = row.dataset.deckId;
      if (!deckId) return;
      setActiveDeck(deckId);
      closeDeckListModal();
    });

    on(elements.closeCsvModalBtn, "click", closeCsvModal);
    on(elements.csvModalBackdrop, "click", closeCsvModal);

    on(elements.importCsvBtn, "click", handleImportCsv);
    on(elements.clearCsvBtn, "click", () => {
      elements.csvFileInput.value = "";
      setStatus(elements.csvStatus, "");
      state.csvCandidate = null;
      renderCsvPreview(null);
    });

    on(elements.csvFileInput, "change", () => updateCsvCandidate());
    on(elements.csvDelimiterSelect, "change", () => {
      updateCsvCandidate();
    });

    on(elements.openManageModalBtn, "click", () => {
      openManageModal();
      focusFirstField(elements.manageModal);
    });
    on(elements.closeManageModalBtn, "click", closeManageModal);
    on(elements.manageModalBackdrop, "click", closeManageModal);
    on(elements.manageOpenCsvBtn, "click", () => {
      closeManageModal();
      setStatus(elements.csvStatus, "");
      elements.csvError.hidden = true;
      elements.csvPreview.hidden = true;
      openCsvModal();
      focusFirstField(elements.csvModal);
    });
    on(elements.manageExportBtn, "click", () => {
      closeManageModal();
      exportActiveDeckCsv();
    });
    on(elements.manageNewDeckBtn, "click", () => {
      closeManageModal();
      openDeckModal();
    });
    on(elements.manageViewDecksBtn, "click", () => {
      closeManageModal();
      openDeckListModal();
    });
    on(elements.manageNewCardBtn, "click", () => {
      closeManageModal();
      openCardForm();
    });

    document.addEventListener("click", (event) => {
      const target = event.target && event.target.closest ? event.target.closest("[data-manage-action]") : null;
      if (!target) return;
      const action = target.dataset.manageAction;
      if (action === "open") {
        openManageModal();
        focusFirstField(elements.manageModal);
      } else if (action === "close") {
        closeManageModal();
      }
    });

    on(elements.modeNormalBtn, "click", (event) => {
      event.preventDefault();
      setMode("normal");
    });
    on(elements.modeIntervalBtn, "click", (event) => {
      event.preventDefault();
      setMode("interval");
    });

    on(elements.showAnswerBtn, "click", (event) => {
      event.preventDefault();
      ensureReviewSession();
      state.showAnswer = true;
      renderReview();
    });

    on(elements.markKnownBtn, "click", (event) => {
      event.preventDefault();
      handleNormalReview(true);
    });
    on(elements.markRepeatBtn, "click", (event) => {
      event.preventDefault();
      handleNormalReview(false);
    });

    if (elements.intervalActions) {
      elements.intervalActions.querySelectorAll("[data-rating]").forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          handleIntervalReview(btn.dataset.rating);
        });
      });
    }

    if (elements.startReviewBtn)
      on(elements.startReviewBtn, "click", (event) => {
        event.preventDefault();
        startReview();
      });

    on(elements.rebuildQueueBtn, "click", (event) => {
      event.preventDefault();
      buildQueue(true);
      resetReviewCounters();
      render();
    });

    on(elements.showUpcomingBtn, "click", (event) => {
      event.preventDefault();
      showUpcoming();
    });

    on(elements.reviewDeckSelect, "change", (event) => {
      const id = event.target.value;
      if (id) setActiveDeck(id);
    });

    on(elements.fullReviewBtn, "click", (event) => {
      event.preventDefault();
      const id = elements.reviewDeckSelect?.value || state.activeDeckId;
      if (id) setActiveDeck(id);
      toggleReviewMaximize();
      startReview();
      setTimeout(() => {
        elements.reviewCard?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    });

    if (elements.quickAddForm) {
      on(elements.quickAddForm, "submit", (event) => {
        event.preventDefault();
        const deck = getActiveDeck();
        if (!deck) return;
        const front = String(elements.quickFrontInput.value || "").trim();
        const back = String(elements.quickBackInput.value || "").trim();
        const hint = String(elements.quickHintInput.value || "").trim();
        if (!front || !back) {
          setStatus(elements.quickAddStatus, "Bitte Vorder- und Rückseite ausfüllen.", { tone: "danger" });
          return;
        }
        deck.cards.push(
          normalizeCard(
            {
              id: `card-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              deckId: deck.id,
              front,
              back,
              hint,
              createdAt: Date.now(),
              due: Date.now(),
              intervalDays: 0,
              easeFactor: 2.5,
              reviewCount: 0,
            },
            deck.id
          )
        );
        elements.quickAddForm.reset();
        setStatus(elements.quickAddStatus, "Hinzugefügt.", { tone: "good" });
        buildQueue(true);
        resetReviewCounters();
        saveState();
        render();
        elements.quickFrontInput.focus();
      });
    }

    if (elements.cardSearchInput) {
      on(elements.cardSearchInput, "input", () => {
        if (state.searchTimer) clearTimeout(state.searchTimer);
        state.searchTimer = setTimeout(() => {
          state.cardSearch = elements.cardSearchInput.value || "";
          state.cardListLimit = CARD_LIST_PAGE_SIZE;
          renderCardList();
          refreshSelectionFromDom();
        }, 120);
      });
    }

    if (elements.bulkDeleteBtn) {
      on(elements.bulkDeleteBtn, "click", () => deleteSelectedCards());
    }

    if (elements.cardList) {
      on(elements.cardList, "click", (event) => {
        const actionEl = event.target && event.target.closest ? event.target.closest("[data-action]") : null;
        const item = event.target && event.target.closest ? event.target.closest(".card-list-item") : null;
        const cardId = item ? item.dataset.cardId : null;
        if (!cardId) return;

        if (actionEl && actionEl.dataset.action === "edit") {
          openEditCard(cardId);
          return;
        }
        if (actionEl && actionEl.dataset.action === "delete") {
          if (!window.confirm("Diese Karte löschen?")) return;
          deleteCardById(cardId);
          return;
        }
      });

      on(elements.cardList, "change", (event) => {
        const checkbox = event.target && event.target.matches ? (event.target.matches("input.card-select") ? event.target : null) : null;
        if (!checkbox) return;
        const item = checkbox.closest(".card-list-item");
        const cardId = item ? item.dataset.cardId : null;
        if (!cardId) return;
        toggleSelected(cardId, checkbox.checked);
        refreshSelectionFromDom();
      });
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pauseFlashcardsTimer("hidden");
    });
    window.addEventListener("pagehide", () => {
      pauseFlashcardsTimer("pagehide");
    });
    window.addEventListener("blur", () => {
      pauseFlashcardsTimer("blur");
    });
    window.addEventListener("beforeunload", () => {
      stopFlashcardsTimer("nav");
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (document.body.classList.contains("is-review-maximized")) {
          event.preventDefault();
          toggleReviewMaximize(false);
          return;
        }
        if (elements.cardModal && elements.cardModal.classList.contains("is-open")) {
          event.preventDefault();
          state.editingCardId = null;
          closeCardModal();
          return;
        }
        if (elements.csvModal && elements.csvModal.classList.contains("is-open")) {
          event.preventDefault();
          closeCsvModal();
          return;
        }
        if (state.currentCard) {
          event.preventDefault();
          exitReview();
          return;
        }
      }

      if (isInteractiveTarget(event.target)) return;

      if (event.key && (event.key === "f" || event.key === "F")) {
        toggleReviewMaximize();
        return;
      }
      if (!state.currentCard) return;

      if (event.key === " ") {
        event.preventDefault();
        if (!state.showAnswer) {
          ensureReviewSession();
          state.showAnswer = true;
          renderReview();
        }
        return;
      }

      if (!state.showAnswer) return;

      if (state.mode === "interval") {
        const rating = event.key === "1" ? "again" : event.key === "2" ? "hard" : event.key === "3" ? "good" : event.key === "4" ? "easy" : null;
        if (rating) {
          event.preventDefault();
          handleIntervalReview(rating);
        }
      } else {
        if (event.key === "1" || event.key === "2") {
          event.preventDefault();
          handleNormalReview(event.key === "1");
        }
      }
    });

    on(window, "study:state-replaced", () => {
      loadState();
      buildQueue(true);
      render();
    });

    if (elements.reviewCard) {
      on(elements.reviewCard, "click", (event) => {
        if (!state.currentCard || state.showAnswer) return;
        if (isInteractiveTarget(event.target)) return;
        ensureReviewSession();
        state.showAnswer = true;
        renderReview();
      });

      let swipeActive = false;
      let swipeStartX = 0;
      let swipeStartY = 0;

      const triggerSwipeFeedback = (kind) => {
        if (!elements.reviewCard) return;
        const className = kind === "known" ? "review-swipe-known" : "review-swipe-repeat";
        elements.reviewCard.classList.remove("review-swipe-known", "review-swipe-repeat");
        elements.reviewCard.classList.add(className);
        const remove = () => elements.reviewCard.classList.remove(className);
        elements.reviewCard.addEventListener("animationend", remove, { once: true });
        setTimeout(remove, 420);
      };

      on(elements.reviewCard, "touchstart", (event) => {
        if (state.mode !== "normal" || !state.currentCard) return;
        const touch = event.touches && event.touches[0];
        if (!touch) return;
        swipeActive = true;
        swipeStartX = touch.clientX;
        swipeStartY = touch.clientY;
      });

      on(elements.reviewCard, "touchmove", (event) => {
        if (!swipeActive) return;
        const touch = event.touches && event.touches[0];
        if (!touch) return;
        const dx = touch.clientX - swipeStartX;
        const dy = touch.clientY - swipeStartY;
        if (Math.abs(dy) > Math.abs(dx) * 1.1) {
          swipeActive = false;
        }
      });

      on(elements.reviewCard, "touchend", (event) => {
        if (!swipeActive) return;
        swipeActive = false;
        if (state.mode !== "normal" || !state.currentCard) return;
        const touch = event.changedTouches && event.changedTouches[0];
        if (!touch) return;
        const dx = touch.clientX - swipeStartX;
        const dy = touch.clientY - swipeStartY;
        if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        if (!state.showAnswer) {
          ensureReviewSession();
          state.showAnswer = true;
          renderReview();
          return;
        }
        const known = dx < 0;
        triggerSwipeFeedback(known ? "known" : "repeat");
        handleNormalReview(known);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
