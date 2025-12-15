	    let todayCollapsedMap = {};
	    let todayCollapsedMapLoaded = false;
	    const TODAY_COLLAPSED_KEY = "studyTodayCollapsed_v1";

	    function loadTodayCollapsedMap() {
	      try {
	        const raw = SP_STORAGE ? SP_STORAGE.getRaw(TODAY_COLLAPSED_KEY, null) : localStorage.getItem(TODAY_COLLAPSED_KEY);
	        if (!raw) return {};
	        const parsed = JSON.parse(raw);
	        return parsed && typeof parsed === "object" ? parsed : {};
	      } catch {
	        return {};
	      }
	    }

	    function saveTodayCollapsedMap(map) {
	      try {
	        const clean = map && typeof map === "object" ? map : {};
	        if (SP_STORAGE) SP_STORAGE.setJSON(TODAY_COLLAPSED_KEY, clean, { debounceMs: 150 });
	        else localStorage.setItem(TODAY_COLLAPSED_KEY, JSON.stringify(clean));
	      } catch {}
	    }

	    function renderTodayTodos() {
	      if (!todayList) return;
	      todayList.innerHTML = "";

	      // Per-item collapsed state (defaults to expanded to preserve existing look).
		      if (!todayCollapsedMapLoaded) {
		        todayCollapsedMapLoaded = true;
		        todayCollapsedMap = loadTodayCollapsedMap();
		      }

	      if (!todayTodos.length) {
	        const empty = document.createElement("div");
	        empty.className = "today-empty";
	        empty.textContent = "Drag files from subjects to build today's todo list.";
	        todayList.appendChild(empty);
	        return;
	      }

      const isDragMode = todayExpanded && !subjectsMaximized;
      const sortedTodos = isDragMode
        ? [...todayTodos]
        : [...todayTodos].sort((a, b) => {
            if (a.done === b.done) return 0;
            return a.done ? 1 : -1;
          });

      const activeItems = [];
      const completedItems = [];

	      sortedTodos.forEach((todo) => {
	        const { subj, file } = resolveFileRef(todo.subjectId, todo.fileId);
	        const subjColor = getSubjectColorById(todo.subjectId);
	        const tintAlpha = getSubjectTintAlphaById(todo.subjectId);
	        const item = document.createElement("div");
	        item.className = "today-item";
        const tinted = hexToRgba(subjColor, tintAlpha);
        const borderTint = hexToRgba(subjColor, Math.max(0.2, Math.min(0.7, tintAlpha * 2.25)));
        item.style.setProperty("--todo-accent", subjColor);
	        if (tinted) item.style.backgroundColor = tinted;
	        if (borderTint) item.style.borderColor = borderTint;
	        if (todo.done) item.classList.add("today-item-done");
	        if (!file || !subj) item.classList.add("today-item-missing");
	        const isCollapsed = !!(todayCollapsedMap && todayCollapsedMap[todo.id]);
	        if (isCollapsed) item.classList.add("today-item-collapsed");
        if (isDragMode) {
          item.setAttribute("draggable", "true");
          item.dataset.todoId = todo.id;
          item.addEventListener("dragstart", (event) => {
            event.dataTransfer?.setData("text/plain", todo.id);
            item.classList.add("dragging");
            todayDragId = todo.id;
          });
          item.addEventListener("dragend", () => {
            item.classList.remove("dragging");
            todayDragId = null;
            const targets = todayList.querySelectorAll(".today-item.drop-target");
            targets.forEach((el) => el.classList.remove("drop-target"));
          });
          item.addEventListener("dragover", (event) => {
            if (!todayDragId || todayDragId === todo.id) return;
            event.preventDefault();
            item.classList.add("drop-target");
          });
          item.addEventListener("dragleave", () => {
            item.classList.remove("drop-target");
          });
          item.addEventListener("drop", (event) => {
            event.preventDefault();
            item.classList.remove("drop-target");
            if (!todayDragId || todayDragId === todo.id) return;
            moveTodo(todayDragId, todo.id);
          });
        }

        const topRow = document.createElement("div");
        topRow.className = "today-item-top";

        const left = document.createElement("div");
        left.className = "today-item-left";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !!todo.done;
        checkbox.addEventListener("change", () => {
          toggleTodoDone(todo.id, checkbox.checked, { promptConfidence: true });
        });

        const colorDot = document.createElement("span");
        colorDot.className = "today-color-dot";
        colorDot.style.backgroundColor = subjColor;

        const textWrap = document.createElement("div");
        textWrap.className = "today-text";

	        const title = document.createElement("div");
	        title.className = "today-title";
	        title.textContent = (file && file.name) || todo.label || "Untitled";

	        const subs = Array.isArray(todo.subtasks) ? todo.subtasks : [];
	        const collapsedHint = document.createElement("span");
	        collapsedHint.className = "today-collapsed-hint";
	        collapsedHint.textContent = `(${subs.length} subtask${subs.length === 1 ? "" : "s"})`;
	        title.appendChild(collapsedHint);

	        textWrap.appendChild(title);

        left.appendChild(checkbox);
        left.appendChild(colorDot);
        left.appendChild(textWrap);

	        const actions = document.createElement("div");
	        actions.className = "today-actions";

	        const collapseBtn = document.createElement("button");
	        collapseBtn.type = "button";
	        collapseBtn.className = "today-collapse-btn icon-btn icon-btn-ghost";
	        collapseBtn.setAttribute("aria-label", isCollapsed ? "Expand subtasks" : "Collapse subtasks");
	        collapseBtn.textContent = isCollapsed ? "▸" : "▾";
	        collapseBtn.addEventListener("click", (e) => {
	          e.stopPropagation();
	          todayCollapsedMap = todayCollapsedMap && typeof todayCollapsedMap === "object" ? todayCollapsedMap : {};
	          const next = !todayCollapsedMap[todo.id];
	          todayCollapsedMap[todo.id] = next;
	          saveTodayCollapsedMap(todayCollapsedMap);
	          renderTodayTodos();
	        });
	        item.appendChild(collapseBtn);

        const timerSpan = document.createElement("span");
        timerSpan.className = "today-timer";
        timerSpan.id = "today-timer-" + todo.fileId;
        timerSpan.textContent = isActiveStudy(todo.subjectId, todo.fileId)
          ? formatHMS(computeElapsedMs(activeStudy))
          : "";

        const isThisActive = isActiveStudy(todo.subjectId, todo.fileId);
        const isPaused = isThisActive && activeStudy && activeStudy.paused;

        if (!todo.done) {
          if (!isThisActive) {
            const studyBtn = document.createElement("button");
            studyBtn.type = "button";
            studyBtn.className = "chip-btn chip-btn-primary";
            studyBtn.textContent = "Study";
            studyBtn.addEventListener("click", () => {
              if (subj && file) {
                startStudy(todo.subjectId, file);
              }
            });
            actions.appendChild(timerSpan);
            actions.appendChild(studyBtn);
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "today-remove-btn";
          removeBtn.textContent = "Remove";
          removeBtn.addEventListener("click", () => {
            showNotice("Remove this item from Today's focus?", "warn", () => {
              removeTodo(todo.id);
            });
          });
          actions.appendChild(removeBtn);
          } else {
            const primaryBtn = document.createElement("button");
            primaryBtn.type = "button";
            primaryBtn.className = "chip-btn chip-btn-primary";
            primaryBtn.textContent = isPaused ? "Resume" : "Pause";
            primaryBtn.addEventListener("click", () => {
              if (!activeStudy) return;
              if (activeStudy.paused) {
                activeStudy.startTimeMs = Date.now();
                activeStudy.paused = false;
                renderFocusState();
                renderTable();
                renderTodayTodos();
                renderScheduleView();
                updateStudyTimerDisplay();
              } else {
                pauseStudy(todo.subjectId, todo.fileId);
              }
            });

            const stopBtn = document.createElement("button");
            stopBtn.type = "button";
            stopBtn.className = "chip-btn chip-btn-danger";
            stopBtn.textContent = "Stop";
            stopBtn.addEventListener("click", () => {
              stopStudy(todo.subjectId, todo.fileId);
            });

            actions.appendChild(timerSpan);
            actions.appendChild(primaryBtn);
            actions.appendChild(stopBtn);
          }
        }

        topRow.appendChild(left);
        topRow.appendChild(actions);

        // Subtasks
        const subtasksWrap = document.createElement("div");
        subtasksWrap.className = "today-subtasks";

        const subtasksList = document.createElement("div");
        subtasksList.className = "today-subtasks-list";

	        if (!subs.length) {
	          const hint = document.createElement("div");
	          hint.className = "today-subtasks-empty";
	          hint.textContent = "No subtasks yet. Add what you want to cover for this file.";
	          subtasksList.appendChild(hint);
	        } else {
          subs.forEach((sub) => {
            const row = document.createElement("div");
            row.className = "today-subtask-row";
            if (sub.done) row.classList.add("today-subtask-done");

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = !!sub.done;
            cb.addEventListener("change", () => {
              toggleSubtask(todo.id, sub.id, cb.checked, { promptConfidence: true });
            });

            const label = document.createElement("div");
            label.className = "today-subtask-label";
            label.textContent = sub.label || "Untitled subtask";

            const rm = document.createElement("button");
            rm.type = "button";
            rm.className = "today-subtask-remove";
            rm.textContent = "✕";
            rm.title = "Remove subtask";
            rm.addEventListener("click", () => {
              removeSubtask(todo.id, sub.id);
            });

            row.appendChild(cb);
            row.appendChild(label);
            row.appendChild(rm);
            subtasksList.appendChild(row);
          });
        }

        const addSubRow = document.createElement("div");
        addSubRow.className = "today-subtask-add";
        const addInput = document.createElement("input");
        addInput.type = "text";
        addInput.placeholder = "Add subtask...";
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.textContent = "+";
        addBtn.className = "today-subtask-add-btn";

        function commitSubtask() {
          const text = addInput.value.trim();
          if (!text) return;
          addSubtask(todo.id, text);
        }

        addBtn.addEventListener("click", commitSubtask);
        addInput.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitSubtask();
          }
        });

        addSubRow.appendChild(addInput);
        addSubRow.appendChild(addBtn);

        subtasksWrap.appendChild(subtasksList);
        subtasksWrap.appendChild(addSubRow);
        if (todayExpanded || subs.length > 4) {
          subtasksWrap.classList.add("today-subtasks-scroll");
        }

        const toggleSubsBtn = document.createElement("button");
        toggleSubsBtn.type = "button";
        toggleSubsBtn.className = "today-subtasks-toggle";
        toggleSubsBtn.textContent = "Subtasks";
        toggleSubsBtn.setAttribute("aria-expanded", "true");

        function updateToggleLabel() {
          const isCollapsed = subtasksWrap.classList.contains("collapsed");
          const count = subs.length;
          if (isCollapsed) {
            if (!count) toggleSubsBtn.textContent = "0 subtasks";
            else toggleSubsBtn.textContent = count === 1 ? "1 subtask" : `${count} subtasks`;
          } else {
            toggleSubsBtn.textContent = "Hide";
          }
          toggleSubsBtn.setAttribute("aria-expanded", String(!isCollapsed));
        }

        toggleSubsBtn.addEventListener("click", () => {
          subtasksWrap.classList.toggle("collapsed");
          updateToggleLabel();
        });

        updateToggleLabel();

        item.appendChild(topRow);
        if (!todo.done) {
          item.appendChild(toggleSubsBtn);
          item.appendChild(subtasksWrap);
        }

        if (todo.done) {
          completedItems.push(item);
        } else {
          activeItems.push(item);
        }
      });

      if (todayExpanded) {
        activeItems.forEach((node) => todayList.appendChild(node));
        // hide completed tasks entirely in maximized view
      } else {
        activeItems.forEach((node) => todayList.appendChild(node));
        completedItems.forEach((node) => todayList.appendChild(node));
      }

      renderScheduleView();
      renderSmartSuggestions();
      renderDueSoonLane();
      requestAnimationFrame(() => enforceTodayHeight());
    }

    function formatWeekRangeLabel(start, end) {
      if (!start || !end) return "";
      const opts = { month: "short" };
      const startMonth = start.toLocaleString(undefined, opts);
      const endMonth = end.toLocaleString(undefined, opts);
      const startText = startMonth + " " + start.getDate();
      const endText =
        (start.getFullYear() !== end.getFullYear() ? end.getFullYear() + " " : "") +
        endMonth +
        " " +
        end.getDate();
      return startText + " - " + endText;
    }

    function renderScheduleView() {
      if (!scheduleGrid) return;
      const phone = isPhoneLayout();

      let start;
      let end;
      let daysToRender = 7;

      if (phone) {
        const cursor = new Date(getScheduleCursorDay());
        start = cursor;
        end = cursor;
        daysToRender = 1;
        if (scheduleRangeLabel) {
          scheduleRangeLabel.textContent = cursor.toLocaleDateString(undefined, {
            weekday: "short",
            day: "2-digit",
            month: "short"
          });
        }
        if (scheduleTodayBtn) scheduleTodayBtn.textContent = "Today";
      } else {
        if (!scheduleWeekStart) scheduleWeekStart = getWeekStart(new Date());
        start = new Date(scheduleWeekStart);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        if (scheduleRangeLabel) {
          scheduleRangeLabel.textContent = formatWeekRangeLabel(start, end);
        }
        if (scheduleTodayBtn) scheduleTodayBtn.textContent = "This week";
      }

      scheduleGrid.innerHTML = "";
      const todayKey = getTodayKey();

      for (let i = 0; i < daysToRender; i++) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        const key = dateToKey(day);
        const dayList = Array.isArray(dailyFocusMap[key]) ? dailyFocusMap[key] : [];

        const col = document.createElement("div");
        col.className = "schedule-day";
        if (key === todayKey) col.classList.add("schedule-day-today");

        const header = document.createElement("div");
        header.className = "schedule-day-header";

        const dateLabel = document.createElement("div");
        dateLabel.className = "schedule-day-date";
        dateLabel.textContent =
          day.getDate() +
          " " +
          day.toLocaleString(undefined, { month: "short" }) +
          " " +
          day.getFullYear();

        const nameLabel = document.createElement("div");
        nameLabel.className = "schedule-day-name";
        nameLabel.textContent = day.toLocaleString(undefined, { weekday: "short" });

        header.appendChild(dateLabel);
        header.appendChild(nameLabel);

        const list = document.createElement("div");
        list.className = "schedule-list";

        // Keep tasks grouped by subject in the order they appear
        const subjectOrder = [];
        const subjectGroups = {};
        dayList.forEach((item) => {
          const sid = item.subjectId || "__none";
          if (!subjectGroups[sid]) {
            subjectGroups[sid] = [];
            subjectOrder.push(sid);
          }
          subjectGroups[sid].push(item);
        });
        const orderedList = [];
        subjectOrder.forEach((sid) => {
          orderedList.push(...(subjectGroups[sid] || []));
        });

        if (!orderedList.length) {
          const empty = document.createElement("div");
          empty.className = "schedule-empty";
          empty.textContent = "No focus captured.";
          list.appendChild(empty);
        } else {
          orderedList.forEach((todo) => {
            const { subj, file } = resolveFileRef(todo.subjectId, todo.fileId);
            const chip = document.createElement("div");
            chip.className = "schedule-focus-chip schedule-chip-subject";
            const color = getSubjectColorById(todo.subjectId);
            const tintAlpha = getSubjectTintAlphaById(todo.subjectId);
            const bg = hexToRgba(color, Math.max(0.12, Math.min(0.45, tintAlpha))) || "#f4f6fb";
            const border =
              hexToRgba(color, Math.max(0.25, Math.min(0.7, tintAlpha * 2.25))) || "#dfe4f0";
            chip.style.setProperty("--chip-bg", bg);
            chip.style.setProperty("--chip-border", border);
            chip.style.setProperty("--chip-ink", "#0f172a");
            const labelText = todo.label || "Untitled";

            const label = document.createElement("div");
            label.className = "schedule-chip-label";
            label.textContent = labelText;
            label.title = labelText;

            const isToday = key === todayKey;
            const isDone = !!todo.done;
            let studyBtn = null;
            if (isToday && !isDone) {
              studyBtn = document.createElement("button");
              studyBtn.type = "button";
              studyBtn.className = "schedule-chip-study";
              studyBtn.textContent = "Study";
              studyBtn.title = "Start a study session";
              studyBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                if (subj && file) {
                  startStudy(todo.subjectId, file);
                } else {
                  showNotice("This task is missing its subject or file.", "warn");
                }
              });
            }

            if (todo.done) chip.classList.add("schedule-chip-done");

            const isActive =
              activeStudy &&
              activeStudy.kind === "study" &&
              activeStudy.subjectId === todo.subjectId &&
              activeStudy.fileId === todo.fileId;
            if (isActive && studyBtn) {
              chip.classList.add("schedule-chip-active");
              studyBtn.textContent = "Studying";
            }

            const orderControls = document.createElement("div");
            orderControls.className = "schedule-chip-order";
            const upBtn = document.createElement("button");
            upBtn.type = "button";
            upBtn.className = "schedule-chip-order-btn";
            upBtn.textContent = "↑";
            upBtn.title = "Move up within subject";
            upBtn.addEventListener("click", (event) => {
              event.stopPropagation();
              moveScheduleItem(key, todo.id, "up");
            });

            const downBtn = document.createElement("button");
            downBtn.type = "button";
            downBtn.className = "schedule-chip-order-btn";
            downBtn.textContent = "↓";
            downBtn.title = "Move down within subject";
            downBtn.addEventListener("click", (event) => {
              event.stopPropagation();
              moveScheduleItem(key, todo.id, "down");
            });

            orderControls.appendChild(upBtn);
            orderControls.appendChild(downBtn);

            chip.appendChild(label);
            if (studyBtn) chip.appendChild(studyBtn);
            chip.addEventListener("click", () => openScheduleTaskModal(todo, key));

            // Drag & drop (within same subject)
            chip.draggable = true;
            chip.addEventListener("dragstart", (event) => {
              scheduleDrag = { dayKey: key, todoId: todo.id, subjectId: todo.subjectId };
              chip.classList.add("dragging");
              if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", todo.id);
              }
            });
            chip.addEventListener("dragend", () => {
              scheduleDrag = null;
              chip.classList.remove("dragging");
              document.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
            });
            chip.addEventListener("dragover", (event) => {
              if (
                !scheduleDrag ||
                scheduleDrag.dayKey !== key ||
                scheduleDrag.subjectId !== todo.subjectId ||
                scheduleDrag.todoId === todo.id
              )
                return;
              event.preventDefault();
              chip.classList.add("drag-over");
            });
            chip.addEventListener("dragleave", () => {
              chip.classList.remove("drag-over");
            });
            chip.addEventListener("drop", (event) => {
              if (
                !scheduleDrag ||
                scheduleDrag.dayKey !== key ||
                scheduleDrag.subjectId !== todo.subjectId ||
                scheduleDrag.todoId === todo.id
              )
                return;
              event.preventDefault();
              chip.classList.remove("drag-over");
              reorderScheduleWithinSubject(key, scheduleDrag.subjectId, scheduleDrag.todoId, todo.id);
              scheduleDrag = null;
            });

            list.appendChild(chip);
          });
        }

        col.appendChild(header);
        col.appendChild(list);
        scheduleGrid.appendChild(col);
      }
    }

    function closeScheduleTaskModal() {
      scheduleModalState = null;
      if (scheduleTaskModalBackdrop) {
        scheduleTaskModalBackdrop.style.display = "none";
        scheduleTaskModalBackdrop.hidden = true;
      }
    }

    function openScheduleTaskModal(todo, dayKey) {
      if (!scheduleTaskModalBackdrop || !scheduleTaskModalTitle || !scheduleTaskModalSubtasks) return;
      const onToday = dayKey === getTodayKey();
      scheduleModalState = { todoId: todo.id, dayKey };
      const subjName = todo.subjectName || "Task";
      scheduleTaskModalTitle.textContent = todo.label || subjName || "Task";
      if (scheduleTaskModalSubtitle) {
        scheduleTaskModalSubtitle.textContent = onToday
          ? "Today's subtasks"
          : "Subtasks (read-only history)";
      }

      scheduleTaskModalSubtasks.innerHTML = "";
      const subs = Array.isArray(todo.subtasks) ? todo.subtasks : [];
      if (!subs.length) {
            const empty = document.createElement("div");
            empty.className = "schedule-task-empty";
            empty.textContent = "No subtasks for this task.";
            scheduleTaskModalSubtasks.appendChild(empty);
      } else {
        subs.forEach((sub) => {
          const row = document.createElement("div");
          row.className = "schedule-task-row";
          if (sub.done) row.classList.add("schedule-task-row-done");
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = !!sub.done;
          cb.disabled = !onToday;

          if (onToday) {
            cb.addEventListener("change", () => {
              toggleSubtask(todo.id, sub.id, cb.checked, { promptConfidence: true });
            });
          }

          const label = document.createElement("div");
          label.className = "schedule-task-label";
          label.textContent = sub.label || "Subtask";

          row.appendChild(cb);
          row.appendChild(label);
          scheduleTaskModalSubtasks.appendChild(row);
        });
      }

      if (scheduleTaskStudyBtn) {
        scheduleTaskStudyBtn.disabled = !onToday;
        scheduleTaskStudyBtn.textContent = onToday ? "Study now" : "Study (today only)";
        scheduleTaskStudyBtn.onclick = () => {
          if (!onToday) return;
          const { file, subj } = resolveFileRef(todo.subjectId, todo.fileId);
          if (subj && file) {
            startStudy(todo.subjectId, file);
            closeScheduleTaskModal();
          } else {
            showNotice("This task is missing its subject or file.", "warn");
          }
        };
      }

      scheduleTaskModalBackdrop.hidden = false;
      scheduleTaskModalBackdrop.style.display = "flex";
    }

    function reorderScheduleWithinSubject(dayKey, subjectId, sourceId, targetId) {
      if (!dailyFocusMap || !dailyFocusMap[dayKey] || !Array.isArray(dailyFocusMap[dayKey])) return;
      const list = dailyFocusMap[dayKey];
      const order = [];
      const groups = {};
      list.forEach((item) => {
        const sid = item.subjectId || "__none";
        if (!groups[sid]) {
          groups[sid] = [];
          order.push(sid);
        }
        groups[sid].push(item);
      });

      const group = groups[subjectId || "__none"];
      if (!group) return;
      const sourceIdx = group.findIndex((t) => t.id === sourceId);
      const targetIdx = group.findIndex((t) => t.id === targetId);
      if (sourceIdx === -1 || targetIdx === -1 || sourceIdx === targetIdx) return;

      const [item] = group.splice(sourceIdx, 1);
      group.splice(targetIdx, 0, item);

      const newList = [];
      order.forEach((sid) => {
        newList.push(...(groups[sid] || []));
      });
      dailyFocusMap[dayKey] = newList;

      if (dayKey === getTodayKey()) {
        todayTodos = cloneTodos(newList);
        saveTodayTodos();
        renderTodayTodos();
      } else {
        saveDailyFocusMap();
        renderScheduleView();
      }
    }

    function finalizeActiveSession(autoFinished, markComplete = true) {
      if (!activeStudy) return;
      const session = activeStudy;
      const rawElapsed = computeElapsedMs(session);
      const elapsed =
        typeof session.targetMs === "number"
          ? Math.min(rawElapsed, session.targetMs)
          : rawElapsed;

      if (
        session.kind === "study" &&
        session.subjectId &&
        session.fileId
      ) {
        const minMs = 3 * 60 * 1000;
        if (elapsed < minMs) {
          activeStudy = null;
          clearActiveSession();
          renderFocusState();
          renderTable();
          renderTodayTodos();
          renderScheduleView();
          updateStudyTimerDisplay();
          showNotice("Session shorter than 3 minutes was not counted.", "warn");
          return;
        }
        const subj = subjects.find((s) => s.id === session.subjectId);
        if (subj) {
          const file = subj.files.find((f) => f.id === session.fileId);
          if (file) {
            file.totalMs = (file.totalMs || 0) + elapsed;
            file.sessions = (file.sessions || 0) + 1;
            file.lastSessionMs = elapsed;
            file.lastReviewed = new Date().toISOString();
            addDailyStudyForFile(file, elapsed);
            addDailySessionForFile(file);
            if (markComplete) {
              markTodoDoneByFile(session.subjectId, session.fileId);
            }
          }
        }
      }

      activeStudy = null;
      clearActiveSession();
      saveToStorage();
      renderFocusState();
      renderTable();
      renderTodayTodos();
      renderScheduleView();
      updateStudyTimerDisplay();
      if (autoFinished) {
        showNotice("Session finished.", "success");
      }
    }

    function startStudy(subjectId, file) {
      // Resume if same file paused
      if (
        activeStudy &&
        activeStudy.kind === "study" &&
        activeStudy.subjectId === subjectId &&
        activeStudy.fileId === file.id
      ) {
        if (activeStudy.paused) {
          resumeActiveSession({ clearNavFlags: true });
          renderFocusState();
          updateStudyTimerDisplay();
        }
        return;
      }

      if (activeStudy) {
        // directly stop current session and start new study (no confirm)
        finalizeActiveSession(false);
      }

      const minutes = pomoConfig.study || 25;
      const targetMs = minutes * 60 * 1000;

      activeStudy = {
        kind: "study",
        subjectId,
        fileId: file.id,
        startTimeMs: Date.now(),
        baseMs: 0,
        targetMs,
        paused: false,
        timerMode: timerModePref || "countdown",
        pausedReason: null,
        autoResume: false,
        pausedAtMs: null
      };
      saveActiveSession();

      renderFocusState();
      renderTable();
      renderTodayTodos();
      renderScheduleView();
      updateStudyTimerDisplay();
    }

    function pauseStudy(subjectId, fileId) {
      if (
        !activeStudy ||
        activeStudy.kind !== "study" ||
        activeStudy.subjectId !== subjectId ||
        activeStudy.fileId !== fileId ||
        activeStudy.paused
      ) {
        return;
      }
      pauseActiveSession("manual", { autoResume: false });
      renderFocusState();
      renderTable();
      renderTodayTodos();
      updateStudyTimerDisplay();
    }

    function stopStudy(subjectId, fileId) {
      if (
        !activeStudy ||
        activeStudy.kind !== "study" ||
        activeStudy.subjectId !== subjectId ||
        activeStudy.fileId !== fileId
      ) {
        return;
      }
      finalizeActiveSession(false, false);
    }

    function startBreak(kind) {
      // No confirmation: just stop current session and start break
      if (activeStudy) {
        finalizeActiveSession(false, false);
      }

      const minutes =
        kind === "short" ? pomoConfig.short : pomoConfig.long;
      const targetMs = minutes * 60 * 1000;

      activeStudy = {
        kind: "break",
        breakKind: kind,
        subjectId: null,
        fileId: null,
        startTimeMs: Date.now(),
        baseMs: 0,
        targetMs,
        paused: false,
        pausedReason: null,
        autoResume: false,
        pausedAtMs: null
      };
      saveActiveSession();

      renderFocusState();
      renderTable();
      renderTodayTodos();
      renderScheduleView();
      updateStudyTimerDisplay();
    }

    function updateStudyTimerDisplay() {
      const currentKey =
        activeStudy && activeStudy.kind === "study"
          ? activeStudy.subjectId + "|" + activeStudy.fileId
          : null;
      const currentPaused =
        activeStudy && activeStudy.kind === "study" ? !!activeStudy.paused : null;
      if (currentKey !== lastActiveStudyKey || currentPaused !== lastActiveStudyPaused) {
        lastActiveStudyKey = currentKey;
        lastActiveStudyPaused = currentPaused;
        renderTable();
        renderTodayTodos();
        renderScheduleView();
      }

      if (!focusTimerDisplay) return;

      if (!activeStudy) {
        focusTimerDisplay.textContent = "00:00:00";
        document
          .querySelectorAll(".today-timer")
          .forEach((el) => (el.textContent = ""));
        return;
      }

      const elapsed = computeElapsedMs(activeStudy);
      const targetMs =
        typeof activeStudy.targetMs === "number"
          ? activeStudy.targetMs
          : 0;

      const useCountdown = activeStudy.timerMode !== "stopwatch";

      if (useCountdown) {
        let remaining = targetMs - elapsed;
        if (remaining <= 0) {
          focusTimerDisplay.textContent = "00:00:00";
          finalizeActiveSession(true, true);
          return;
        }
        const text = formatHMS(remaining);
        focusTimerDisplay.textContent = text;
        if (activeStudy.kind === "study" && activeStudy.fileId) {
          const span = document.getElementById("timer-" + activeStudy.fileId);
          if (span) span.textContent = text;
          const spanToday = document.getElementById("today-timer-" + activeStudy.fileId);
          if (spanToday) spanToday.textContent = text;
        }
      } else {
        const text = formatHMS(elapsed);
        focusTimerDisplay.textContent = text;
        if (activeStudy.kind === "study" && activeStudy.fileId) {
          const span = document.getElementById("timer-" + activeStudy.fileId);
          if (span) span.textContent = text;
          const spanToday = document.getElementById("today-timer-" + activeStudy.fileId);
          if (spanToday) spanToday.textContent = text;
        }
      }
    }

    setInterval(function () {
      if (activeStudy && !activeStudy.paused && activeStudy.startTimeMs) {
        const now = Date.now();
        const lastSaved = Number(activeStudy.savedAtMs) || 0;
        if (now - lastSaved >= 5000) {
          const delta = now - Number(activeStudy.startTimeMs || 0);
          if (Number.isFinite(delta) && delta > 0) {
            activeStudy.baseMs = (Number(activeStudy.baseMs) || 0) + delta;
          }
          activeStudy.startTimeMs = now;
          saveActiveSession();
        }
      }
      updateStudyTimerDisplay();
      updateTodayStudyUI();
      updateGoalsAndStreaks();
    }, 1000);

    function renderFocusState() {
      focusCard.classList.remove(
        "focus-study-active",
        "focus-study-paused",
        "focus-break-active"
      );

      if (!activeStudy) {
        focusSessionTitle.textContent = "No active session";
        focusSessionSubtitle.textContent =
          "Click “Study” on a file or start a break below.";
        focusSessionControls.innerHTML =
          '<span style="font-size:0.75rem;color:#9ca3af;">No controls – start a session.</span>';
        focusTimerDisplay.textContent = "00:00:00";
        updateTimerModeButtons(timerModePref);
        return;
      }

      if (activeStudy.kind === "study") {
        const subj = subjects.find((s) => s.id === activeStudy.subjectId);
        const file =
          subj && subj.files.find((f) => f.id === activeStudy.fileId);
        focusSessionTitle.textContent = file ? file.name : "Study session";
        const subjName = subj ? subj.name : "Unknown subject";
        focusSessionSubtitle.textContent = subjName + " · Study session";

        if (activeStudy.paused) {
          focusCard.classList.add("focus-study-paused");
        } else {
          focusCard.classList.add("focus-study-active");
        }
        updateTimerModeButtons(activeStudy.timerMode || timerModePref);
      } else {
        const label =
          activeStudy.breakKind === "short"
            ? "Short break"
            : activeStudy.breakKind === "long"
            ? "Long break"
            : "Break";
        focusSessionTitle.textContent = label;
        focusSessionSubtitle.textContent = "Break";
        focusCard.classList.add("focus-break-active");
        updateTimerModeButtons(timerModePref);
      }

      focusSessionControls.innerHTML = "";
      const isPaused = !!activeStudy.paused;

      const pauseBtn = document.createElement("button");
      pauseBtn.className = "focus-main-btn focus-main-btn-primary";
      pauseBtn.textContent = isPaused ? "Resume" : "Pause";
      pauseBtn.addEventListener("click", () => {
        if (!activeStudy) return;
        if (activeStudy.paused) {
          resumeActiveSession({ clearNavFlags: true });
          renderFocusState();
          updateStudyTimerDisplay();
        } else {
          pauseActiveSession("manual", { autoResume: false });
          renderFocusState();
          renderTable();
          updateStudyTimerDisplay();
        }
      });

      const stopBtn = document.createElement("button");
      stopBtn.className = "focus-main-btn focus-main-btn-danger";
      stopBtn.textContent = "Stop";
      stopBtn.addEventListener("click", () => {
        finalizeActiveSession(false, false);
      });

      focusSessionControls.appendChild(pauseBtn);
      focusSessionControls.appendChild(stopBtn);
    }

    function createAddSubjectColumn() {
      const col = document.createElement("div");
      col.className = "subject-column subject-add-column";

      const box = document.createElement("div");
      box.className = "subject-add-box";

      const inline = document.createElement("div");
      inline.className = "subject-add-inline";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn subject-add-btn";
      btn.textContent = "+";

      btn.addEventListener("click", () => {
        openNoticePrompt("Add subject", "", (value) => {
          const trimmed = (value || "").trim();
          if (!trimmed) return;
          subjects.push({
            id: createId(),
            name: trimmed,
            files: [],
            sortMode: "manual",
            manualOrder: []
          });
          saveToStorage();
          renderSubjectOptions();
          renderTable();
          renderFocusState();
          renderScheduleView();
        });
      });

      inline.appendChild(btn);
      box.appendChild(inline);
      col.appendChild(box);

      return col;
    }

    function updateManualOrder(subj) {
      subj.manualOrder = Array.isArray(subj.files)
        ? subj.files.map((f) => f.id)
        : [];
    }

    function applySortToSubject(subj) {
      if (!Array.isArray(subj.manualOrder)) {
        subj.manualOrder = subj.files.map((f) => f.id);
      }

      const mode = subj.sortMode || "manual";
      if (!Array.isArray(subj.files)) return;
      if (mode === "manual") {
        const idSet = new Set(subj.files.map((f) => f.id));
        const ordered = [];
        subj.manualOrder.forEach((id) => {
          if (idSet.has(id)) {
            const f = subj.files.find((x) => x.id === id);
            if (f) ordered.push(f);
          }
        });
        subj.files.forEach((f) => {
          if (!subj.manualOrder.includes(f.id)) {
            ordered.push(f);
            subj.manualOrder.push(f.id);
          }
        });
        subj.files = ordered;
        return;
      }

      // Preserve current manual ordering before applying other sorts
      subj.manualOrder = subj.files.map((f) => f.id);

      if (mode === "confidence") {
        subj.files.sort((a, b) => {
          const ac = Number(a.confidence) || 0;
          const bc = Number(b.confidence) || 0;
          if (ac === bc) return (a.name || "").localeCompare(b.name || "");
          // low confidence first
          return ac - bc;
        });
      } else if (mode === "staleness") {
        // Longest time not studied: never reviewed first, then oldest lastReviewed
        function stalenessValue(file) {
          if (!file.lastReviewed) return 0; // "never" group
          const t = new Date(file.lastReviewed).getTime();
          if (Number.isNaN(t)) return 0;
          return t;
        }
        subj.files.sort((a, b) => {
          const av = stalenessValue(a);
          const bv = stalenessValue(b);
          const aNever = !a.lastReviewed;
          const bNever = !b.lastReviewed;
          if (aNever && !bNever) return -1;
          if (!aNever && bNever) return 1;
          if (av === bv) return (a.name || "").localeCompare(b.name || "");
          // older date (smaller timestamp) is more stale
          return av - bv;
        });
      } else if (mode === "total") {
        // Total amount spent in total studying: most studied first
        subj.files.sort((a, b) => {
          const at = Number(a.totalMs) || 0;
          const bt = Number(b.totalMs) || 0;
          if (at === bt) return (a.name || "").localeCompare(b.name || "");
          return bt - at;
        });
      }
    }

    function renderTable() {
      subjectTable.innerHTML = "";

      if (!subjects.length) {
        emptyHint.textContent =
          "No subjects yet. Use “Add subject” on the right to create your first subject.";
        emptyHint.style.display = "block";
      } else {
        emptyHint.style.display = "none";
      }

      subjects.forEach((subj, subjIndex) => {
        if (!subj.sortMode) subj.sortMode = "manual";
        applySortToSubject(subj);

        const col = document.createElement("div");
        col.className = "subject-column";
        const subjColor = isHexColor(subj.color) ? subj.color : getSubjectColor(subjIndex);
        col.style.borderTop = "3px solid " + subjColor;

        const header = document.createElement("div");
        header.className = "subject-header";
        header.addEventListener("click", (event) => {
          if (event.target && event.target.closest && event.target.closest(".subject-delete-btn")) return;
          openSubjectSettingsModal(subj.id);
        });

        const headerLeft = document.createElement("div");
        headerLeft.style.display = "flex";
        headerLeft.style.alignItems = "center";
        headerLeft.style.gap = "6px";

        const colorDot = document.createElement("span");
        colorDot.className = "subject-color-dot";
        colorDot.style.backgroundColor = subjColor;
        colorDot.title = "Subject settings";
        colorDot.setAttribute("role", "button");
        colorDot.setAttribute("tabindex", "0");
        colorDot.addEventListener("click", (event) => {
          event.stopPropagation();
          openSubjectSettingsModal(subj.id);
        });
        colorDot.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          openSubjectSettingsModal(subj.id);
        });

        const titleSpan = document.createElement("span");
        titleSpan.textContent = subj.name;

        headerLeft.appendChild(colorDot);
        headerLeft.appendChild(titleSpan);

        const countSpan = document.createElement("small");
        const totalFiles = subj.files.length;
        let avg = 0;
        if (totalFiles) {
          const sum = subj.files.reduce(
            (acc, f) => acc + (Number(f.confidence) || 0),
            0
          );
          avg = Math.round(sum / totalFiles);
          countSpan.textContent =
            totalFiles + " file" + (totalFiles === 1 ? "" : "s") + " · " + avg + "%";
        } else {
          countSpan.textContent = "no files";
        }

        const deleteSubjectBtn = document.createElement("button");
        deleteSubjectBtn.className = "subject-delete-btn";
        deleteSubjectBtn.title = "Delete subject";
        deleteSubjectBtn.textContent = "✕";
        deleteSubjectBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          if (
            !confirm(
              `Delete subject "${subj.name}" and all its files? This cannot be undone.`
            )
          ) {
            return;
          }
          if (
            activeStudy &&
            activeStudy.kind === "study" &&
            activeStudy.subjectId === subj.id
          ) {
            activeStudy = null;
            clearActiveSession();
          }
          subjects = subjects.filter((s) => s.id !== subj.id);
          cleanupTodosForSubject(subj.id);
          saveToStorage();
          renderSubjectOptions();
          renderFocusState();
          renderTable();
        });

        const headerRight = document.createElement("div");
        headerRight.style.display = "flex";
        headerRight.style.alignItems = "center";
        headerRight.style.gap = "6px";
        headerRight.appendChild(countSpan);
        headerRight.appendChild(deleteSubjectBtn);

        header.appendChild(headerLeft);
        header.appendChild(headerRight);

        const meter = document.createElement("div");
        meter.className = "subject-meter";
        const meterFill = document.createElement("div");
        meterFill.className = "subject-meter-fill";
        if (totalFiles) {
          meterFill.style.width = avg + "%";
          meterFill.classList.add(meterClass(avg));
          meterFill.style.background = meterGradient(avg);
        } else {
          meterFill.style.width = "0%";
          meterFill.classList.add("meter-low");
          meterFill.style.background = meterGradient(0);
        }
        meter.appendChild(meterFill);

        // Sort controls
        const sortWrapper = document.createElement("div");
        sortWrapper.className = "subject-sort";
        const sortSelect = document.createElement("select");
        sortSelect.className = "subject-sort-select";

        const sortOptions = [
          { value: "manual", label: "Order: manual" },
          { value: "confidence", label: "Confidence (low → high)" },
          { value: "staleness", label: "Longest not studied" },
          { value: "total", label: "Most studied" }
        ];

        sortOptions.forEach((opt) => {
          const optionEl = document.createElement("option");
          optionEl.value = opt.value;
          optionEl.textContent = opt.label;
          sortSelect.appendChild(optionEl);
        });

        sortSelect.value = subj.sortMode || "manual";
        sortSelect.addEventListener("change", () => {
          subj.sortMode = sortSelect.value;
          applySortToSubject(subj);
          saveToStorage();
          renderTable();
        });

        sortWrapper.appendChild(sortSelect);

        const fileList = document.createElement("div");
        fileList.className = "file-list";

        const filter = currentSearch;

        const sourceFiles = subj.files;
        const visibleFiles = filter
          ? sourceFiles.filter((f) =>
              (f.name || "")
                .toLowerCase()
                .includes(filter.toLowerCase())
            )
          : sourceFiles;

        // Allow dropping at end of list (reorder only within same subject)
        fileList.addEventListener("dragover", (event) => {
          if (!dragState) return;
          event.preventDefault();
        });

        fileList.addEventListener("drop", (event) => {
          event.preventDefault();
          if (!dragState) return;

          const sourceSubject = subjects.find(
            (s) => s.id === dragState.subjectId
          );
          if (!sourceSubject) return;

          const sourceIndex = sourceSubject.files.findIndex(
            (f) => f.id === dragState.fileId
          );
          if (sourceIndex === -1) return;

          const [movedFile] = sourceSubject.files.splice(sourceIndex, 1);
          if (sourceSubject.id === subj.id) {
            subj.files.push(movedFile);
            subj.sortMode = "manual"; // manual override after drag
            updateManualOrder(subj);
          } else {
            // Move across subjects
            subj.files.push(movedFile);
            sourceSubject.sortMode = "manual";
            subj.sortMode = "manual";
            updateManualOrder(sourceSubject);
            updateManualOrder(subj);
            syncTodoForFile(sourceSubject.id, subj.id, movedFile.id, movedFile.name, subj.name);
            if (
              activeStudy &&
              activeStudy.kind === "study" &&
              activeStudy.subjectId === sourceSubject.id &&
              activeStudy.fileId === movedFile.id
            ) {
              activeStudy.subjectId = subj.id;
              saveActiveSession();
            }
          }
          saveToStorage();
          renderTable();
        });

        if (!visibleFiles.length) {
          const hint = document.createElement("div");
          hint.className = "empty-hint";
          hint.textContent = subj.files.length
            ? "No files match filter in this subject."
            : "Add a file to this subject.";
          fileList.appendChild(hint);
        } else {
          for (const file of visibleFiles) {
            const row = document.createElement("div");
            row.className = "file-row";
            row.setAttribute("draggable", "true");

            const inToday = todayTodos.some(
              (t) => t.subjectId === subj.id && t.fileId === file.id
            );
            if ((subjectsMaximized || isPhoneTodayPicker()) && inToday) {
              row.classList.add("in-today");
            }

            if (isActiveStudy(subj.id, file.id)) {
              row.classList.add("studying");
            }

            // Drag handlers
            row.addEventListener("dragstart", (event) => {
              dragState = { subjectId: subj.id, fileId: file.id };
              row.classList.add("dragging");
              if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "copyMove";
                // setData required for some browsers to allow drop
                event.dataTransfer.setData("text/plain", file.id);
              }
            });

            row.addEventListener("dragend", () => {
              row.classList.remove("dragging");
              dragState = null;
            });

            row.addEventListener("dragenter", (event) => {
              if (!dragState) return;
              event.preventDefault();
              row.classList.add("drag-over");
            });

            row.addEventListener("dragover", (event) => {
              if (!dragState) return;
              event.preventDefault();
            });

            row.addEventListener("dragleave", () => {
              row.classList.remove("drag-over");
            });

            row.addEventListener("drop", (event) => {
              event.preventDefault();
              row.classList.remove("drag-over");
              if (!dragState) return;

              const sourceSubject = subjects.find(
                (s) => s.id === dragState.subjectId
              );
              if (!sourceSubject) return;

              const sourceIndex = sourceSubject.files.findIndex(
                (f) => f.id === dragState.fileId
              );
              if (sourceIndex === -1) return;

              const targetIndex = subj.files.findIndex(
                (f) => f.id === file.id
              );
              if (targetIndex === -1) return;

              const [movedFile] = sourceSubject.files.splice(sourceIndex, 1);
              if (sourceSubject.id === subj.id) {
                let insertIndex = targetIndex;
                if (sourceIndex < targetIndex) {
                  insertIndex = targetIndex - 1;
                }
                subj.files.splice(insertIndex, 0, movedFile);
                subj.sortMode = "manual"; // manual override after drag
                updateManualOrder(subj);
              } else {
                subj.files.splice(targetIndex, 0, movedFile);
                sourceSubject.sortMode = "manual";
                subj.sortMode = "manual";
                updateManualOrder(sourceSubject);
                updateManualOrder(subj);
                syncTodoForFile(sourceSubject.id, subj.id, movedFile.id, movedFile.name, subj.name);
                if (
                  activeStudy &&
                  activeStudy.kind === "study" &&
                  activeStudy.subjectId === sourceSubject.id &&
                  activeStudy.fileId === movedFile.id
                ) {
                  activeStudy.subjectId = subj.id;
                  saveActiveSession();
                }
              }

              dragState = null;
              saveToStorage();
              renderTable();
            });

            const nameDiv = document.createElement("div");
            nameDiv.className = "file-name";
            nameDiv.textContent = file.name;
            row.appendChild(nameDiv);

            if (file.notes) {
              const notesDiv = document.createElement("div");
              notesDiv.className = "file-notes";
              notesDiv.textContent = file.notes;
              row.appendChild(notesDiv);
            }

            const timeDiv = document.createElement("div");
            timeDiv.className = "file-time";
            timeDiv.textContent = file.lastReviewed
              ? "Revised " + formatTimeAgo(file.lastReviewed)
              : "Never revised";
            row.appendChild(timeDiv);

            const metaDiv = document.createElement("div");
            metaDiv.className = "file-meta";

            const leftMeta = document.createElement("div");
            leftMeta.style.display = "flex";
            leftMeta.style.alignItems = "center";
            leftMeta.style.gap = "4px";

            const badge = document.createElement("span");
            const confValue = displayConfidence(file);
            badge.className =
              "confidence-badge " + confidenceClass(confValue);
            badge.textContent = confValue + "%";

            // Click badge to change confidence
            badge.addEventListener("click", (event) => {
              event.stopPropagation();
              openFileModalEdit(subj.id, file);
            });

            leftMeta.appendChild(badge);

            const rightMeta = document.createElement("div");
            rightMeta.className = "file-actions";

            const isThisActive = isActiveStudy(subj.id, file.id);
            const isPaused =
              isThisActive && activeStudy && activeStudy.paused;

            if (!subjectsMaximized && !isPhoneTodayPicker()) {
              if (!isThisActive) {
                const studyBtn = document.createElement("button");
                studyBtn.className = "chip-btn chip-btn-primary";
                studyBtn.textContent = "Study";
                studyBtn.addEventListener("click", (event) => {
                  event.stopPropagation();
                  startStudy(subj.id, file);
                });
                rightMeta.appendChild(studyBtn);
              } else {
                const primaryBtn = document.createElement("button");
                primaryBtn.className = "chip-btn chip-btn-primary";
                primaryBtn.textContent = isPaused ? "Resume" : "Pause";
                primaryBtn.addEventListener("click", (event) => {
                  event.stopPropagation();
                  if (activeStudy.paused) {
                    activeStudy.startTimeMs = Date.now();
                    activeStudy.paused = false;
                    renderFocusState();
                    renderTable();
                    renderTodayTodos();
                    renderScheduleView();
                    updateStudyTimerDisplay();
                  } else {
                    pauseStudy(subj.id, file.id);
                  }
                });

                const stopBtn = document.createElement("button");
                stopBtn.className = "chip-btn chip-btn-danger";
                stopBtn.textContent = "Stop";
                stopBtn.addEventListener("click", (event) => {
                  event.stopPropagation();
                  stopStudy(subj.id, file.id);
                });

                rightMeta.appendChild(primaryBtn);
                rightMeta.appendChild(stopBtn);
              }
            }

            // Add-to-today controls:
            // - desktop: only show in Subjects maximized mode (existing behavior)
            // - phone Today picker: show a simple "Add" action on every file (no Study button)
            const picker = isPhoneTodayPicker();
            if (subjectsMaximized || picker) {
              const addTodayBtn = document.createElement("button");
              addTodayBtn.className = picker ? "chip-btn chip-btn-primary" : "chip-btn chip-btn-ghost";
              addTodayBtn.textContent = inToday ? (picker ? "Added" : "In Today") : picker ? "Add" : "To Today";
              addTodayBtn.title = inToday
                ? "Already in Today’s Focus"
                : "Add this file to Today’s Focus";

              if (inToday) {
                if (picker) {
                  addTodayBtn.disabled = true;
                  addTodayBtn.classList.add("chip-btn-success");
                  const removeBtn = document.createElement("button");
                  removeBtn.className = "chip-btn chip-btn-danger";
                  removeBtn.textContent = "Remove";
                  removeBtn.title = "Remove from Today’s Focus";
                  removeBtn.addEventListener("click", (event) => {
                    event.stopPropagation();
                    cleanupTodoForFile(subj.id, file.id);
                    renderTable();
                  });
                  rightMeta.appendChild(addTodayBtn);
                  rightMeta.appendChild(removeBtn);
                } else {
                  addTodayBtn.disabled = true;
                  addTodayBtn.classList.add("chip-btn-success");
                  const removeBtn = document.createElement("button");
                  removeBtn.className = "chip-btn chip-btn-danger";
                  removeBtn.textContent = "Remove";
                  removeBtn.title = "Remove from Today’s Focus";
                  removeBtn.addEventListener("click", (event) => {
                    event.stopPropagation();
                    showNotice("Remove this file from Today's focus?", "warn", () => {
                      cleanupTodoForFile(subj.id, file.id);
                      renderTodayTodos();
                      renderScheduleView();
                      renderTable();
                    });
                  });
                  rightMeta.appendChild(addTodayBtn);
                  rightMeta.appendChild(removeBtn);
                }
              } else if (picker) {
                addTodayBtn.addEventListener("click", (event) => {
                  event.stopPropagation();
                  const added = addTodoForFile(subj.id, file.id);
                  if (added) {
                    showToast("Added to Today.", "success");
                    renderTable();
                  }
                });
                rightMeta.appendChild(addTodayBtn);
              } else {
                addTodayBtn.addEventListener("click", (event) => {
                  event.stopPropagation();
                  openAddTodoModal(subj.id, file);
                });
                rightMeta.appendChild(addTodayBtn);
              }
            }

            metaDiv.appendChild(leftMeta);
            metaDiv.appendChild(rightMeta);

            row.appendChild(metaDiv);

            // Click row to edit in modal
            row.addEventListener("click", () => {
              openFileModalEdit(subj.id, file);
            });

            fileList.appendChild(row);
          }
        }

        // Add file slot at the bottom of each column
        const addSlot = document.createElement("button");
        addSlot.type = "button";
        addSlot.className = "add-file-slot";
        addSlot.textContent = "+ Add file";
        addSlot.addEventListener("click", () => {
          openFileModalAdd(subj.id);
        });
        fileList.appendChild(addSlot);

        col.appendChild(header);
        col.appendChild(meter);
        col.appendChild(sortWrapper);
        col.appendChild(fileList);
        subjectTable.appendChild(col);
      });

      // Add subject column at the right
      subjectTable.appendChild(createAddSubjectColumn());

      applyDesktopSubjectSizing();
      ensureSubjectScrollButtons();

      updateSummary();
      renderDueSoonLane();
      renderSmartSuggestions();
      updateStudyTimerDisplay();
    }
