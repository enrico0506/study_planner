(() => {
  const StudyPlanner = (window.StudyPlanner = window.StudyPlanner || {});
  const DOM = StudyPlanner.DOM;
  const Storage = StudyPlanner.Storage;
  const A11y = StudyPlanner.A11y;

  let active = null;
  let cleanupTrap = null;
  let lastFocus = null;

  function ensureRoot() {
    if (document.getElementById("spModalRoot")) return;
    const root = DOM.el("div", { id: "spModalRoot" });
    document.body.appendChild(root);
  }

  function close() {
    const root = document.getElementById("spModalRoot");
    if (!root) return;
    DOM.clear(root);
    active = null;
    cleanupTrap?.();
    cleanupTrap = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  function modalShell({ title, subtitle, bodyEl }) {
    const dialog = DOM.el("div", { class: "sp-modal-dialog", role: "dialog", "aria-modal": "true", "aria-label": title }, [
      DOM.el("div", { class: "sp-modal-head" }, [
        DOM.el("div", { class: "sp-modal-titlewrap" }, [
          DOM.el("div", { class: "sp-modal-title" }, title),
          subtitle ? DOM.el("div", { class: "sp-modal-subtitle" }, subtitle) : null
        ]),
        DOM.el("button", { class: "icon-btn icon-btn-ghost", type: "button", id: "spModalCloseBtn", "aria-label": "Close dialog" }, "✕")
      ]),
      bodyEl
    ]);
    const backdrop = DOM.el("div", { class: "sp-modal-backdrop", id: "spModalBackdrop" });
    const wrap = DOM.el("div", { class: "sp-modal", "aria-hidden": "false" }, [backdrop, dialog]);
    return { wrap, dialog, backdrop };
  }

  function buildDataModal() {
    const body = DOM.el("div", { class: "sp-modal-body" });
    const status = DOM.el("div", { class: "sp-modal-status", id: "spDataStatus", role: "status", "aria-live": "polite" });

    const exportBtn = DOM.el("button", { class: "btn", type: "button", id: "spExportBtn" }, "Export my data (JSON)");
    const importInput = DOM.el("input", { type: "file", accept: "application/json", id: "spImportFile" });
    const importMode = DOM.el("select", { id: "spImportMode" }, [
      DOM.el("option", { value: "merge" }, "Merge (keep existing data not in backup)"),
      DOM.el("option", { value: "replace" }, "Replace (delete existing study keys not in backup)")
    ]);
    const importBtn = DOM.el("button", { class: "btn btn-secondary", type: "button", id: "spImportBtn" }, "Import selected file…");

    const snapshotList = DOM.el("div", { class: "sp-snapshots", id: "spSnapshotList" });
    const refreshSnapshotsBtn = DOM.el("button", { class: "btn btn-secondary", type: "button", id: "spRefreshSnapshotsBtn" }, "Refresh snapshots");
    const makeSnapshotBtn = DOM.el("button", { class: "btn btn-secondary", type: "button", id: "spMakeSnapshotBtn" }, "Create snapshot now");

    body.appendChild(
      DOM.el("div", { class: "sp-modal-section" }, [
        DOM.el("div", { class: "sp-modal-section-title" }, "Import / Export"),
        DOM.el("p", { class: "sp-modal-help" }, "Export creates a JSON backup of all local Study Planner data. Import validates first and always creates an automatic pre-import snapshot so you can undo."),
        DOM.el("div", { class: "sp-modal-actionsrow" }, [exportBtn]),
        DOM.el("div", { class: "sp-modal-importrow" }, [
          DOM.el("label", { class: "sp-modal-field" }, [
            DOM.el("div", { class: "sp-modal-field-label" }, "Backup file"),
            importInput
          ]),
          DOM.el("label", { class: "sp-modal-field" }, [
            DOM.el("div", { class: "sp-modal-field-label" }, "Import mode"),
            importMode
          ]),
          importBtn
        ])
      ])
    );

    body.appendChild(
      DOM.el("div", { class: "sp-modal-section" }, [
        DOM.el("div", { class: "sp-modal-section-title" }, "Local snapshots"),
        DOM.el("p", { class: "sp-modal-help" }, "Snapshots are stored locally (last 12). Restore one if an import goes wrong."),
        DOM.el("div", { class: "sp-modal-actionsrow" }, [makeSnapshotBtn, refreshSnapshotsBtn]),
        snapshotList
      ])
    );
    body.appendChild(status);

    function setStatus(message, tone = "") {
      status.className = `sp-modal-status${tone ? " is-" + tone : ""}`;
      status.textContent = message || "";
    }

    function renderSnapshots() {
      DOM.clear(snapshotList);
      const snaps = Storage.listSnapshots();
      if (!snaps.length) {
        snapshotList.appendChild(DOM.el("div", { class: "sp-empty" }, "No snapshots yet."));
        return;
      }
      snaps.forEach((s) => {
        const when = new Date(s.ts || Date.now()).toLocaleString();
        const row = DOM.el("div", { class: "sp-snapshot-row" }, [
          DOM.el("div", { class: "sp-snapshot-meta" }, [
            DOM.el("div", { class: "sp-snapshot-title" }, s.label || "Snapshot"),
            DOM.el("div", { class: "sp-snapshot-subtitle" }, when)
          ]),
          DOM.el("button", { class: "btn btn-secondary", type: "button", "data-snap": s.id, "aria-label": `Restore snapshot from ${when}` }, "Restore")
        ]);
        snapshotList.appendChild(row);
      });
    }

    exportBtn.addEventListener("click", () => {
      const data = Storage.exportAll();
      Storage.snapshotNow({ label: "Auto: export" });
      const stamp = new Date().toISOString().replaceAll(":", "-");
      Storage.downloadJson(`study-planner-backup_${stamp}.json`, data);
      setStatus("Exported backup and saved an automatic snapshot.", "ok");
    });

    importBtn.addEventListener("click", async () => {
      const file = importInput.files && importInput.files[0];
      if (!file) {
        setStatus("Choose a JSON file first.", "warn");
        return;
      }
      let raw = "";
      try {
        raw = await file.text();
      } catch {
        setStatus("Could not read file.", "warn");
        return;
      }
      const parsed = (() => {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })();
      const validation = Storage.validateBackup(parsed);
      if (!validation.ok) {
        setStatus(validation.error, "warn");
        return;
      }
      const keyCount = Object.keys(validation.backup.data || {}).length;
      const ok = window.confirm(
        `Import ${keyCount} keys from “${file.name}”?\\n\\nThis will overwrite any keys present in the backup. A pre-import snapshot will be created automatically.`
      );
      if (!ok) return;
      const mode = importMode.value === "replace" ? "replace" : "merge";
      const res = Storage.applyBackup(validation.backup, { mode });
      if (!res.ok) {
        setStatus(res.error || "Import failed.", "warn");
        return;
      }
      renderSnapshots();
      setStatus("Import completed. Reloading UI state…", "ok");
    });

    snapshotList.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-snap]");
      if (!btn) return;
      const snapId = btn.getAttribute("data-snap");
      const ok = window.confirm("Restore this snapshot? This will overwrite current local state (a pre-restore snapshot will be created).");
      if (!ok) return;
      const restored = Storage.restoreSnapshot(snapId, { mode: "replace" });
      if (!restored) setStatus("Could not restore snapshot.", "warn");
      else setStatus("Snapshot restored. UI should update automatically.", "ok");
    });

    refreshSnapshotsBtn.addEventListener("click", () => {
      renderSnapshots();
      setStatus("Snapshots refreshed.", "ok");
    });
    makeSnapshotBtn.addEventListener("click", () => {
      Storage.snapshotNow({ label: "Manual snapshot" });
      renderSnapshots();
      setStatus("Snapshot created.", "ok");
    });

    renderSnapshots();
    return modalShell({
      title: "Data safety",
      subtitle: "Back up, import, and restore snapshots (local only).",
      bodyEl: body
    });
  }

  function loadPlannerData() {
    const keys = Storage.listKeys({ includeSyncMeta: false });
    const data = {};
    for (const k of keys) data[k] = Storage.getRaw(k, null);
    return data;
  }

  function parseSubjects(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function parseFlashcards(raw) {
    if (!raw) return { decks: [] };
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : { decks: [] };
    } catch {
      return { decks: [] };
    }
  }

  function parseEvents(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function buildSearchModal() {
    const body = DOM.el("div", { class: "sp-modal-body" });
    const status = DOM.el("div", { class: "sp-modal-status", role: "status", "aria-live": "polite" });
    const input = DOM.el("input", { class: "sp-search-input", id: "spSearchInput", placeholder: "Search subjects, files, cards, events…", type: "search" });

    const confMin = DOM.el("input", { type: "number", min: "0", max: "100", value: "0", id: "spFilterConfMin" });
    const confMax = DOM.el("input", { type: "number", min: "0", max: "100", value: "100", id: "spFilterConfMax" });
    const dueSoon = DOM.el("input", { type: "checkbox", id: "spFilterDueSoon" });
    const staleDays = DOM.el("input", { type: "number", min: "0", value: "14", id: "spFilterStaleDays" });

    const results = DOM.el("div", { class: "sp-search-results", id: "spSearchResults" });

    body.appendChild(
      DOM.el("div", { class: "sp-modal-section" }, [
        DOM.el("div", { class: "sp-modal-section-title" }, "Global search"),
        DOM.el("p", { class: "sp-modal-help" }, "Filters: confidence range applies to files; “due soon” uses calendar deadlines/exams/reminders within 7 days; “not studied recently” uses lastReviewed."),
        input,
        DOM.el("div", { class: "sp-search-filters" }, [
          DOM.el("label", { class: "sp-filter" }, ["Confidence min", confMin]),
          DOM.el("label", { class: "sp-filter" }, ["Confidence max", confMax]),
          DOM.el("label", { class: "sp-filter sp-filter-inline" }, [dueSoon, DOM.el("span", { class: "sp-filter-inline-label" }, "Due soon (7d)")]),
          DOM.el("label", { class: "sp-filter" }, ["Not studied in days", staleDays])
        ])
      ])
    );
    body.appendChild(results);
    body.appendChild(status);

    function setStatus(message) {
      status.textContent = message || "";
    }

    function norm(s) {
      return String(s || "").toLowerCase().trim();
    }

    function daysAgo(ts) {
      if (!ts) return Infinity;
      const d = (Date.now() - Number(ts)) / (24 * 60 * 60 * 1000);
      return Number.isFinite(d) ? d : Infinity;
    }

    function renderSection(title, items) {
      const section = DOM.el("div", { class: "sp-search-section" });
      section.appendChild(DOM.el("div", { class: "sp-search-section-title" }, title));
      if (!items.length) {
        section.appendChild(DOM.el("div", { class: "sp-empty" }, "No matches."));
        return section;
      }
      const ul = DOM.el("ul", { class: "sp-search-list" });
      items.slice(0, 40).forEach((item) => {
        const li = DOM.el("li", { class: "sp-search-item" }, [
          DOM.el("div", { class: "sp-search-item-main" }, [
            DOM.el("div", { class: "sp-search-item-title" }, item.title),
            item.subtitle ? DOM.el("div", { class: "sp-search-item-subtitle" }, item.subtitle) : null
          ]),
          DOM.el("a", { class: "btn btn-secondary", href: item.href }, "Open")
        ]);
        ul.appendChild(li);
      });
      section.appendChild(ul);
      return section;
    }

    function runSearch() {
      const query = norm(input.value);
      const minC = Math.max(0, Math.min(100, Number(confMin.value) || 0));
      const maxC = Math.max(0, Math.min(100, Number(confMax.value) || 100));
      const wantDueSoon = !!dueSoon.checked;
      const stale = Math.max(0, Number(staleDays.value) || 0);

      const data = loadPlannerData();
      const subjects = parseSubjects(data["studySubjects_v1"]);
      const flash = parseFlashcards(data["studyFlashcards_v1"]);
      const events = parseEvents(data["studyCalendarEvents_v1"]);

      const subjectHits = [];
      const fileHits = [];
      for (const subj of subjects) {
        const subjName = subj?.name || "Subject";
        const subjOk = !query || norm(subjName).includes(query);
        if (subjOk) subjectHits.push({ title: subjName, subtitle: "Subject", href: "./index.html?mode=subjects" });

        const files = Array.isArray(subj?.files) ? subj.files : [];
        for (const f of files) {
          const title = f?.name || f?.title || "File";
          const conf = Number(f?.confidence) || 0;
          const lastReviewed = f?.lastReviewed || null;
          const staleOk = stale === 0 ? true : daysAgo(lastReviewed) >= stale;
          const confOk = conf >= minC && conf <= maxC;
          const qOk = !query || norm(title).includes(query) || norm(subjName).includes(query);
          if (qOk && confOk && staleOk) {
            fileHits.push({
              title,
              subtitle: `${subjName} · ${conf}% confidence`,
              href: "./index.html?mode=board"
            });
          }
        }
      }

      const dueCutoff = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const eventHits = [];
      for (const evt of events) {
        const t = evt?.title || "Event";
        const dateStr = evt?.date || "";
        const qOk = !query || norm(t).includes(query) || norm(evt?.notes || "").includes(query);
        let dueOk = true;
        if (wantDueSoon) {
          const dt = Date.parse(dateStr);
          dueOk = Number.isFinite(dt) && dt <= dueCutoff;
        }
        if (qOk && dueOk) {
          eventHits.push({
            title: t,
            subtitle: `${dateStr}${evt?.time ? " · " + evt.time : ""}`,
            href: "./calendar.html"
          });
        }
      }

      const cardHits = [];
      const decks = Array.isArray(flash?.decks) ? flash.decks : [];
      for (const d of decks) {
        const deckName = d?.name || "Deck";
        const cards = Array.isArray(d?.cards) ? d.cards : [];
        for (const c of cards) {
          const front = c?.front || "";
          const back = c?.back || "";
          const hint = c?.hint || "";
          const qOk =
            !query ||
            norm(deckName).includes(query) ||
            norm(front).includes(query) ||
            norm(back).includes(query) ||
            norm(hint).includes(query);
          if (!qOk) continue;
          cardHits.push({
            title: front ? front.slice(0, 80) : "Card",
            subtitle: `Deck: ${deckName}`,
            href: "./karteikarten.html"
          });
        }
      }

      DOM.clear(results);
      const total = subjectHits.length + fileHits.length + eventHits.length + cardHits.length;
      setStatus(total ? `${total} match${total === 1 ? "" : "es"}.` : "No matches yet.");
      results.appendChild(renderSection("Subjects", subjectHits));
      results.appendChild(renderSection("Files", fileHits));
      results.appendChild(renderSection("Calendar", eventHits));
      results.appendChild(renderSection("Flashcards", cardHits));
    }

    const debounced = (() => {
      let t = null;
      return () => {
        if (t) clearTimeout(t);
        t = setTimeout(runSearch, 120);
      };
    })();

    input.addEventListener("input", debounced);
    confMin.addEventListener("input", debounced);
    confMax.addEventListener("input", debounced);
    dueSoon.addEventListener("change", debounced);
    staleDays.addEventListener("input", debounced);

    setTimeout(runSearch, 0);

    return modalShell({
      title: "Search",
      subtitle: "Find subjects, files, events, and flashcards.",
      bodyEl: body
    });
  }

  function open(which) {
    if (!DOM || !Storage) return;
    ensureRoot();
    lastFocus = document.activeElement;
    const root = document.getElementById("spModalRoot");
    DOM.clear(root);

    const modal = which === "data" ? buildDataModal() : buildSearchModal();
    active = which;
    root.appendChild(modal.wrap);

    const closeBtn = modal.wrap.querySelector("#spModalCloseBtn");
    const backdrop = modal.wrap.querySelector("#spModalBackdrop");
    closeBtn?.addEventListener("click", close);
    backdrop?.addEventListener("click", close);
    modal.wrap.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
    });

    cleanupTrap?.();
    cleanupTrap = A11y?.trapFocus ? A11y.trapFocus(modal.dialog, { initialFocusEl: modal.wrap.querySelector("#spSearchInput") || closeBtn }) : null;
  }

  StudyPlanner.Modals = Object.assign(StudyPlanner.Modals || {}, { open, close });
})();

