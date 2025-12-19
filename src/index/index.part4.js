    function renderSubjectOptions(selectedId) {
      modalSubjectSelect.innerHTML = "";
      if (!subjects.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No subjects yet";
        modalSubjectSelect.appendChild(opt);
        return;
      }

      for (const subj of subjects) {
        const opt = document.createElement("option");
        opt.value = subj.id;
        opt.textContent = subj.name;
        modalSubjectSelect.appendChild(opt);
      }

      if (selectedId && subjects.some((s) => s.id === selectedId)) {
        modalSubjectSelect.value = selectedId;
      } else {
        modalSubjectSelect.selectedIndex = 0;
      }
    }

    const fileModalA11y = window.StudyA11y
      ? window.StudyA11y.withModalA11y(fileModalBackdrop, () => {
          closeFileModal();
        }, () => modalFileNameInput)
      : null;

    function openFileModalAdd(subjectId) {
      fileModalState = { mode: "add", subjectId };
      fileModalTitle.textContent = "Add file";
      fileModalSubtitle.textContent = "Add a new file to your study planner.";
      modalDeleteBtn.hidden = true;

      renderSubjectOptions(subjectId);
      modalFileNameInput.value = "";
      modalFileNotesInput.value = "";
      modalConfidenceRange.value = "50";
      modalConfidenceValue.textContent = "50%";

      if (fileModalA11y) fileModalA11y.open();
      else {
        fileModalBackdrop.style.display = "flex";
        modalFileNameInput.focus();
      }
    }

    function openFileModalEdit(subjectId, file) {
      fileModalState = { mode: "edit", subjectId, fileId: file.id };
      fileModalTitle.textContent = "Edit file";
      fileModalSubtitle.textContent = "Update file information or move it to another subject.";
      modalDeleteBtn.hidden = false;

      renderSubjectOptions(subjectId);
      modalFileNameInput.value = file.name;
      modalFileNotesInput.value = file.notes || "";
      modalConfidenceRange.value = file.confidence;
      modalConfidenceValue.textContent = file.confidence + "%";

      if (fileModalA11y) fileModalA11y.open();
      else {
        fileModalBackdrop.style.display = "flex";
        modalFileNameInput.focus();
      }
    }

    function closeFileModal() {
      fileModalState = null;
      if (fileModalA11y) fileModalA11y.close();
      else fileModalBackdrop.style.display = "none";
    }

    // Stats modal
    function renderStatsModalContent() {
      const rangeLabels = {
        day: "Today",
        week: "Last 7 days",
        month: "Last 30 days",
        all: "All time"
      };

      const entries = [];
      const perSubject = [];
      const confidenceBuckets = { low: 0, mid: 0, high: 0 };
      let totalMsRange = 0;
      let totalSessionsRange = 0;
      let trackedFiles = 0;
      const includesToday = msInRange(Date.now(), statsRange);

      const totalsMap = getDailyTotalsMap(true);
      const weekMs = sumLastNDays(totalsMap, 7);
      const goalMs = Math.max(0, weeklyTargetMinutes || 0) * 60 * 1000;
      const goalPct = goalMs ? Math.min(100, Math.round((weekMs * 100) / goalMs)) : 0;
      const { current: streakCurrent, best: streakBest } = computeStreakStats(totalsMap);

      let bestDay = null;
      Object.entries(totalsMap || {}).forEach(([key, val]) => {
        const ms = Number(val) || 0;
        const ts = dateKeyToMs(key);
        if (ts === null || ms <= 0) return;
        if (!bestDay || ms > bestDay.ms) {
          bestDay = { key, ms, ts };
        }
      });

      const daySeries = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = dateToKey(d);
        daySeries.push({
          key,
          label: d.toLocaleString(undefined, { weekday: "short" }),
          ms: totalsMap[key] || 0
        });
      }
      const maxDayMs = daySeries.reduce((max, d) => (d.ms > max ? d.ms : max), 0);

      subjects.forEach((subj) => {
        let subjMs = 0;
        let subjSessions = 0;
        (subj.files || []).forEach((file) => {
          let totalMs = totalMsForRange(file, statsRange);
          if (
            includesToday &&
            activeStudy &&
            activeStudy.kind === "study" &&
            activeStudy.subjectId === subj.id &&
            activeStudy.fileId === file.id
          ) {
            totalMs += computeElapsedMs(activeStudy);
          }
          const sessions = totalSessionsForRange(file, statsRange);
          const conf = Number(file.confidence) || 0;
          if (totalMs > 0) {
            trackedFiles += 1;
            entries.push({
              subjectName: subj.name,
              fileName: file.name,
              totalMs,
              sessions,
              confidence: conf
            });
            subjMs += totalMs;
            subjSessions += sessions;
            totalMsRange += totalMs;
            totalSessionsRange += sessions;
          }
          if (conf < 40) confidenceBuckets.low += 1;
          else if (conf < 75) confidenceBuckets.mid += 1;
          else confidenceBuckets.high += 1;
        });
        if (subjMs > 0) {
          perSubject.push({
            name: subj.name,
            totalMs: subjMs,
            sessions: subjSessions
          });
        }
      });

      if (typeof getFlashcardsTotalsForRange === "function") {
        const flashMs = getFlashcardsTotalsForRange(statsRange);
        const flashSessions =
          typeof getFlashcardsSessionsForRange === "function" ? getFlashcardsSessionsForRange(statsRange) : 0;
        if (flashMs > 0) {
          totalMsRange += flashMs;
          totalSessionsRange += flashSessions;
          perSubject.push({
            name: "Karteikarten",
            totalMs: flashMs,
            sessions: flashSessions
          });
          entries.push({
            subjectName: "Karteikarten",
            fileName: "Karteikarten",
            totalMs: flashMs,
            sessions: flashSessions,
            confidence: 0
          });
        }
      }

      const confidenceTotal =
        confidenceBuckets.low + confidenceBuckets.mid + confidenceBuckets.high;
      const confPct = (count) =>
        confidenceTotal ? Math.round((count * 100) / confidenceTotal) : 0;

      const activeDaysInRange = Object.entries(totalsMap || {}).reduce(
        (count, [key, val]) => {
          const ts = dateKeyToMs(key);
          if (ts !== null && msInRange(ts, statsRange) && (Number(val) || 0) > 0) {
            return count + 1;
          }
          return count;
        },
        0
      );
      const avgPerDayMs = activeDaysInRange ? totalMsRange / activeDaysInRange : 0;
      const avgSessionMs =
        totalSessionsRange > 0 ? totalMsRange / Math.max(totalSessionsRange, 1) : 0;

      entries.sort((a, b) => b.totalMs - a.totalMs);
      perSubject.sort((a, b) => b.totalMs - a.totalMs);
      const topFiles = entries.slice(0, 5);
      const maxMs = entries.reduce((max, e) => (e.totalMs > max ? e.totalMs : max), 0);
      const maxSubMs = perSubject.reduce(
        (max, e) => (e.totalMs > max ? e.totalMs : max),
        0
      );

      const rangeLabel = rangeLabels[statsRange] || "Range";
      const heroCard = (title, value, subtitle, extraClass = "") =>
        '<div class="stats-hero-card' +
        (extraClass ? " " + extraClass : "") +
        '">' +
        '<div class="stats-hero-title">' +
        title +
        "</div>" +
        '<div class="stats-hero-value">' +
        value +
        "</div>" +
        (subtitle ? '<div class="stats-hero-sub">' + subtitle + "</div>" : "") +
        "</div>";

      let html = "";

      html += '<div class="stats-range-row">';
      html += '<div class="stats-range">';
      ["day", "week", "month", "all"].forEach((range) => {
        html +=
          '<button class="stats-range-btn' +
          (statsRange === range ? " stats-range-btn-active" : "") +
          '" data-range="' +
          range +
          '">' +
          (range === "day"
            ? "Today"
            : range === "week"
            ? "Last 7 days"
            : range === "month"
            ? "Last 30 days"
            : "All time") +
          "</button>";
      });
      html += "</div>";
      html += "</div>";

      html += '<div class="stats-hero">';
      html += heroCard(
        "Tracked time",
        formatDuration(totalMsRange),
        rangeLabel + (avgPerDayMs ? " · avg " + formatDuration(avgPerDayMs) + "/day" : "")
      );
      html += heroCard(
        "Daily streak",
        streakCurrent + " day" + (streakCurrent === 1 ? "" : "s"),
        "Best " + (streakBest || 0)
      );
      html += heroCard(
        "Avg session",
        avgSessionMs ? formatDuration(avgSessionMs) : "—",
        (totalSessionsRange || 0) + " sessions"
      );
      html +=
        '<div class="stats-hero-card stats-hero-goal">' +
        '<div class="stats-hero-title">Weekly goal</div>' +
        '<div class="stats-hero-value">' +
        (goalMs ? goalPct + "%" : "—") +
        "</div>" +
        '<div class="stats-hero-sub">' +
        formatHoursCompact(weekMs) +
        " / " +
        (goalMs ? formatHoursCompact(goalMs) : "no target") +
        "</div>" +
        '<div class="stats-hero-progress"><span style="width:' +
        (goalMs ? Math.min(goalPct, 100) : 0) +
        '%"></span></div>' +
        "</div>";
      html += "</div>";

      html +=
        '<div class="stats-meta-row">' +
        trackedFiles +
        " files · " +
        perSubject.length +
        " subjects · " +
        (totalSessionsRange || 0) +
        " sessions" +
        "</div>";

      html += '<div class="stats-grid stats-grid-balanced">';
      html += '<div class="stats-card stats-chart-card">';
      html += '<div class="stats-card-title">Last 7 days</div>';
      html += '<div class="stats-chart">';
      html += '<div class="stats-chart-bars">';
      daySeries.forEach((d) => {
        const height = maxDayMs > 0 ? Math.max(6, (d.ms * 100) / maxDayMs) : 0;
        html +=
          '<div class="stats-bar" title="' +
          escapeHtml(d.label) +
          ": " +
          formatDuration(d.ms) +
          '">' +
          '<div class="stats-bar-fill-vertical" style="height:' +
          height +
          '%"></div>' +
          '<div class="stats-bar-label">' +
          d.label +
          "</div>" +
          "</div>";
      });
      html += "</div>";
      html +=
        '<div class="stats-chart-footer">' +
        (weekMs ? formatDuration(weekMs) : "0 min") +
        " in the last 7 days" +
        "</div>";
      html += "</div></div>";

      html += '<div class="stats-card">';
      html += '<div class="stats-card-title">Confidence & highlights</div>';
      html += '<div class="stats-conf-bars">';
      html +=
        '<div class="stats-conf-row"><span class="conf-dot conf-low"></span><span>Low</span><div class="stats-conf-track"><div class="stats-conf-fill conf-low" style="width:' +
        confPct(confidenceBuckets.low) +
        '%;"></div></div><span class="stats-conf-num">' +
        confidenceBuckets.low +
        "</span></div>";
      html +=
        '<div class="stats-conf-row"><span class="conf-dot conf-mid"></span><span>Medium</span><div class="stats-conf-track"><div class="stats-conf-fill conf-mid" style="width:' +
        confPct(confidenceBuckets.mid) +
        '%;"></div></div><span class="stats-conf-num">' +
        confidenceBuckets.mid +
        "</span></div>";
      html +=
        '<div class="stats-conf-row"><span class="conf-dot conf-high"></span><span>High</span><div class="stats-conf-track"><div class="stats-conf-fill conf-high" style="width:' +
        confPct(confidenceBuckets.high) +
        '%;"></div></div><span class="stats-conf-num">' +
        confidenceBuckets.high +
        "</span></div>";
      html += "</div>";
      if (bestDay) {
        const dateLabel = new Date(bestDay.ts).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric"
        });
        html +=
          '<div class="stats-highlight">Best day: ' +
          dateLabel +
          " · " +
          formatDuration(bestDay.ms) +
          "</div>";
      }
      html += "</div>";
      html += "</div>";

      html += '<div class="stats-grid stats-grid-balanced">';
      html += '<div class="stats-card">';
      html += '<div class="stats-card-title">By subject</div>';
      if (!perSubject.length) {
        html += '<div class="stats-empty">No study time in this range yet.</div>';
      } else {
        html += '<div class="stats-list">';
        perSubject.forEach((s) => {
          const width = maxSubMs > 0 ? (s.totalMs * 100) / maxSubMs : 0;
          html +=
            '<div class="stats-row">' +
            '<div class="stats-row-header">' +
            '<div>' +
            '<div class="stats-row-title">' +
            escapeHtml(s.name) +
            "</div>" +
            '<div class="stats-row-subtitle">' +
            (s.sessions || 0) +
            " sessions" +
            "</div>" +
            "</div>" +
            '<div class="stats-row-time">' +
            formatDuration(s.totalMs) +
            "</div>" +
            "</div>" +
            '<div class="stats-bar-track">' +
            '<div class="stats-bar-fill" style="width:' +
            width +
            '%;"></div>' +
            "</div>" +
            "</div>";
        });
        html += "</div>";
      }
      html += "</div>";

      html += '<div class="stats-card">';
      html += '<div class="stats-card-title">Top files</div>';
      if (!topFiles.length) {
        html += '<div class="stats-empty">No sessions to rank yet.</div>';
      } else {
        html += '<div class="stats-list">';
        topFiles.forEach((e) => {
          const width = maxMs > 0 ? (e.totalMs * 100) / maxMs : 0;
          const sessionsLabel =
            (e.sessions || 0) +
            " session" +
            ((e.sessions || 0) === 1 ? "" : "s");
          html +=
            '<div class="stats-row">' +
            '<div class="stats-row-header">' +
            '<div>' +
            '<div class="stats-row-title">' +
            escapeHtml(e.fileName) +
            "</div>" +
            '<div class="stats-row-subtitle">' +
            escapeHtml(e.subjectName) +
            " · " +
            sessionsLabel +
            " · " +
            e.confidence +
            "% conf</div>" +
            "</div>" +
            '<div class="stats-row-time">' +
            formatDuration(e.totalMs) +
            "</div>" +
            "</div>" +
            '<div class="stats-bar-track">' +
            '<div class="stats-bar-fill" style="width:' +
            width +
            '%;"></div>' +
            "</div>" +
            "</div>";
        });
        html += "</div>";
      }
      html += "</div>";
      html += "</div>";

      if (!entries.length && totalMsRange === 0) {
        html =
          '<p class="stats-summary">No study sessions tracked yet. Start a timer on a file to collect data.</p>' +
          html;
      }

      statsBody.innerHTML = html;

      const rangeButtons = statsBody.querySelectorAll(".stats-range-btn");
      rangeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const r = btn.getAttribute("data-range");
          if (!r) return;
          statsRange = r;
          renderStatsModalContent();
        });
      });

      requestAnimationFrame(() => enforceTodayHeight());
    }

    function openStatsModal() {
      renderStatsModalContent();
      statsBackdrop.style.display = "flex";
    }

    function closeStatsModal() {
      statsBackdrop.style.display = "none";
    }

    // Timer settings modal helpers
    function clampMinutes(value, fallback) {
      const v = Number(value);
      if (!Number.isFinite(v) || v <= 0) return fallback;
      return Math.round(v);
    }

    function toggleInlineTimerPanel(show) {
      if (!timerInlinePanel) return;
      const visible = typeof show === "boolean" ? show : timerInlinePanel.hidden;
      if (visible) {
        timerInlinePanel.hidden = false;
        timerInlinePanel.style.display = "flex";
        if (timerInlineStudy) timerInlineStudy.value = pomoConfig.study || 25;
        if (timerInlineShort) timerInlineShort.value = pomoConfig.short || 5;
        if (timerInlineLong) timerInlineLong.value = pomoConfig.long || 15;
        if (focusCard) focusCard.classList.add("settings-open");
      } else {
        timerInlinePanel.hidden = true;
        timerInlinePanel.style.display = "none";
        if (focusCard) focusCard.classList.remove("settings-open");
      }
    }

    function applyTodayExpandedLayout() {
      if (!layoutRow) return;
      layoutRow.classList.toggle("today-full", todayExpanded || subjectsMaximized);
      if (todayList) {
        todayList.classList.toggle("today-list-grid", todayExpanded && !subjectsMaximized);
        // Only show a visible scrollbar in the compact (non-maximized) sidebar layout.
        todayList.classList.toggle("today-scroll-visible", !todayExpanded && !subjectsMaximized);
      }
      if (todaySidebar) {
        todaySidebar.classList.toggle("today-sidebar-full", todayExpanded && !subjectsMaximized);
      }
      if (todayDropZone) {
        todayDropZone.style.display = todayExpanded && !subjectsMaximized ? "none" : "";
      }
      if (todayHeaderActions && todayHeaderActions.firstChild) {
        const btn = todayHeaderActions.firstChild;
        btn.setAttribute("aria-pressed", todayExpanded ? "true" : "false");
        btn.dataset.state = todayExpanded ? "restore" : "maximize";
        btn.dataset.icon = todayExpanded ? "⤡" : "⤢";
      }
      const maxSubjectBtn = document.getElementById("maximizeSubjectsBtn");
      if (maxSubjectBtn) {
        maxSubjectBtn.setAttribute("aria-pressed", subjectsMaximized ? "true" : "false");
        maxSubjectBtn.textContent = subjectsMaximized ? "⤡" : "⤢";
      }
      renderTodayTodos();
      requestAnimationFrame(() => enforceTodayHeight());
    }

    function setActiveView(view) {
      activeView = view;
      if (layoutRow) {
        layoutRow.hidden = view !== "board";
        layoutRow.style.display = view === "board" ? "" : "none";
      }
      if (scheduleView) {
        scheduleView.hidden = view !== "schedule";
        scheduleView.style.display = view === "schedule" ? "block" : "none";
      }

      if (appRoot) {
        appRoot.classList.toggle("view-board", view === "board");
        appRoot.classList.toggle("view-schedule", view === "schedule");
      }

      if (viewBoardBtn) {
        viewBoardBtn.classList.toggle("view-toggle-active", view === "board");
        viewBoardBtn.setAttribute("aria-selected", view === "board" ? "true" : "false");
      }
      if (viewScheduleBtn) {
        viewScheduleBtn.classList.toggle("view-toggle-active", view === "schedule");
        viewScheduleBtn.setAttribute("aria-selected", view === "schedule" ? "true" : "false");
      }

      if (view === "schedule") {
        renderScheduleView();
        if (scheduleView) {
          scheduleView.scrollIntoView({ behavior: "auto", block: "start" });
        }
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "auto" });
        }
      } else {
        applyTodayExpandedLayout();
      }
    }

    // Events

    if (todayHeaderActions) {
      const expandBtn = document.createElement("button");
      expandBtn.type = "button";
      expandBtn.className = "icon-btn today-maximize-btn";
      expandBtn.title = "Toggle focus width";
      expandBtn.dataset.icon = "⤢";
      expandBtn.addEventListener("click", () => {
        todayExpanded = !todayExpanded;
        applyTodayExpandedLayout();
      });
      todayHeaderActions.appendChild(expandBtn);

      const pickerBackBtn = document.createElement("button");
      pickerBackBtn.type = "button";
      pickerBackBtn.className = "chip-btn mobile-menu-only";
      pickerBackBtn.id = "todayPickerBackBtn";
      pickerBackBtn.textContent = "Back to Today";
      pickerBackBtn.hidden = true;
      pickerBackBtn.addEventListener("click", () => {
        document.body.classList.remove("today-picker-open");
        pickBtn.textContent = "Add from subjects";
        renderTable();
        const sidebar = document.querySelector("#layoutRow .today-sidebar");
        sidebar?.scrollIntoView({ behavior: "smooth", block: "start" });
        pickerBackBtn.hidden = true;
      });
      const pickBtn = document.createElement("button");
      pickBtn.type = "button";
      pickBtn.className = "btn btn-secondary mobile-menu-only";
      pickBtn.id = "todayPickToggleBtn";
      pickBtn.textContent = "Add from subjects";
      pickBtn.addEventListener("click", () => {
        const open = !document.body.classList.contains("today-picker-open");
        document.body.classList.toggle("today-picker-open", open);
        pickBtn.textContent = open ? "Back to Today" : "Add from subjects";
        pickerBackBtn.hidden = !open;
        renderTable();
        const target = open
          ? document.querySelector("#layoutRow .main-area")
          : document.querySelector("#layoutRow .today-sidebar");
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      todayHeaderActions.appendChild(pickBtn);
      todayHeaderActions.appendChild(pickerBackBtn);

      applyTodayExpandedLayout();
    }

    if (editGoalBtn) {
      const openWeeklyTargetPrompt = () => {
        const current = streakCurrentLabel ? streakCurrentLabel.textContent : "0 days";
        const best = streakBestLabel ? streakBestLabel.textContent : "Best 0";
        const hoursValue = Math.max(1, Math.round((weeklyTargetMinutes || DEFAULT_WEEKLY_TARGET_MINUTES) / 60));
        const title = `Set weekly target (hours) · ${current} · ${best}`;
        openNoticePrompt(title, String(hoursValue), (value) => {
          const hours = Number(value);
          if (!Number.isFinite(hours) || hours <= 0) {
            showNotice("Please enter hours greater than zero.", "warn");
            return;
          }
          weeklyTargetMinutes = Math.round(hours * 60);
          saveFocusConfig();
          updateGoalsAndStreaks();
          renderStatsModalContent();
          renderSmartSuggestions();
          renderDueSoonLane();
          showToast("Weekly target updated.", "success");
        });
      };

      editGoalBtn.addEventListener("click", openWeeklyTargetPrompt);
      if (weeklyGoalFill && weeklyGoalFill.parentElement) {
        weeklyGoalFill.parentElement.addEventListener("click", openWeeklyTargetPrompt);
      }

      applySubjectPaging();
    }

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (themeMenu && !themeMenu.hidden) {
          closeThemeMenu();
        } else {
          openThemeMenu();
        }
      });
    }
    let quickJumpTimer = null;
    function openQuickJump() {
      quickJumpDropdown?.classList.add("quick-open");
      quickJumpTrigger?.setAttribute("aria-expanded", "true");
    }
    function closeQuickJump() {
      quickJumpDropdown?.classList.remove("quick-open");
      quickJumpTrigger?.setAttribute("aria-expanded", "false");
    }
    quickJumpTrigger?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (quickJumpDropdown?.classList.contains("quick-open")) {
        closeQuickJump();
      } else {
        openQuickJump();
      }
    });
    quickJumpDropdown?.addEventListener("mouseenter", () => {
      if (quickJumpTimer) clearTimeout(quickJumpTimer);
      openQuickJump();
    });
    quickJumpDropdown?.addEventListener("mouseleave", () => {
      quickJumpTimer = window.setTimeout(closeQuickJump, 80);
    });
    quickJumpPanel?.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;
      closeQuickJump();
    });
    document.addEventListener("click", (event) => {
      if (quickJumpDropdown && quickJumpDropdown.contains(event.target)) return;
      closeQuickJump();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeQuickJump();
      }
    });

	    if (openSuggestionsBtn) {
	      openSuggestionsBtn.addEventListener("click", () => {
	        openSuggestionModal();
	      });
	    }

		    if (suggestionModalCloseBtn) {
		      suggestionModalCloseBtn.addEventListener("click", () => {
		        closeSuggestionModal();
		      });
		    }

    if (suggestionModalCloseBtn2) {
      suggestionModalCloseBtn2.addEventListener("click", () => {
        closeSuggestionModal();
      });
    }

	    if (suggestionModalBackdrop) {
	      suggestionModalBackdrop.addEventListener("mousedown", (event) => {
	        if (event.target === suggestionModalBackdrop) {
	          closeSuggestionModal();
	        }
	      });
	    }

		    if (tableWrapper) {
		      const blockDragSelector =
		        "button, input, select, textarea, option, .chip-btn, .file-row, .add-file-slot, .subject-add-box";
      let isPanning = false;
      let startX = 0;
      let startScroll = 0;

      tableWrapper.addEventListener(
        "wheel",
        (event) => {
          const prefersX = Math.abs(event.deltaX) > Math.abs(event.deltaY);
          if (event.shiftKey) {
            tableWrapper.scrollLeft += event.deltaY;
            event.preventDefault();
          } else if (prefersX && event.deltaX !== 0) {
            tableWrapper.scrollLeft += event.deltaX;
            event.preventDefault();
          }
        },
        { passive: false }
      );

      tableWrapper.addEventListener("mousedown", (event) => {
        if (event.button !== 0) return;
        if (event.target.closest(blockDragSelector)) return;
        isPanning = true;
        startX = event.pageX;
        startScroll = tableWrapper.scrollLeft;
        tableWrapper.classList.add("dragging-scroll");
      });

      document.addEventListener("mousemove", (event) => {
        if (!isPanning) return;
        const dx = event.pageX - startX;
        tableWrapper.scrollLeft = startScroll - dx;
      });

      document.addEventListener("mouseup", () => {
        if (!isPanning) return;
        isPanning = false;
        tableWrapper.classList.remove("dragging-scroll");
      });

      tableWrapper.addEventListener("mouseleave", () => {
        if (!isPanning) return;
        isPanning = false;
        tableWrapper.classList.remove("dragging-scroll");
      });
    }

    document.addEventListener("click", (event) => {
      if (!themeMenuOpen) return;
      if (themeSwitcher && event.target && themeSwitcher.contains(event.target)) return;
      closeThemeMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeThemeMenu();
        closeHeaderMenu();
      }
    });

    if (headerMenu) {
      headerMenu.addEventListener("mouseenter", openHeaderMenu);
      headerMenu.addEventListener("mouseleave", scheduleCloseHeaderMenu);
    }
    headerMenuToggle?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (headerMenu?.classList.contains("header-menu-open")) {
        closeHeaderMenu();
      } else {
        openHeaderMenu();
      }
    });
    headerMenuPanel?.addEventListener("mouseenter", openHeaderMenu);
    headerMenuPanel?.addEventListener("mouseleave", scheduleCloseHeaderMenu);
    document.addEventListener("click", (event) => {
      if (headerMenu && headerMenu.contains(event.target)) return;
      closeHeaderMenu();
    });
    headerSettingsBtn?.addEventListener("click", () => {
      closeHeaderMenu();
      openSettingsModal();
      setActiveSettingsPanel("settingsThemePanel");
    });
    headerProfileBtn?.addEventListener("click", () => {
      closeHeaderMenu();
      window.location.href = "./account.html";
    });

    // Phone navigation is handled via index.html?mode=... links.
    // Additional settings entry points removed in favor of a single Settings button
    settingsModalBackdrop?.addEventListener("click", closeSettingsModal);
    settingsModalCloseBtn?.addEventListener("click", closeSettingsModal);
    settingsNav?.addEventListener("click", (event) => {
      const btn = event.target.closest(".settings-nav-item");
      if (!btn) return;
      const target = btn.dataset.panel;
      if (target) setActiveSettingsPanel(target);
    });
    const settingsColorsSaveBtn = document.getElementById("settingsColorsSaveBtn");
    const settingsColorsResetBtn = document.getElementById("settingsColorsResetBtn");
    settingsColorsSaveBtn?.addEventListener("click", () => {
      const trimmed = subjectColors.filter(Boolean);
      saveColorPalette(trimmed.length ? [...trimmed] : [...DEFAULT_SUBJECT_COLORS]);
      const meterSelect = document.getElementById("settingsMeterStyleSelect");
      const barSelect = document.getElementById("settingsStudyBarStyleSelect");
      const meterSingle = document.getElementById("settingsMeterSingleInput");
      const meterGradStart = document.getElementById("settingsMeterGradStartInput");
      const meterGradEnd = document.getElementById("settingsMeterGradEndInput");
      const updates = {};
      if (meterSelect) updates.meter = meterSelect.value;
      if (barSelect) updates.studyBar = barSelect.value;
      if (meterSingle) updates.meterSingle = meterSingle.value;
      if (meterGradStart) updates.meterGradStart = meterGradStart.value;
      if (meterGradEnd) updates.meterGradEnd = meterGradEnd.value;
      applyStylePrefs(updates);
      saveStylePrefs();
      renderTable();
      renderTodayTodos();
      renderScheduleView();
      renderSmartSuggestions();
      updateTodayStudyUI();
      renderSettingsPreview();
      showNotice("Colors and styles saved.", "success");
    });

    ["settingsMeterSingleInput", "settingsMeterGradStartInput", "settingsMeterGradEndInput"].forEach((id) => {
      document.getElementById(id)?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        settingsColorsSaveBtn?.click();
      });
    });

    settingsColorsResetBtn?.addEventListener("click", () => {
      saveColorPalette([...DEFAULT_SUBJECT_COLORS]);
      renderSettingsColorsList();
      populateSettingsColorsControls();
      applyStylePrefs({ meter: "classic", studyBar: "rounded" });
      saveStylePrefs();
      renderTable();
      renderTodayTodos();
      renderScheduleView();
      renderSmartSuggestions();
      updateTodayStudyUI();
      renderSettingsPreview();
      showNotice("Palette reset to default.", "info");
    });
    const meterControls = [
      "settingsMeterStyleSelect",
      "settingsMeterSingleInput",
      "settingsMeterGradStartInput",
      "settingsMeterGradEndInput",
      "settingsStudyBarStyleSelect"
    ];
    meterControls.forEach((id) => {
      const el = document.getElementById(id);
      el?.addEventListener("input", () => {
        renderSettingsPreview();
      });
      el?.addEventListener("change", () => {
        renderSettingsPreview();
      });
    });
    timerModeCountdownBtn?.addEventListener("click", () => {
      if (!activeStudy) return;
      activeStudy.timerMode = "countdown";
      saveActiveSession();
      timerModeCountdownBtn.classList.add("focus-timer-active");
      timerModeStopwatchBtn?.classList.remove("focus-timer-active");
    });
    timerModeStopwatchBtn?.addEventListener("click", () => {
      if (!activeStudy) return;
      activeStudy.timerMode = "stopwatch";
      saveActiveSession();
      timerModeStopwatchBtn.classList.add("focus-timer-active");
      timerModeCountdownBtn?.classList.remove("focus-timer-active");
    });
    manualConfBtn?.addEventListener("click", () => {
      confidenceMode = "manual";
      if (SP_STORAGE) SP_STORAGE.setRaw(CONF_MODE_KEY, confidenceMode, { debounceMs: 0 });
      else localStorage.setItem(CONF_MODE_KEY, confidenceMode);
      manualConfBtn.classList.add("confidence-toggle-active");
      perceivedConfBtn?.classList.remove("confidence-toggle-active");
      renderTable();
      renderSmartSuggestions();
      updateSummary();
      renderTodayTodos();
    });
    perceivedConfBtn?.addEventListener("click", () => {
      confidenceMode = "perceived";
      if (SP_STORAGE) SP_STORAGE.setRaw(CONF_MODE_KEY, confidenceMode, { debounceMs: 0 });
      else localStorage.setItem(CONF_MODE_KEY, confidenceMode);
      perceivedConfBtn.classList.add("confidence-toggle-active");
      manualConfBtn?.classList.remove("confidence-toggle-active");
      renderTable();
      renderSmartSuggestions();
      updateSummary();
      renderTodayTodos();
    });
    function updateTimerModeButtons(mode) {
      if (mode === "stopwatch") {
        timerModeStopwatchBtn?.classList.add("focus-timer-active");
        timerModeCountdownBtn?.classList.remove("focus-timer-active");
        if (focusTimerLabel) focusTimerLabel.textContent = "Stopwatch";
      } else {
        timerModeCountdownBtn?.classList.add("focus-timer-active");
        timerModeStopwatchBtn?.classList.remove("focus-timer-active");
        if (focusTimerLabel) focusTimerLabel.textContent = "Countdown";
      }
    }
    timerModeCountdownBtn?.addEventListener("click", () => {
      timerModePref = "countdown";
      if (!activeStudy) {
        updateTimerModeButtons("countdown");
        return;
      }
      activeStudy.timerMode = "countdown";
      saveActiveSession();
      updateTimerModeButtons("countdown");
    });
    timerModeStopwatchBtn?.addEventListener("click", () => {
      timerModePref = "stopwatch";
      if (!activeStudy) {
        updateTimerModeButtons("stopwatch");
        return;
      }
      activeStudy.timerMode = "stopwatch";
      saveActiveSession();
      updateTimerModeButtons("stopwatch");
    });
    const maximizeSubjectsBtn = document.getElementById("maximizeSubjectsBtn");
    maximizeSubjectsBtn?.addEventListener("click", () => {
      toggleSubjectsMaximize();
    });
	    window.addEventListener("resize", () => {
	      enforceTodayHeight();
	      applyDesktopSubjectSizing();
	      ensureSubjectFourSnap();
	      applyIpadFocusLayout();
	    });
    const settingsPrefsSaveBtn = document.getElementById("settingsPrefsSaveBtn");
    settingsPrefsSaveBtn?.addEventListener("click", () => {
      const langSelect = document.getElementById("settingsLanguageSelect");
      const contrastSelect = document.getElementById("settingsContrastSelect");
      const cvdSelect = document.getElementById("settingsCvdSelect");
      const study = document.getElementById("settingsStudyMinutes");
      const short = document.getElementById("settingsShortMinutes");
      const long = document.getElementById("settingsLongMinutes");
      if (langSelect) {
        saveLanguagePreference(langSelect.value);
      }
      if (contrastSelect) {
        applyStylePrefs({ contrast: contrastSelect.value });
        saveStylePrefs();
      }
      if (cvdSelect) {
        applyStylePrefs({ cvd: cvdSelect.value });
        saveStylePrefs();
        renderSettingsPreview();
        renderTable();
        renderTodayTodos();
        renderScheduleView();
        renderDueSoonLane();
        renderSmartSuggestions();
        updateTodayStudyUI();
        updateSummary();
      }
      const studyVal = Number(study?.value || pomoConfig.study);
      const shortVal = Number(short?.value || pomoConfig.short);
      const longVal = Number(long?.value || pomoConfig.long);
      if (!Number.isNaN(studyVal) && studyVal > 0) pomoConfig.study = studyVal;
      if (!Number.isNaN(shortVal) && shortVal > 0) pomoConfig.short = shortVal;
      if (!Number.isNaN(longVal) && longVal > 0) pomoConfig.long = longVal;

      const dailyMax = document.getElementById("budgetDailyMax");
      const weeklyMax = document.getElementById("budgetWeeklyMax");
      const budgetMode = document.getElementById("budgetMode");
      if (window.StudyPlanner?.TimeBudget?.save && (dailyMax || weeklyMax || budgetMode)) {
        window.StudyPlanner.TimeBudget.save({
          dailyMaxMinutes: Number(dailyMax?.value || 0) || 0,
          weeklyMaxMinutes: Number(weeklyMax?.value || 0) || 0,
          mode: budgetMode?.value === "hard" ? "hard" : "warn"
        });
      }

      const notifEnableToasts = document.getElementById("notifEnableToasts");
      const notifEnableSystem = document.getElementById("notifEnableSystem");
      const notifLeadTime = document.getElementById("notifLeadTime");
      const notifQuietStart = document.getElementById("notifQuietStart");
      const notifQuietEnd = document.getElementById("notifQuietEnd");
      if (window.StudyPlanner?.Notifications?.saveSettings && (notifEnableToasts || notifEnableSystem || notifLeadTime)) {
        window.StudyPlanner.Notifications.saveSettings({
          enableToasts: notifEnableToasts?.checked !== false,
          enableSystem: !!notifEnableSystem?.checked,
          leadMinutes: Number(notifLeadTime?.value || 10) || 10,
          quietStart: notifQuietStart?.value || "22:00",
          quietEnd: notifQuietEnd?.value || "07:00"
        });
      }
      saveFocusConfig();
      showNotice("Preferences saved.", "success");
    });

    ["settingsStudyMinutes", "settingsShortMinutes", "settingsLongMinutes"].forEach((id) => {
      document.getElementById(id)?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        settingsPrefsSaveBtn?.click();
      });
    });

    settingsThemePickerBtn?.addEventListener("click", () => {
      closeSettingsModal();
      openHeaderMenu();
      themeToggleBtn?.focus();
    });
    document.addEventListener("mousemove", (event) => {
      if (!headerMenu) return;
      const rect = headerMenu.getBoundingClientRect();
      if (
        event.clientX < rect.left - 20 ||
        event.clientX > rect.right + 200 ||
        event.clientY < rect.top - 20 ||
        event.clientY > rect.bottom + 80
      ) {
        scheduleCloseHeaderMenu();
      }
    });

    if (viewBoardBtn) {
      viewBoardBtn.addEventListener("click", () => setActiveView("board"));
    }

    if (viewScheduleBtn) {
      viewScheduleBtn.addEventListener("click", () => setActiveView("schedule"));
    }

    // Filter removed

    if (schedulePrevWeekBtn) {
      schedulePrevWeekBtn.addEventListener("click", () => {
        if (isPhoneLayout()) {
          const cursor = getScheduleCursorDay();
          cursor.setDate(cursor.getDate() - 1);
          scheduleCursorDay = cursor;
        } else {
          if (!scheduleWeekStart) scheduleWeekStart = getWeekStart(new Date());
          scheduleWeekStart.setDate(scheduleWeekStart.getDate() - 7);
          scheduleWeekendShifted = false;
          if (scheduleWeekendToggleBtn) {
            scheduleWeekendToggleBtn.setAttribute("aria-pressed", "false");
            scheduleWeekendToggleBtn.textContent = "Show weekend";
          }
        }
        renderScheduleView();
      });
    }

    if (scheduleNextWeekBtn) {
      scheduleNextWeekBtn.addEventListener("click", () => {
        if (isPhoneLayout()) {
          const cursor = getScheduleCursorDay();
          cursor.setDate(cursor.getDate() + 1);
          scheduleCursorDay = cursor;
        } else {
          if (!scheduleWeekStart) scheduleWeekStart = getWeekStart(new Date());
          scheduleWeekStart.setDate(scheduleWeekStart.getDate() + 7);
          scheduleWeekendShifted = false;
          if (scheduleWeekendToggleBtn) {
            scheduleWeekendToggleBtn.setAttribute("aria-pressed", "false");
            scheduleWeekendToggleBtn.textContent = "Show weekend";
          }
        }
        renderScheduleView();
      });
    }

    if (scheduleTodayBtn) {
      scheduleTodayBtn.addEventListener("click", () => {
        if (isPhoneLayout()) {
          scheduleCursorDay = new Date();
        } else {
          scheduleWeekStart = getWeekStart(new Date());
        }
        if (!isPhoneLayout()) {
          scheduleWeekendShifted = false;
          if (scheduleWeekendToggleBtn) {
            scheduleWeekendToggleBtn.setAttribute("aria-pressed", "false");
            scheduleWeekendToggleBtn.textContent = "Show weekend";
          }
        }
        renderScheduleView();
      });
    }

    if (scheduleWeekendToggleBtn) {
      scheduleWeekendToggleBtn.addEventListener("click", () => {
        if (
          isPhoneLayout() ||
          !(typeof isIpadLandscapeLayout === "function" && isIpadLandscapeLayout())
        )
          return;
        if (!scheduleWeekendShifted) {
          scheduleWeekendShifted = true;
          scheduleWeekendToggleBtn.setAttribute("aria-pressed", "true");
          scheduleWeekendToggleBtn.textContent = "Back to week";
        } else {
          scheduleWeekendShifted = false;
          scheduleWeekendToggleBtn.setAttribute("aria-pressed", "false");
          scheduleWeekendToggleBtn.textContent = "Show weekend";
        }
        renderScheduleView();
      });
    }

    const scrollTopBtn = document.getElementById("scrollTopBtn");
    if (scrollTopBtn) {
      scrollTopBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    applyIpadFocusLayout();

    if (scheduleTaskCloseBtn) {
      scheduleTaskCloseBtn.addEventListener("click", () => {
        closeScheduleTaskModal();
      });
    }

    if (noticeModalCancelBtn) {
      noticeModalCancelBtn.addEventListener("click", () => handleNoticeCancel());
    }

    if (noticeModalConfirmBtn) {
      noticeModalConfirmBtn.addEventListener("click", () => handleNoticeConfirm());
    }

    if (addTodoModalCancel) {
      addTodoModalCancel.addEventListener("click", () => {
        closeAddTodoModal();
      });
    }
    addTodoSubtaskAdd?.addEventListener("click", addSubtaskFromInput);
    addTodoSubtaskInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addSubtaskFromInput();
      }
    });
    const addTodoModalA11y = window.StudyA11y
      ? window.StudyA11y.withModalA11y(
          addTodoModalBackdrop,
          () => closeAddTodoModal(),
          () => addTodoSubtaskInput || addTodoModalSave || addTodoModalTitle
        )
      : null;
    window.addTodoModalA11y = addTodoModalA11y;
    addTodoModalClose?.addEventListener("click", () => closeAddTodoModal());
    addTodoModalSave?.addEventListener("click", () => submitAddTodoModal());
    addTodoModalBackdrop?.addEventListener("mousedown", (event) => {
      if (event.target === addTodoModalBackdrop) {
        closeAddTodoModal();
      }
    });

    scheduleManualTodoSubtaskAdd?.addEventListener("click", addScheduleManualTodoSubtaskFromInput);
    scheduleManualTodoSubtaskInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addScheduleManualTodoSubtaskFromInput();
      }
    });
    scheduleManualTodoTypeSelect?.addEventListener("change", () => {
      setScheduleManualTodoModalType(scheduleManualTodoTypeSelect.value);
      if (scheduleManualTodoModalBackdrop && !scheduleManualTodoModalBackdrop.hidden) {
        if (scheduleManualTodoModalState && scheduleManualTodoModalState.type === "subject_todo") {
          scheduleManualTodoSubjectSelect?.focus();
        } else {
          scheduleManualTodoNameInput?.focus();
        }
      }
    });
    scheduleManualTodoSubjectSelect?.addEventListener("change", () => {
      renderScheduleManualTodoFileOptions(scheduleManualTodoSubjectSelect.value, "");
      scheduleManualTodoFileSelect?.focus();
    });
    scheduleManualTodoNameInput?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      scheduleManualTodoModalSave?.click();
    });

    scheduleManualTodoModalClose?.addEventListener("click", () => closeScheduleManualTodoModal());
    scheduleManualTodoModalCancel?.addEventListener("click", () => closeScheduleManualTodoModal());
    scheduleManualTodoModalSave?.addEventListener("click", () => submitScheduleManualTodoModal());
    scheduleManualTodoModalBackdrop?.addEventListener("mousedown", (event) => {
      if (event.target === scheduleManualTodoModalBackdrop) {
        closeScheduleManualTodoModal();
      }
    });

    if (noticeModalBackdrop) {
      noticeModalBackdrop.addEventListener("mousedown", (event) => {
        if (event.target === noticeModalBackdrop) {
          handleNoticeCancel();
        }
      });
    }

    if (subjectSettingsBackdrop) {
      subjectSettingsBackdrop.addEventListener("mousedown", (event) => {
        if (event.target === subjectSettingsBackdrop) closeSubjectSettingsModal();
      });
    }
    if (window.StudyA11y && subjectSettingsBackdrop) {
      window.subjectSettingsA11y = window.StudyA11y.withModalA11y(
        subjectSettingsBackdrop,
        () => closeSubjectSettingsModal(),
        () => subjectSettingsNameInput || subjectSettingsNameInput
      );
    }
    subjectSettingsCloseBtn?.addEventListener("click", closeSubjectSettingsModal);
    subjectSettingsCancelBtn?.addEventListener("click", closeSubjectSettingsModal);
    subjectNotesBtn?.addEventListener("click", () => {
      const Notes = window.StudyPlanner && window.StudyPlanner.Notes ? window.StudyPlanner.Notes : null;
      if (!Notes) return;
      if (!subjectSettingsState) return;
      const subj = subjects.find((s) => s.id === subjectSettingsState.subjectId);
      if (!subj) return;
      Notes.open({ scope: "subject", scopeId: subj.id, label: `Notes · ${subj.name}` });
    });

    subjectSettingsCustomColor?.addEventListener("input", () => {
      const v = String(subjectSettingsCustomColor.value || "").trim();
      if (isHexColor(v)) {
        subjectSettingsTempColor = v;
        renderSubjectSettingsSwatches(v);
        updateSubjectSettingsPreview();
      }
    });

    subjectSettingsSaveBtn?.addEventListener("click", () => {
      if (!subjectSettingsState) return;
      const subj = subjects.find((s) => s.id === subjectSettingsState.subjectId);
      if (!subj) return closeSubjectSettingsModal();

      const nextName = String(subjectSettingsNameInput?.value || "").trim();
      if (nextName) {
        subj.name = nextName;
        renameSubjectEverywhere(subj.id, nextName);
      }

      if (subjectSettingsTempColor && isHexColor(subjectSettingsTempColor)) {
        subj.color = subjectSettingsTempColor;
      }

      const alpha = Number(subjectSettingsStrength?.value);
      if (Number.isFinite(alpha)) {
        subj.tintAlpha = Math.max(0.05, Math.min(0.6, alpha));
      }

      saveToStorage();
      renderSubjectOptions();
      renderTable();
      renderTodayTodos();
      renderScheduleView();
      closeSubjectSettingsModal();
    });

    if (scheduleTaskModalBackdrop) {
      scheduleTaskModalBackdrop.addEventListener("mousedown", (event) => {
        if (event.target === scheduleTaskModalBackdrop) {
          closeScheduleTaskModal();
        }
      });
    }

    if (scheduleManualTodoModalBackdrop) {
      scheduleManualTodoModalBackdrop.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeScheduleManualTodoModal();
        }
      });
    }

    window.addEventListener("study:calendar-changed", () => {
      loadCalendarEvents();
      renderScheduleView();
    });

    if (todayDropZone) {
      todayDropZone.addEventListener("dragenter", (event) => {
        if (!dragState) return;
        event.preventDefault();
        todayDropZone.classList.add("today-dropzone-active");
      });
      todayDropZone.addEventListener("dragover", (event) => {
        if (!dragState) return;
        event.preventDefault();
        todayDropZone.classList.add("today-dropzone-active");
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      });
      todayDropZone.addEventListener("dragleave", () => {
        todayDropZone.classList.remove("today-dropzone-active");
      });
      todayDropZone.addEventListener("drop", (event) => {
        event.preventDefault();
        todayDropZone.classList.remove("today-dropzone-active");
        if (!dragState) return;
        addTodoForFile(dragState.subjectId, dragState.fileId);
        dragState = null;
      });
    }

    modalConfidenceRange.addEventListener("input", () => {
      modalConfidenceValue.textContent = modalConfidenceRange.value + "%";
    });

    modalCancelBtn.addEventListener("click", () => {
      closeFileModal();
    });

    fileModalCloseBtn.addEventListener("click", () => {
      closeFileModal();
    });

    fileModalBackdrop.addEventListener("mousedown", (event) => {
      if (event.target === fileModalBackdrop) {
        closeFileModal();
      }
    });

    const clickFileSaveOnEnter = (input) => {
      input?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        modalSaveBtn?.click();
      });
    };
    clickFileSaveOnEnter(modalFileNameInput);
    clickFileSaveOnEnter(modalFileNotesInput);

    openFileNotesBtn?.addEventListener("click", () => {
      const Notes = window.StudyPlanner && window.StudyPlanner.Notes ? window.StudyPlanner.Notes : null;
      if (!Notes) {
        showNotice("Notes are unavailable (notes.js not loaded).", "warn");
        return;
      }
      if (!fileModalState || fileModalState.mode !== "edit") {
        showNotice("Save the file once before adding Markdown notes.", "warn");
        return;
      }
      const subj = subjects.find((s) => s.id === fileModalState.subjectId);
      const file = subj && Array.isArray(subj.files) ? subj.files.find((f) => f.id === fileModalState.fileId) : null;
      if (!subj || !file) return;
      Notes.open({ scope: "file", scopeId: `${subj.id}:${file.id}`, label: `Notes · ${file.name}` });
    });

    modalSaveBtn.addEventListener("click", () => {
      if (!fileModalState) return;

      const fileName = modalFileNameInput.value.trim();
      const notes = modalFileNotesInput.value.trim();
      const conf = Number(modalConfidenceRange.value);
      const selectedSubjectId = modalSubjectSelect.value;

      if (!subjects.length) {
        showNotice("Please create a subject first.", "warn");
        return;
      }

      if (!fileName) {
        showNotice("Please enter a file or topic name.", "warn");
        return;
      }

      const targetSubject =
        subjects.find((s) => s.id === selectedSubjectId) || subjects[0];

      if (fileModalState.mode === "add") {
        const newFile = {
          id: createId(),
          name: fileName,
          notes,
          confidence: conf,
          lastReviewed: null,
          totalMs: 0,
          sessions: 0,
          lastSessionMs: 0
        };
        targetSubject.files.push(newFile);
        updateManualOrder(targetSubject);
      } else {
        const originalSubject = subjects.find(
          (s) => s.id === fileModalState.subjectId
        );
        if (!originalSubject) {
          closeFileModal();
          renderTable();
          return;
        }
        const file = originalSubject.files.find(
          (f) => f.id === fileModalState.fileId
        );
        if (!file) {
          closeFileModal();
          renderTable();
          return;
        }

        if (originalSubject.id === targetSubject.id) {
          file.name = fileName;
          file.notes = notes;
          file.confidence = conf;
          updateManualOrder(originalSubject);
          syncTodoForFile(
            originalSubject.id,
            originalSubject.id,
            file.id,
            fileName,
            originalSubject.name
          );
        } else {
            originalSubject.files = originalSubject.files.filter(
              (f) => f.id !== fileModalState.fileId
            );
            updateManualOrder(originalSubject);
            const movedFile = {
              id: fileModalState.fileId,
              name: fileName,
              notes,
              confidence: conf,
              lastReviewed: file.lastReviewed || null,
              totalMs: file.totalMs || 0,
              sessions: file.sessions || 0,
              lastSessionMs: file.lastSessionMs || 0,
              dailyMsPacked: file.dailyMsPacked || packLegacyDayObject(file.dailyMs),
              dailySessionsPacked: file.dailySessionsPacked || packLegacyDayObject(file.dailySessions)
            };
            targetSubject.files.push(movedFile);
            updateManualOrder(targetSubject);
            syncTodoForFile(
              originalSubject.id,
              targetSubject.id,
              fileModalState.fileId,
            fileName,
            targetSubject.name
          );
        }
      }

      saveToStorage();
      closeFileModal();
      renderTable();
    });

    modalDeleteBtn.addEventListener("click", () => {
      if (!fileModalState || fileModalState.mode !== "edit") {
        closeFileModal();
        return;
      }
      const subj = subjects.find((s) => s.id === fileModalState.subjectId);
      if (!subj) {
        closeFileModal();
        return;
      }
      const file = subj.files.find((f) => f.id === fileModalState.fileId);
      if (!file) {
        closeFileModal();
        return;
      }
      if (
        !confirm(
          `Delete file "${file.name}" from subject "${subj.name}"?`
        )
      ) {
        return;
      }

      if (
        activeStudy &&
        activeStudy.kind === "study" &&
        activeStudy.subjectId === subj.id &&
        activeStudy.fileId === file.id
      ) {
        activeStudy = null;
        clearActiveSession();
      }

      subj.files = subj.files.filter((f) => f.id !== fileModalState.fileId);
      cleanupTodoForFile(subj.id, file.id);
      saveToStorage();
      closeFileModal();
      renderTable();
      renderFocusState();
    });

    // Timer settings modal
    openTimerSettingsBtn.addEventListener("click", () => {
      toggleInlineTimerPanel(true);
    });

    if (timerInlineCancel) {
      timerInlineCancel.addEventListener("click", () => {
        toggleInlineTimerPanel(false);
      });
    }

    if (timerInlineSave) {
      timerInlineSave.addEventListener("click", () => {
        const newStudy = clampMinutes(timerInlineStudy.value, pomoConfig.study || 25);
        const newShort = clampMinutes(timerInlineShort.value, pomoConfig.short || 5);
        const newLong = clampMinutes(timerInlineLong.value, pomoConfig.long || 15);

        pomoConfig.study = newStudy;
        pomoConfig.short = newShort;
        pomoConfig.long = newLong;
        saveFocusConfig();
        renderSmartSuggestions();
        renderDueSoonLane();
        toggleInlineTimerPanel(false);
      });

      const clickTimerInlineSaveOnEnter = (input) => {
        input?.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          timerInlineSave.click();
        });
      };
      clickTimerInlineSaveOnEnter(timerInlineStudy);
      clickTimerInlineSaveOnEnter(timerInlineShort);
      clickTimerInlineSaveOnEnter(timerInlineLong);
    }

    // Break buttons
    startShortBreakBtn.addEventListener("click", () => {
      startBreak("short");
    });

    startLongBreakBtn.addEventListener("click", () => {
      startBreak("long");
    });

    // Stats modal
    openStatsBtn.addEventListener("click", () => {
      openStatsModal();
    });

    statsCloseBtn.addEventListener("click", () => {
      closeStatsModal();
    });

    statsCloseBtn2.addEventListener("click", () => {
      closeStatsModal();
    });

    statsBackdrop.addEventListener("mousedown", (event) => {
      if (event.target === statsBackdrop) {
        closeStatsModal();
      }
    });

    const subjectPrevBtn = document.getElementById("subjectPrevBtn");
    const subjectNextBtn = document.getElementById("subjectNextBtn");
    const subjectBackBtn = document.getElementById("subjectBackBtn");
    subjectPrevBtn?.addEventListener("click", () => {
      subjectCursorIndex = Math.max(0, subjectCursorIndex - 1);
      applySubjectPaging();
    });
    subjectNextBtn?.addEventListener("click", () => {
      subjectCursorIndex = subjectCursorIndex + 1;
      applySubjectPaging();
    });
      subjectBackBtn?.addEventListener("click", () => {
        if (
          document.body.dataset.mode === "today" &&
          document.body.classList.contains("today-picker-open")
        ) {
          document.body.classList.remove("today-picker-open");
          const pickBtn = document.getElementById("todayPickToggleBtn");
          if (pickBtn) pickBtn.textContent = "Add from subjects";
          const backBtn = document.getElementById("todayPickerBackBtn");
          if (backBtn) backBtn.hidden = true;
          renderTable();
          const sidebar = document.querySelector("#layoutRow .today-sidebar");
          sidebar?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });

    function getPageMode() {
      const mode = new URLSearchParams(window.location.search).get("mode");
      if (mode === "subjects" || mode === "today" || mode === "schedule") return mode;
      return "board";
    }

	    function applyPageMode() {
	      const mode = getPageMode();
	      document.body.dataset.mode = mode;
	      applySubjectPaging();
	    }

		    function applySyncedStateFromStorage() {
	      loadThemePreference();
	      loadColorPalette();
	      loadStylePrefs();
	      applyStylePrefs();

		      const savedConfMode = SP_STORAGE ? SP_STORAGE.getRaw(CONF_MODE_KEY, null) : localStorage.getItem(CONF_MODE_KEY);
		      confidenceMode = savedConfMode === "perceived" ? "perceived" : "manual";
	      if (confidenceMode === "perceived") {
	        perceivedConfBtn?.classList.add("confidence-toggle-active");
	        manualConfBtn?.classList.remove("confidence-toggle-active");
	      } else {
	        manualConfBtn?.classList.add("confidence-toggle-active");
	        perceivedConfBtn?.classList.remove("confidence-toggle-active");
	      }

	      saveLanguagePreference(loadLanguagePreference());
	      loadFromStorage();
	      loadDailyFocusMap();
	      loadTodayTodos();
	      loadFocusConfig();
	      loadCalendarEvents();

	      if (activeStudy && activeStudy.kind === "study") {
	        const { subj, file } = resolveFileRef(activeStudy.subjectId, activeStudy.fileId);
	        if (!subj || !file) {
	          activeStudy = null;
	          clearActiveSession();
	        }
	      }

	      renderSubjectOptions();
	      renderFocusState();
	      renderTodayTodos();
	      applyPageMode();
	      renderTable();
	      if (activeView === "schedule") {
	        renderScheduleView();
	      } else {
	        applyTodayExpandedLayout();
	      }
	      updateHeaderProfileLabel();
	    }

	    window.addEventListener("study:state-replaced", () => {
	      applySyncedStateFromStorage();
	    });

	    function maybeAutoResumeNavPausedSession() {
	      if (
	        activeStudy &&
	        activeStudy.paused &&
        activeStudy.pausedReason === "nav" &&
        activeStudy.autoResume === true
      ) {
        resumeActiveSession({ clearNavFlags: true });
      }
    }

    // Initial load
    loadThemePreference();
    loadColorPalette();
    loadStylePrefs();
	    applyStylePrefs();
	    const savedConfMode = SP_STORAGE ? SP_STORAGE.getRaw(CONF_MODE_KEY, null) : localStorage.getItem(CONF_MODE_KEY);
	    if (savedConfMode === "perceived") confidenceMode = "perceived";
    if (confidenceMode === "perceived") {
      perceivedConfBtn?.classList.add("confidence-toggle-active");
      manualConfBtn?.classList.remove("confidence-toggle-active");
    }
    saveLanguagePreference(loadLanguagePreference());
    loadFromStorage();
    activeStudy = loadActiveSession();
    maybeAutoResumeNavPausedSession();
    loadDailyFocusMap();
    loadTodayTodos();
    loadFocusConfig();
    loadCalendarEvents();
    saveToStorage();
    scheduleWeekStart = getWeekStart(new Date());
    renderSubjectOptions();
    renderFocusState();
    renderTodayTodos();
    renderTable();
    applyPageMode();
    setActiveView(getPageMode() === "schedule" ? "schedule" : "board");
    updateHeaderProfileLabel();

    function handleOpenEntity(detail) {
      if (!detail || typeof detail !== "object") return;
      if (detail.kind === "subject" && detail.subjectId) {
        openSubjectSettingsModal(detail.subjectId);
        return;
      }
      if (detail.kind === "file" && detail.subjectId && detail.fileId) {
        const subj = subjects.find((s) => s.id === detail.subjectId);
        const file = subj && Array.isArray(subj.files) ? subj.files.find((f) => f.id === detail.fileId) : null;
        if (subj && file) openFileModalEdit(subj.id, file);
        return;
      }
      if (detail.kind === "assignment" && detail.assignmentId) {
        const params = new URLSearchParams();
        params.set("openAssignmentId", detail.assignmentId);
        window.location.href = `calendar.html?${params.toString()}`;
      }
    }

    window.addEventListener("study:open-entity", (event) => {
      handleOpenEntity(event && event.detail);
    });

    // URL deep-links (from Notes links or other pages).
    try {
      const params = new URLSearchParams(window.location.search || "");
      const startStudy = params.get("startStudy");
      const startAssignment = params.get("startAssignment");
      const assignmentId = params.get("assignmentId");
      const subjectId = params.get("subjectId");
      const fileId = params.get("fileId");
      const openSubjectId = params.get("openSubjectId");
      const openFileSubjectId = params.get("openFileSubjectId");
      const openFileId = params.get("openFileId");
      if (startAssignment && assignmentId && subjectId && fileId && !activeStudy) {
        const ref = resolveFileRef(subjectId, fileId);
        if (ref && ref.subj && ref.file) {
          startStudyForAssignment(assignmentId, subjectId, ref.file);
        }
      }
      if (startStudy && subjectId && fileId && !activeStudy) {
        const ref = resolveFileRef(subjectId, fileId);
        if (ref && ref.subj && ref.file) {
          startStudy(subjectId, ref.file);
        }
      }
      if (openSubjectId) {
        openSubjectSettingsModal(openSubjectId);
      } else if (openFileSubjectId && openFileId) {
        const subj = subjects.find((s) => s.id === openFileSubjectId);
        const file = subj && Array.isArray(subj.files) ? subj.files.find((f) => f.id === openFileId) : null;
        if (subj && file) openFileModalEdit(subj.id, file);
      }
      if (startStudy || startAssignment || openSubjectId || (openFileSubjectId && openFileId)) {
        params.delete("startStudy");
        params.delete("startAssignment");
        params.delete("assignmentId");
        params.delete("subjectId");
        params.delete("fileId");
        params.delete("openSubjectId");
        params.delete("openFileSubjectId");
        params.delete("openFileId");
        const next = params.toString();
        history.replaceState({}, "", next ? `?${next}` : window.location.pathname);
      }
    } catch {}

    if (sessionHeaderMount && window.StudyPlanner?.mountSessionHeader) {
      document.body.classList.add("session-header-mounted");
      window.StudyPlanner.mountSessionHeader({
        mountEl: sessionHeaderMount,
        variant: "full",
        context: { source: "board" },
      });
    }

    // If the user navigates away (calendar, schedule, etc.), pause the timer and
    // auto-resume when coming back to the main page.
    window.addEventListener("pagehide", () => {
      pauseActiveSession("nav", { autoResume: true });
    });

    // BFCache restore: auto-resume again when returning to this page.
    window.addEventListener("pageshow", (event) => {
      if (!event.persisted) return;
      maybeAutoResumeNavPausedSession();
      loadCalendarEvents();
      renderFocusState();
      updateStudyTimerDisplay();
      renderScheduleView();
    });
