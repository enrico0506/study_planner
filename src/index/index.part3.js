		    let todayCollapsedMap = {};
		    let todayCollapsedMapLoaded = false;
		    const TODAY_COLLAPSED_KEY = "studyTodayCollapsed_v1";

		    const subtasksModalBackdrop = document.getElementById("subtasksModalBackdrop");
		    const subtasksModalTitle = document.getElementById("subtasksModalTitle");
		    const subtasksModalSubtitle = document.getElementById("subtasksModalSubtitle");
		    const subtasksModalBody = document.getElementById("subtasksModalBody");
		    const subtasksModalCloseBtn = document.getElementById("subtasksModalCloseBtn");
		    const subtasksModalCloseBtn2 = document.getElementById("subtasksModalCloseBtn2");
		    let subtasksModalTodoId = null;

		    function renderSubtasksModal(todoId) {
		      if (!subtasksModalBody) return;
		      const todo = todayTodos.find((t) => t && t.id === todoId);
		      if (!todo) {
		        subtasksModalBody.innerHTML = "";
		        const hint = document.createElement("div");
		        hint.className = "today-subtasks-empty";
		        hint.textContent = "Task not found.";
		        subtasksModalBody.appendChild(hint);
		        return;
		      }

		      const isFileTodo =
		        (todo.kind || "file") !== "custom" && !!todo.subjectId && !!todo.fileId;
		      const { subj, file } = isFileTodo
		        ? resolveFileRef(todo.subjectId, todo.fileId)
		        : { subj: null, file: null };
		      if (subtasksModalTitle) {
		        subtasksModalTitle.textContent = (file && file.name) || todo.label || "Subtasks";
		      }
		      if (subtasksModalSubtitle) {
		        const subs = Array.isArray(todo.subtasks) ? todo.subtasks : [];
		        subtasksModalSubtitle.textContent = `${
		          isFileTodo ? (subj && subj.name) || "Subject" : "Custom"
		        } • ${subs.length} subtask${subs.length === 1 ? "" : "s"}`;
		      }

		      subtasksModalBody.innerHTML = "";

		      const wrap = document.createElement("div");
		      wrap.className = "today-subtasks";

		      const list = document.createElement("div");
		      list.className = "today-subtasks-list";

		      const subs = Array.isArray(todo.subtasks) ? todo.subtasks : [];
		      if (!subs.length) {
		        const hint = document.createElement("div");
		        hint.className = "today-subtasks-empty";
		        hint.textContent = "No subtasks yet.";
		        list.appendChild(hint);
		      } else {
		        subs.forEach((sub) => {
		          const row = document.createElement("div");
		          row.className = "today-subtask-row";
		          if (sub && sub.done) row.classList.add("today-subtask-done");

		          const cb = document.createElement("input");
		          cb.type = "checkbox";
		          cb.checked = !!(sub && sub.done);
		          cb.addEventListener("click", (e) => e.stopPropagation());
		          cb.addEventListener("change", () => {
		            toggleSubtask(todoId, sub.id, cb.checked, { promptConfidence: true });
		            requestAnimationFrame(() => renderSubtasksModal(todoId));
		          });

		          const label = document.createElement("div");
		          label.className = "today-subtask-label";
		          label.textContent = (sub && sub.label) || "Untitled subtask";

		          const rm = document.createElement("button");
		          rm.type = "button";
		          rm.className = "today-subtask-remove";
		          rm.textContent = "✕";
		          rm.title = "Remove subtask";
		          rm.addEventListener("click", () => {
		            removeSubtask(todoId, sub.id);
		            requestAnimationFrame(() => renderSubtasksModal(todoId));
		          });

		          row.appendChild(cb);
		          row.appendChild(label);
		          row.appendChild(rm);
		          list.appendChild(row);
		        });
		      }

		      const addRow = document.createElement("div");
		      addRow.className = "today-subtask-add";
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
		        addSubtask(todoId, text);
		        addInput.value = "";
		        requestAnimationFrame(() => renderSubtasksModal(todoId));
		      }

		      addBtn.addEventListener("click", commitSubtask);
		      addInput.addEventListener("keydown", (event) => {
		        if (event.key === "Enter") {
		          event.preventDefault();
		          commitSubtask();
		        }
		      });

		      addRow.appendChild(addInput);
		      addRow.appendChild(addBtn);

		      wrap.appendChild(list);
		      wrap.appendChild(addRow);
		      subtasksModalBody.appendChild(wrap);
		    }

		    function closeSubtasksModal() {
		      if (!subtasksModalBackdrop) return;
		      subtasksModalBackdrop.hidden = true;
		      subtasksModalBackdrop.style.display = "none";
		      subtasksModalTodoId = null;
		    }

		    function openSubtasksModal(todo, file, subj) {
		      if (!subtasksModalBackdrop || !subtasksModalBody) return;
		      subtasksModalTodoId = todo && todo.id ? todo.id : null;
		      renderSubtasksModal(subtasksModalTodoId);

		      subtasksModalBackdrop.hidden = false;
		      subtasksModalBackdrop.style.display = "flex";
		      if (subtasksModalCloseBtn && typeof subtasksModalCloseBtn.focus === "function") {
		        subtasksModalCloseBtn.focus();
		      }
		    }

		    if (subtasksModalCloseBtn) subtasksModalCloseBtn.addEventListener("click", closeSubtasksModal);
		    if (subtasksModalCloseBtn2) subtasksModalCloseBtn2.addEventListener("click", closeSubtasksModal);
		    if (subtasksModalBackdrop) {
		      subtasksModalBackdrop.addEventListener("click", (event) => {
		        if (event.target === subtasksModalBackdrop) closeSubtasksModal();
		      });
		      subtasksModalBackdrop.addEventListener("keydown", (event) => {
		        if (event.key === "Escape") {
		          event.preventDefault();
		          closeSubtasksModal();
		        }
		      });
		    }

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
        const ctaRow = document.createElement("div");
        ctaRow.style.marginTop = "10px";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn";
        btn.textContent = "Add from subjects";
        btn.addEventListener("click", () => {
          window.location.href = "index.html?mode=subjects";
        });
        ctaRow.appendChild(btn);
        empty.appendChild(ctaRow);
        todayList.appendChild(empty);
        return;
      }

	      const isSlimMode = !todayExpanded && !subjectsMaximized;
	      const useCompactTodayActions =
	        typeof isIpadLandscapeLayout === "function" && isIpadLandscapeLayout();
	      const activeSlimTodo =
	        isSlimMode && activeStudy && activeStudy.kind === "study"
	          ? todayTodos.find(
	              (t) =>
	                t &&
	                t.subjectId === activeStudy.subjectId &&
	                t.fileId === activeStudy.fileId
	            )
	          : null;
	      const slimExpandedTodoId = activeSlimTodo && activeSlimTodo.id ? activeSlimTodo.id : null;
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
	        const isCustom = (todo.kind || "file") === "custom";
	        const isFileTodo = !isCustom && !!todo.subjectId && !!todo.fileId;
	        const { subj, file } = isFileTodo
	          ? resolveFileRef(todo.subjectId, todo.fileId)
	          : { subj: null, file: null };
	        const subjColor = getSubjectColorById(todo.subjectId);
	        const tintAlpha = getSubjectTintAlphaById(todo.subjectId);
	        const item = document.createElement("div");
	        item.className = "today-item";
	        item.dataset.todoId = todo.id;
	        if (isSlimMode) {
	          item.classList.add("today-item-slim", "today-item-clickable");
	          if (slimExpandedTodoId && todo.id === slimExpandedTodoId) {
	            item.classList.add("today-item-slim-expanded");
	          }
	          item.tabIndex = 0;
	        }
	        const tinted = hexToRgba(subjColor, tintAlpha);
	        const borderTint = hexToRgba(subjColor, Math.max(0.2, Math.min(0.7, tintAlpha * 2.25)));
	        item.style.setProperty("--todo-accent", subjColor);
	        if (tinted) item.style.backgroundColor = tinted;
	        if (borderTint) item.style.borderColor = borderTint;
	        if (todo.done) item.classList.add("today-item-done");
	        if (isFileTodo && (!file || !subj)) item.classList.add("today-item-missing");
	        const isCollapsed = !!(todayCollapsedMap && todayCollapsedMap[todo.id]);
	        if (isCollapsed) item.classList.add("today-item-collapsed");
        if (isDragMode) {
          item.setAttribute("draggable", "true");
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
	        checkbox.addEventListener("click", (e) => e.stopPropagation());
	        checkbox.addEventListener("change", () => {
	          toggleTodoDone(todo.id, checkbox.checked, { promptConfidence: true });
	        });

        const colorDot = document.createElement("span");
        colorDot.className = "today-color-dot";
        colorDot.style.backgroundColor = subjColor;

        const textWrap = document.createElement("div");
        textWrap.className = "today-text";

        if (todo.handoffNote) {
          const noteBox = document.createElement("div");
          noteBox.className = "today-note-box";
          const noteTitle = document.createElement("div");
          noteTitle.className = "today-note-title";
          noteTitle.textContent = "Note from last time";
          const noteBody = document.createElement("div");
          noteBody.className = "today-note-body";
          const parts = String(todo.handoffNote || "")
            .split(/\r?\n+/)
            .map((s) => s.trim())
            .filter(Boolean);
          if (parts.length > 1) {
            const list = document.createElement("ul");
            list.className = "today-note-list";
            parts.forEach((line) => {
              const li = document.createElement("li");
              li.textContent = line;
              list.appendChild(li);
            });
            noteBody.appendChild(list);
          } else {
            noteBody.textContent = todo.handoffNote;
          }
          const noteDismiss = document.createElement("button");
          noteDismiss.type = "button";
          noteDismiss.className = "today-note-dismiss";
          noteDismiss.textContent = "Dismiss";
          noteDismiss.addEventListener("click", () => {
            todo.handoffNote = "";
            saveTodayTodos();
            renderTodayTodos();
          });
          noteBox.appendChild(noteTitle);
          noteBox.appendChild(noteBody);
          noteBox.appendChild(noteDismiss);
          item.appendChild(noteBox);
        }

	        const isThisActive = isActiveStudy(todo.subjectId, todo.fileId);
	        const isPaused = isThisActive && activeStudy && activeStudy.paused;
	        const isSlimExpanded = isSlimMode && !!slimExpandedTodoId && todo.id === slimExpandedTodoId;

	        const title = document.createElement("div");
	        title.className = "today-title";
	        title.textContent = (file && file.name) || todo.label || "Untitled";

	        const subs = Array.isArray(todo.subtasks) ? todo.subtasks : [];
	        const collapsedHint = document.createElement("span");
	        collapsedHint.className = "today-collapsed-hint";
	        collapsedHint.textContent = `(${subs.length} subtask${subs.length === 1 ? "" : "s"})`;
	        title.appendChild(collapsedHint);

	        textWrap.appendChild(title);

	        if (useCompactTodayActions && isFileTodo && file && !todo.done && !isThisActive) {
	          const studyInline = document.createElement("button");
	          studyInline.type = "button";
	          studyInline.className = "chip-btn chip-btn-primary today-study-inline";
	          studyInline.textContent = "Study";
	          studyInline.addEventListener("click", (e) => {
	            e.stopPropagation();
	            if (subj && file) {
	              moveTodoToTop(todo.id, { render: false });
	              startStudy(todo.subjectId, file);
	            }
	          });
	          textWrap.appendChild(studyInline);
	        }

	        if (!isSlimMode) left.appendChild(checkbox);
	        left.appendChild(colorDot);
	        left.appendChild(textWrap);

	        const actions = document.createElement("div");
	        actions.className = "today-actions";

		          if (!isSlimMode) {
		            const noteNextBtn = document.createElement("button");
		            noteNextBtn.type = "button";
		            noteNextBtn.className = "chip-btn chip-btn-ghost";
		            noteNextBtn.textContent = "Note for next time";
		            noteNextBtn.addEventListener("click", (e) => {
		              e.stopPropagation();
		              if (!file) return;
	              openNoticePrompt("Note for next time", file.nextTimeNotePending || "", (val) => {
	                const trimmed = String(val || "").trim();
	                if (trimmed) {
	                  file.nextTimeNotePending = trimmed;
	                  saveToStorage();
	                  showToast("Saved for next time.", "success");
	                } else {
	                  file.nextTimeNotePending = "";
	                  saveToStorage();
	                }
	                renderTodayTodos();
	              });
	            });

	            const reorderActions = document.createElement("div");
	            reorderActions.className = "today-reorder-actions";

	            const idx = todayTodos.findIndex((t) => t.id === todo.id);
	            const upBtn = document.createElement("button");
	            upBtn.type = "button";
	            upBtn.className = "icon-btn icon-btn-ghost today-reorder-btn";
	            upBtn.textContent = "↑";
	            upBtn.title = "Move up";
	            upBtn.setAttribute("aria-label", "Move up");
	            upBtn.disabled = idx <= 0;
	            upBtn.addEventListener("click", (e) => {
	              e.stopPropagation();
	              const moved = moveTodoByDelta(todo.id, -1);
	              if (moved) {
	                const nextIdx = todayTodos.findIndex((t) => t.id === todo.id);
	                showToast("Moved in Today's focus.", "success");
	                announceLive(`Moved “${(file && file.name) || todo.label || "Untitled"}” to position ${nextIdx + 1}.`);
	                flashTodayTodoElement(todo.id);
	              }
	            });

	            const downBtn = document.createElement("button");
	            downBtn.type = "button";
	            downBtn.className = "icon-btn icon-btn-ghost today-reorder-btn";
	            downBtn.textContent = "↓";
	            downBtn.title = "Move down";
	            downBtn.setAttribute("aria-label", "Move down");
	            downBtn.disabled = idx === -1 || idx >= todayTodos.length - 1;
	            downBtn.addEventListener("click", (e) => {
	              e.stopPropagation();
	              const moved = moveTodoByDelta(todo.id, 1);
	              if (moved) {
	                const nextIdx = todayTodos.findIndex((t) => t.id === todo.id);
	                showToast("Moved in Today's focus.", "success");
	                announceLive(`Moved “${(file && file.name) || todo.label || "Untitled"}” to position ${nextIdx + 1}.`);
	                flashTodayTodoElement(todo.id);
	              }
	            });

	            reorderActions.appendChild(upBtn);
	            reorderActions.appendChild(downBtn);
		            actions.appendChild(reorderActions);
		            if (isFileTodo && file) actions.appendChild(noteNextBtn);
		          }

	        item.addEventListener("keydown", (event) => {
	          if (isSlimMode && (event.key === "Enter" || event.key === " ")) {
	            const target = event.target;
	            if (target && (target.tagName === "BUTTON" || target.tagName === "INPUT" || target.tagName === "A")) return;
	            event.preventDefault();
	            if (isSlimExpanded) return;
	            openSubtasksModal(todo, file, subj);
	            return;
	          }
	          if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
	            event.preventDefault();
	            event.stopPropagation();
	            const moved = moveTodoByDelta(todo.id, event.key === "ArrowUp" ? -1 : 1);
            if (moved) {
              const nextIdx = todayTodos.findIndex((t) => t.id === todo.id);
              showToast("Moved in Today's focus.", "success");
              announceLive(`Moved “${(file && file.name) || todo.label || "Untitled"}” to position ${nextIdx + 1}.`);
              flashTodayTodoElement(todo.id);
            }
            return;
          }
	          if (event.key === "Delete" && !isThisActive) {
	            event.preventDefault();
	            event.stopPropagation();
	            showNotice("Remove this item from Today's focus?", "warn", () => {
              removeTodo(todo.id);
              renderTable();
              announceLive(`Removed “${(file && file.name) || todo.label || "Untitled"}” from Today’s focus.`);
            });
          }
        });

	        if (!isThisActive) {
	          if (isSlimMode) {
	            const removeX = document.createElement("button");
	            removeX.type = "button";
	            removeX.className = "today-remove-x";
	            removeX.textContent = "✕";
	            removeX.title = "Remove";
	            removeX.setAttribute("aria-label", "Remove");
	            removeX.addEventListener("click", (e) => {
	              e.stopPropagation();
	              showNotice("Remove this item from Today's focus?", "warn", () => {
	                removeTodo(todo.id);
	                renderTable();
	                announceLive(`Removed “${(file && file.name) || todo.label || "Untitled"}” from Today’s focus.`);
	              });
	            });
	            item.appendChild(removeX);
	          } else {
	            const removeBtn = document.createElement("button");
	            removeBtn.type = "button";
	            removeBtn.className = "today-remove-btn";
	            removeBtn.textContent = "Remove";
	            removeBtn.addEventListener("click", () => {
	              showNotice("Remove this item from Today's focus?", "warn", () => {
	                removeTodo(todo.id);
	                renderTable();
	                announceLive(`Removed “${(file && file.name) || todo.label || "Untitled"}” from Today’s focus.`);
	              });
	            });
	            actions.appendChild(removeBtn);
	          }
	        }

	        if (isSlimMode) {
	          actions.appendChild(checkbox);
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
		          hint.textContent = isFileTodo
		            ? "No subtasks yet. Add what you want to cover for this file."
		            : "No subtasks yet. Add what you want to do.";
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

        let toggleSubsBtn = null;
        if (!useCompactTodayActions) {
          toggleSubsBtn = document.createElement("button");
          toggleSubsBtn.type = "button";
          toggleSubsBtn.className = "today-subtasks-toggle";
          toggleSubsBtn.textContent = "Subtasks";
          toggleSubsBtn.setAttribute("aria-expanded", "true");

          const updateToggle = () => {
            const isCollapsed = subtasksWrap.classList.contains("collapsed");
            const count = subs.length;
            if (isCollapsed) {
              if (!count) toggleSubsBtn.textContent = "0 subtasks";
              else toggleSubsBtn.textContent = count === 1 ? "1 subtask" : `${count} subtasks`;
            } else {
              toggleSubsBtn.textContent = "Hide";
            }
            toggleSubsBtn.setAttribute("aria-expanded", String(!isCollapsed));
          };

          toggleSubsBtn.addEventListener("click", () => {
            subtasksWrap.classList.toggle("collapsed");
            updateToggle();
          });

          updateToggle();
        }

	        item.appendChild(topRow);
	        if (!todo.done) {
	          if (!isSlimMode) {
	            if (toggleSubsBtn) item.appendChild(toggleSubsBtn);
	            item.appendChild(subtasksWrap);
	          } else if (isSlimExpanded) {
	            item.appendChild(subtasksWrap);
	          }
	        }

	        if (!todo.done && isSlimMode) {
	          const footer = document.createElement("div");
	          footer.className = "today-slim-footer";
	          let footerHasContent = false;

	          if (!isThisActive) {
	            if (!useCompactTodayActions) {
	              const subsBtn = document.createElement("button");
	              subsBtn.type = "button";
	              subsBtn.className = "chip-btn chip-btn-ghost";
	              subsBtn.textContent = "Subtasks";
	              subsBtn.addEventListener("click", (e) => {
	                e.stopPropagation();
	                openSubtasksModal(todo, file, subj);
	              });
	              footer.appendChild(subsBtn);
	              footerHasContent = true;
	            }

	            if (!useCompactTodayActions && isFileTodo) {
	              const studyBtn = document.createElement("button");
	              studyBtn.type = "button";
	              studyBtn.className = "chip-btn chip-btn-primary";
	              studyBtn.textContent = "Study";
	              studyBtn.addEventListener("click", (e) => {
	                e.stopPropagation();
	                if (subj && file) {
	                  moveTodoToTop(todo.id, { render: false });
	                  startStudy(todo.subjectId, file);
	                }
	              });
	              footer.appendChild(studyBtn);
	              footerHasContent = true;
	            }
	          } else {
	            const primaryBtn = document.createElement("button");
	            primaryBtn.type = "button";
	            primaryBtn.className = "chip-btn chip-btn-primary";
	            primaryBtn.textContent = isPaused ? "Resume" : "Pause";
	            primaryBtn.addEventListener("click", (e) => {
	              e.stopPropagation();
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
	            stopBtn.addEventListener("click", (e) => {
	              e.stopPropagation();
	              stopStudy(todo.subjectId, todo.fileId);
	            });

	            footer.appendChild(primaryBtn);
	            footer.appendChild(stopBtn);
	            footerHasContent = true;
	          }

	          if (footerHasContent) item.appendChild(footer);
	        }

	        if (isSlimMode && !todo.done) {
	          item.addEventListener("click", (event) => {
	            const target = event.target;
	            if (target && typeof target.closest === "function") {
	              if (target.closest("button, input, a")) return;
	            }
	            if (isSlimExpanded) return;
	            openSubtasksModal(todo, file, subj);
	          });
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

	    let scheduleManualTodoModalState = null; // { dayKey, type, subtasks: string[] }

	    function renderScheduleManualTodoSubtasks() {
	      if (!scheduleManualTodoSubtaskList || !scheduleManualTodoModalState) return;
	      scheduleManualTodoSubtaskList.innerHTML = "";
	      const items = Array.isArray(scheduleManualTodoModalState.subtasks)
	        ? scheduleManualTodoModalState.subtasks
	        : [];
	      if (!items.length) return;
	      items.forEach((label, idx) => {
	        const chip = document.createElement("div");
	        chip.className = "subtask-chip";
	        const text = document.createElement("span");
	        text.textContent = label;
	        const remove = document.createElement("button");
	        remove.type = "button";
	        remove.className = "subtask-chip-remove";
	        remove.textContent = "✕";
	        remove.addEventListener("click", () => {
	          scheduleManualTodoModalState.subtasks.splice(idx, 1);
	          renderScheduleManualTodoSubtasks();
	        });
	        chip.appendChild(text);
	        chip.appendChild(remove);
	        scheduleManualTodoSubtaskList.appendChild(chip);
	      });
	    }

	    function renderScheduleManualTodoSubjectOptions(selectedId) {
	      if (!scheduleManualTodoSubjectSelect) return;
	      scheduleManualTodoSubjectSelect.innerHTML = "";
	      if (!subjects.length) {
	        const opt = document.createElement("option");
	        opt.value = "";
	        opt.textContent = "No subjects yet";
	        scheduleManualTodoSubjectSelect.appendChild(opt);
	        return;
	      }
	      {
	        const opt = document.createElement("option");
	        opt.value = "";
	        opt.textContent = "Select subject…";
	        scheduleManualTodoSubjectSelect.appendChild(opt);
	      }
	      subjects.forEach((subj) => {
	        const opt = document.createElement("option");
	        opt.value = subj.id;
	        opt.textContent = subj.name || "Subject";
	        scheduleManualTodoSubjectSelect.appendChild(opt);
	      });
	      if (selectedId && subjects.some((s) => s.id === selectedId)) {
	        scheduleManualTodoSubjectSelect.value = selectedId;
	      }
	    }

	    function renderScheduleManualTodoFileOptions(subjectId, selectedFileId) {
	      if (!scheduleManualTodoFileSelect) return;
	      scheduleManualTodoFileSelect.innerHTML = "";
	      if (!subjectId) {
	        const opt = document.createElement("option");
	        opt.value = "";
	        opt.textContent = "Select subject first";
	        scheduleManualTodoFileSelect.appendChild(opt);
	        return;
	      }
	      const subj = subjects.find((s) => s.id === subjectId);
	      const files = subj && Array.isArray(subj.files) ? subj.files : [];
	      if (!files.length) {
	        const opt = document.createElement("option");
	        opt.value = "";
	        opt.textContent = "No files";
	        scheduleManualTodoFileSelect.appendChild(opt);
	        return;
	      }
	      {
	        const opt = document.createElement("option");
	        opt.value = "";
	        opt.textContent = "Select task…";
	        scheduleManualTodoFileSelect.appendChild(opt);
	      }
	      files.forEach((file) => {
	        const opt = document.createElement("option");
	        opt.value = file.id;
	        opt.textContent = file.name || "Untitled file";
	        scheduleManualTodoFileSelect.appendChild(opt);
	      });
	      if (selectedFileId && files.some((f) => f.id === selectedFileId)) {
	        scheduleManualTodoFileSelect.value = selectedFileId;
	      }
	    }

	    function setScheduleManualTodoModalType(type) {
	      if (!scheduleManualTodoModalState) return;
	      const t =
	        type === "deadline" ? "deadline" : type === "subject_todo" ? "subject_todo" : "custom_todo";
	      scheduleManualTodoModalState.type = t;

	      const isDeadline = t === "deadline";
	      const isSubject = t === "subject_todo";
	      const isCustom = t === "custom_todo";

	      if (scheduleManualTodoNameLabel) {
	        scheduleManualTodoNameLabel.textContent = isDeadline ? "Deadline title" : "Todo title";
	      }
	      if (scheduleManualTodoNameInput) {
	        scheduleManualTodoNameInput.hidden = isSubject;
	        scheduleManualTodoNameInput.style.display = isSubject ? "none" : "";
	      }

	      const nameRow = scheduleManualTodoNameLabel?.closest(".modal-field-row") || null;
	      if (nameRow) {
	        nameRow.hidden = isSubject;
	        nameRow.style.display = isSubject ? "none" : "";
	      }

	      if (scheduleManualTodoSubjectRow) scheduleManualTodoSubjectRow.hidden = !isSubject;
	      if (scheduleManualTodoFileRow) scheduleManualTodoFileRow.hidden = !isSubject;
	      if (scheduleManualTodoDeadlineFields) scheduleManualTodoDeadlineFields.hidden = !isDeadline;

	      const subtaskBlock = scheduleManualTodoSubtaskList?.closest(".modal-field") || null;
	      if (subtaskBlock) {
	        subtaskBlock.hidden = isDeadline;
	        subtaskBlock.style.display = isDeadline ? "none" : "";
	      }

	      if (scheduleManualTodoModalSave) {
	        scheduleManualTodoModalSave.textContent =
	          isDeadline ? "Add deadline" : isSubject ? "Add subject task" : "Add todo";
	      }

	      if (isSubject) {
	        const currentSubject = scheduleManualTodoSubjectSelect?.value || "";
	        renderScheduleManualTodoSubjectOptions(currentSubject);
	        const sid = scheduleManualTodoSubjectSelect?.value || "";
	        const currentFile = scheduleManualTodoFileSelect?.value || "";
	        renderScheduleManualTodoFileOptions(sid, currentFile);
	      }

	      if (isDeadline) {
	        if (scheduleManualTodoDeadlineType && !scheduleManualTodoDeadlineType.value) {
	          scheduleManualTodoDeadlineType.value = "deadline";
	        }
	        if (scheduleManualTodoDeadlinePriority && !scheduleManualTodoDeadlinePriority.value) {
	          scheduleManualTodoDeadlinePriority.value = "normal";
	        }
	      }
	    }

	    function addScheduleManualTodoSubtaskFromInput() {
	      if (!scheduleManualTodoModalState || !scheduleManualTodoSubtaskInput) return;
	      const txt = scheduleManualTodoSubtaskInput.value.trim();
	      if (!txt) return;
	      scheduleManualTodoModalState.subtasks.push(txt);
	      scheduleManualTodoSubtaskInput.value = "";
	      renderScheduleManualTodoSubtasks();
	    }

	    function closeScheduleManualTodoModal() {
	      scheduleManualTodoModalState = null;
	      if (!scheduleManualTodoModalBackdrop) return;
	      scheduleManualTodoModalBackdrop.hidden = true;
	      scheduleManualTodoModalBackdrop.style.display = "none";
	    }

	    function openScheduleManualTodoModal(dayKey) {
	      if (!scheduleManualTodoModalBackdrop) return;
	      const key = String(dayKey || "").trim();
	      if (!key) return;
	      scheduleManualTodoModalState = { dayKey: key, type: "custom_todo", subtasks: [] };
	      if (scheduleManualTodoModalTitle) scheduleManualTodoModalTitle.textContent = "Add todo";
	      if (scheduleManualTodoModalSubtitle) {
	        const date = parseCalendarDate(key);
	        scheduleManualTodoModalSubtitle.textContent = date
	          ? `For ${date.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "2-digit" })}`
	          : "Create a custom todo for the selected day.";
	      }
	      if (scheduleManualTodoTypeSelect) scheduleManualTodoTypeSelect.value = "custom_todo";
	      if (scheduleManualTodoNameInput) scheduleManualTodoNameInput.value = "";
	      if (scheduleManualTodoSubtaskInput) scheduleManualTodoSubtaskInput.value = "";
	      if (scheduleManualTodoDeadlineTime) scheduleManualTodoDeadlineTime.value = "";
	      if (scheduleManualTodoDeadlineType) scheduleManualTodoDeadlineType.value = "deadline";
	      if (scheduleManualTodoDeadlinePriority) scheduleManualTodoDeadlinePriority.value = "normal";
	      if (scheduleManualTodoDeadlineNotes) scheduleManualTodoDeadlineNotes.value = "";

	      renderScheduleManualTodoSubtasks();
	      setScheduleManualTodoModalType("custom_todo");
	      scheduleManualTodoModalBackdrop.hidden = false;
	      scheduleManualTodoModalBackdrop.style.display = "flex";
	      scheduleManualTodoNameInput?.focus();
	    }

	    function submitScheduleManualTodoModal() {
	      if (!scheduleManualTodoModalState) return;
	      const dayKey = scheduleManualTodoModalState.dayKey;
	      const type = scheduleManualTodoModalState.type || "custom_todo";
	      const label = (scheduleManualTodoNameInput?.value || "").trim();
	      const subtasks = Array.isArray(scheduleManualTodoModalState.subtasks)
	        ? [...scheduleManualTodoModalState.subtasks]
	        : [];

	      if (dayKey < getTodayKey()) {
	        showNotice("Please pick today or a future day.", "warn");
	        return;
	      }

	      if (type === "deadline") {
	        if (!label) {
	          showNotice("Please enter a deadline title.", "warn");
	          scheduleManualTodoNameInput?.focus();
	          return;
	        }
	        const ok = addCalendarEvent({
	          title: label,
	          date: dayKey,
	          time: scheduleManualTodoDeadlineTime?.value || "",
	          type: scheduleManualTodoDeadlineType?.value || "deadline",
	          priority: scheduleManualTodoDeadlinePriority?.value || "normal",
	          notes: scheduleManualTodoDeadlineNotes?.value || ""
	        });
	        if (ok) {
	          loadCalendarEvents();
	          renderScheduleView();
	          showToast("Deadline added.", "success");
	          closeScheduleManualTodoModal();
	        }
	        return;
	      }

	      if (type === "subject_todo") {
	        const subjectId = scheduleManualTodoSubjectSelect?.value || "";
	        const fileId = scheduleManualTodoFileSelect?.value || "";
	        if (!subjectId || !fileId) {
	          showNotice("Please pick a subject and task.", "warn");
	          return;
	        }
	        const ok = addTodoForFileToDay(dayKey, subjectId, fileId, subtasks);
	        if (ok) showToast("Task added.", "success");
	        else showNotice("That task is already on this day.", "warn");
	        closeScheduleManualTodoModal();
	        return;
	      }

	      if (!label) {
	        showNotice("Please enter a todo title.", "warn");
	        scheduleManualTodoNameInput?.focus();
	        return;
	      }

	      const ok = addCustomTodoToDay(dayKey, label, subtasks);
	      if (ok) showToast("Todo added.", "success");
	      closeScheduleManualTodoModal();
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
        if (scheduleWeekendShifted) {
          start.setDate(start.getDate() + 2);
          daysToRender = 5;
        }
        if (!scheduleWeekendShifted) {
          daysToRender = 5;
        }
        end = new Date(start);
        end.setDate(start.getDate() + daysToRender - 1);
        if (scheduleRangeLabel) {
          scheduleRangeLabel.textContent = formatWeekRangeLabel(start, end);
        }
        if (scheduleTodayBtn) scheduleTodayBtn.textContent = "This week";
	      }

	      scheduleGrid.innerHTML = "";
      if (!phone) {
        scheduleGrid.classList.toggle("schedule-grid-weekend", scheduleWeekendShifted);
      }
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

	        const dayCalendarEvents = (calendarEvents || [])
	          .filter((evt) => evt && evt.date === key)
	          .slice()
	          .sort((a, b) => {
	            const da = a && a.done ? 1 : 0;
	            const db = b && b.done ? 1 : 0;
	            if (da !== db) return da - db;
	            const ta = a.time || "24:00";
	            const tb = b.time || "24:00";
	            if (ta === tb) return String(a.title || "").localeCompare(String(b.title || ""));
	            return String(ta).localeCompare(String(tb));
	          });

	        const hasOpenDeadline = dayCalendarEvents.some(
	          (evt) =>
	            evt &&
	            !evt.done &&
	            (evt.type === "deadline" || evt.type === "exam")
	        );
	        if (hasOpenDeadline) col.classList.add("schedule-day-alert");

	        dayCalendarEvents.forEach((evt) => {
	          const chip = document.createElement("div");
	          chip.className =
	            "schedule-focus-chip schedule-deadline-chip schedule-deadline-" +
	            (evt.type || "deadline");
	          if (evt.done) chip.classList.add("schedule-chip-done");

	          const label = document.createElement("div");
	          label.className = "schedule-chip-label";
	          const time = evt.time ? `${evt.time} · ` : "";
	          label.textContent = time + (evt.title || "Deadline");
	          label.title = evt.notes ? `${evt.title}\n\n${evt.notes}` : evt.title || "Deadline";

	          const del = document.createElement("button");
	          del.type = "button";
	          del.className = "schedule-deadline-delete";
	          del.textContent = "✕";
	          del.title = "Delete";
	          del.setAttribute("aria-label", "Delete");
	          del.addEventListener("click", (e) => {
	            e.stopPropagation();
	            if (!confirm(`Delete "${evt.title || "calendar item"}"?`)) return;
	            const removed = removeCalendarEvent(evt.id);
	            if (removed) {
	              loadCalendarEvents();
	              renderScheduleView();
	              showToast("Deleted.", "success");
	            }
	          });

	          const cb = document.createElement("input");
	          cb.type = "checkbox";
	          cb.className = "schedule-deadline-check";
	          cb.checked = !!evt.done;
	          cb.addEventListener("click", (e) => e.stopPropagation());
	          cb.addEventListener("change", () => {
	            const changed = toggleCalendarEventDone(evt.id, cb.checked);
	            if (changed) {
	              loadCalendarEvents();
	              renderScheduleView();
	            }
	          });

	          chip.appendChild(label);
	          chip.appendChild(del);
	          chip.appendChild(cb);

	          chip.addEventListener("click", () => {
	            const parts = [];
	            parts.push(evt.type ? String(evt.type) : "deadline");
	            if (evt.time) parts.push(String(evt.time));
	            if (evt.priority) parts.push(String(evt.priority));
	            const meta = parts.filter(Boolean).join(" · ");
	            const msg = (meta ? meta + "\n\n" : "") + (evt.notes ? String(evt.notes) : "");
	            showNotice(msg || "Calendar item.", "info");
	          });

	          list.appendChild(chip);
	        });

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

	        if (!orderedList.length && !dayCalendarEvents.length) {
	          const empty = document.createElement("div");
	          empty.className = "schedule-empty";
	          empty.textContent = "No focus captured.";
	          list.appendChild(empty);
	        } else {
	          orderedList.forEach((todo) => {
	            const isCustom = (todo.kind || "file") === "custom";
	            const isFileTodo = !isCustom && !!todo.subjectId && !!todo.fileId;
	            const { subj, file } = isFileTodo
	              ? resolveFileRef(todo.subjectId, todo.fileId)
	              : { subj: null, file: null };
	            const chip = document.createElement("div");
	            chip.className =
	              "schedule-focus-chip " + (isCustom ? "schedule-chip-custom" : "schedule-chip-subject");
	            const color = isCustom ? "#64748b" : getSubjectColorById(todo.subjectId);
	            const tintAlpha = isCustom ? 0.22 : getSubjectTintAlphaById(todo.subjectId);
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
	            if (isToday && !isDone && isFileTodo) {
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

	        if (key && todayKey && key >= todayKey) {
	          const add = document.createElement("button");
	          add.type = "button";
	          add.className = "schedule-focus-chip schedule-add-chip";
	          add.textContent = "+";
	          add.title = "Add todo";
	          add.setAttribute("aria-label", "Add todo");
	          add.addEventListener("click", (event) => {
	            event.stopPropagation();
	            openScheduleManualTodoModal(key);
	          });
	          list.appendChild(add);
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
	      const isCustom = (todo && (todo.kind || "file")) === "custom";
	      const isFileTodo = !isCustom && !!todo.subjectId && !!todo.fileId;
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

	      if (onToday && subs.length) {
	        const allRow = document.createElement("label");
	        allRow.className = "schedule-task-all";
	        const allCb = document.createElement("input");
	        allCb.type = "checkbox";
	        const allDone = subs.every((s) => s && s.done);
	        allCb.checked = allDone;
	        const allText = document.createElement("span");
	        allText.textContent = "Mark all done";
	        allCb.addEventListener("change", () => {
	          setAllSubtasks(todo.id, allCb.checked, { promptConfidence: true });
	          const updated =
	            dayKey === getTodayKey()
	              ? todayTodos.find((t) => t && t.id === todo.id)
	              : (dailyFocusMap[dayKey] || []).find((t) => t && t.id === todo.id);
	          requestAnimationFrame(() => {
	            if (updated) openScheduleTaskModal(updated, dayKey);
	          });
	        });
	        allRow.appendChild(allCb);
	        allRow.appendChild(allText);
	        scheduleTaskModalSubtasks.appendChild(allRow);
	      }

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
	        scheduleTaskStudyBtn.disabled = !onToday || !isFileTodo;
	        scheduleTaskStudyBtn.textContent = !isFileTodo
	          ? "Study (files only)"
	          : onToday
	          ? "Study now"
	          : "Study (today only)";
	        scheduleTaskStudyBtn.onclick = () => {
	          if (!onToday || !isFileTodo) return;
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
	      const endedAtMs = Date.now();
	      const rawElapsed = computeElapsedMs(session);
	      const elapsed =
	        typeof session.targetMs === "number" && session.timerMode !== "stopwatch"
	          ? Math.min(rawElapsed, session.targetMs)
	          : rawElapsed;
	      let recapPayload = null;

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
            const confidenceBefore = typeof file.confidence === "number" ? file.confidence : Number(file.confidence) || null;
            file.totalMs = (file.totalMs || 0) + elapsed;
            file.sessions = (file.sessions || 0) + 1;
            file.lastSessionMs = elapsed;
            file.lastReviewed = new Date().toISOString();
            const startedAtMs = endedAtMs - elapsed;
            const startKey = getDayId(new Date(startedAtMs), 2);
            const endKey = getDayId(new Date(endedAtMs - 1), 2);
            if (startKey && endKey && startKey !== endKey) {
              // Split the counted study time across the 02:00 Europe/Berlin day boundary.
              ensureDailyPacked(file);
              let cursorStart = startedAtMs;
              let safety = 0;
              while (cursorStart < endedAtMs && safety < 8) {
                const key = getDayId(new Date(cursorStart), 2);
                const finalKey = getDayId(new Date(endedAtMs - 1), 2);
                if (!key || !finalKey) break;
                if (key === finalKey) {
                  const dayId = dateKeyToDayId(key);
                  if (dayId !== null) {
                    file.dailyMsPacked = packedAdd(file.dailyMsPacked || "", dayId, endedAtMs - cursorStart);
                  }
                  break;
                }

                let lo = cursorStart;
                let hi = endedAtMs;
                while (hi - lo > 1000) {
                  const mid = Math.floor((lo + hi) / 2);
                  if (getDayId(new Date(mid), 2) === key) lo = mid;
                  else hi = mid;
                }
                const boundary = hi;
                const dayId = dateKeyToDayId(key);
                if (dayId !== null) {
                  file.dailyMsPacked = packedAdd(file.dailyMsPacked || "", dayId, boundary - cursorStart);
                }
                cursorStart = boundary;
                safety += 1;
              }
            } else {
              addDailyStudyForFile(file, elapsed);
            }
            addDailySessionForFile(file);
            if (markComplete) {
              markTodoDoneByFile(session.subjectId, session.fileId);
            }
            if (autoFinished && window.StudyPlanner?.SessionJournal?.openRecap) {
              recapPayload = {
                kind: "study",
                subjectId: session.subjectId,
                fileId: session.fileId,
                assignmentId: session.assignmentId || null,
                elapsedMs: elapsed,
                endedAtMs,
                startedAtMs,
                confidenceBefore
              };
            }
          }
        }
      }

      if (session.kind === "study" && session.assignmentId) {
        const addMin = Math.max(1, Math.round(elapsed / 60000));
        const A = window.StudyPlanner && window.StudyPlanner.Assignments ? window.StudyPlanner.Assignments : null;
        try {
          if (A) A.addSpentMinutes(session.assignmentId, addMin);
        } catch {}
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
      if (recapPayload && window.StudyPlanner?.SessionJournal?.openRecap) {
        window.StudyPlanner.SessionJournal.openRecap(recapPayload);
      }
    }

    function startStudy(subjectId, file) {
      // Time budget guardrails (hard stop only).
      try {
        const TB = window.StudyPlanner && window.StudyPlanner.TimeBudget ? window.StudyPlanner.TimeBudget : null;
        if (TB && typeof TB.canStartSession === "function" && TB.load) {
          const sessions = (window.StudyPlanner?.Storage?.getJSON
            ? window.StudyPlanner.Storage.getJSON("studySessions_v1", [])
            : (() => {
                try {
                  const raw = localStorage.getItem("studySessions_v1");
                  const parsed = raw ? JSON.parse(raw) : [];
                  return Array.isArray(parsed) ? parsed : [];
                } catch {
                  return [];
                }
              })());
          const verdict = TB.canStartSession({ sessions, now: Date.now() });
          if (!verdict.ok) {
            showNotice(
              verdict.reason === "daily"
                ? "Daily time budget reached. (Hard stop enabled)"
                : "Weekly time budget reached. (Hard stop enabled)",
              "warn"
            );
            return;
          }
        }
      } catch {}

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

    function startStudyForAssignment(assignmentId, subjectId, file) {
      if (!assignmentId) return startStudy(subjectId, file);
      startStudy(subjectId, file);
      if (activeStudy && activeStudy.kind === "study" && activeStudy.subjectId === subjectId && activeStudy.fileId === file.id) {
        activeStudy.assignmentId = assignmentId;
        saveActiveSession();
        const A = window.StudyPlanner && window.StudyPlanner.Assignments ? window.StudyPlanner.Assignments : null;
        try {
          if (A) {
            const item = A.getById(assignmentId);
            if (item && item.status === "todo") A.upsert({ ...item, status: "in_progress" });
          }
        } catch {}
      }
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
	        }
	      } else {
	        const text = formatHMS(elapsed);
	        focusTimerDisplay.textContent = text;
	        if (activeStudy.kind === "study" && activeStudy.fileId) {
	          const span = document.getElementById("timer-" + activeStudy.fileId);
	          if (span) span.textContent = text;
	        }
	      }
	    }

    let lastStudyDayKey = null;
    function maybeHandleStudyDayRollover() {
      const key = getTodayKey();
      if (!key) return;
      if (lastStudyDayKey === null) {
        lastStudyDayKey = key;
        return;
      }
      if (key === lastStudyDayKey) return;
      lastStudyDayKey = key;

      const next = dailyFocusMap && Array.isArray(dailyFocusMap[key]) ? dailyFocusMap[key] : [];
      todayTodos = cloneTodos(next);
      saveTodayTodos();
      renderTodayTodos();
      renderScheduleView();
      renderTable();
    }

    setInterval(function () {
      maybeHandleStudyDayRollover();
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
        emptyHint.innerHTML = "";
        emptyHint.style.display = "block";
        const msg = document.createElement("div");
        msg.textContent = "No subjects yet. Create your first subject to start tracking.";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn";
        btn.textContent = "+ Add first subject";
        btn.addEventListener("click", () => {
          const addBtn = document.getElementById("addSubjectBtn");
          if (addBtn) addBtn.click();
        });
        emptyHint.appendChild(msg);
        emptyHint.appendChild(btn);
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
            row.dataset.subjectId = subj.id;
            row.dataset.fileId = file.id;

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

            const actionsRow = document.createElement("div");
            actionsRow.className = "file-actions-row";
            actionsRow.addEventListener("click", (event) => event.stopPropagation());

	            const addTodayActionBtn = document.createElement("button");
	            addTodayActionBtn.type = "button";
	            addTodayActionBtn.className =
	              "icon-btn icon-btn-ghost file-action-btn " + (inToday ? "file-action-remove" : "file-action-add");
	            addTodayActionBtn.textContent = inToday ? "−" : "+";
	            addTodayActionBtn.title = inToday ? "Remove from Today's focus" : "Add to Today's focus";
	            addTodayActionBtn.setAttribute(
	              "aria-label",
	              inToday ? "Remove from Today's focus" : "Add to Today's focus"
	            );
	            addTodayActionBtn.addEventListener("click", (event) => {
	              event.stopPropagation();
	              if (inToday) {
	                showNotice("Remove this file from Today's focus?", "warn", () => {
	                  cleanupTodoForFile(subj.id, file.id);
	                  renderTable();
	                  announceLive(`Removed “${file.name || "Untitled"}” from Today’s focus.`);
	                });
	                return;
	              }
	              openAddTodoModal(subj.id, file);
	            });

            const moveUpBtn = document.createElement("button");
            moveUpBtn.type = "button";
            moveUpBtn.className = "icon-btn icon-btn-ghost file-action-btn";
            moveUpBtn.textContent = "↑";
            moveUpBtn.title = "Move up";
            moveUpBtn.setAttribute("aria-label", "Move up");

            const moveDownBtn = document.createElement("button");
            moveDownBtn.type = "button";
            moveDownBtn.className = "icon-btn icon-btn-ghost file-action-btn";
            moveDownBtn.textContent = "↓";
            moveDownBtn.title = "Move down";
            moveDownBtn.setAttribute("aria-label", "Move down");

            const ensureManualAndMove = (delta) => {
              const fileIndex = subj.files.findIndex((f) => f.id === file.id);
              if (fileIndex === -1) return;

              if (subj.sortMode && subj.sortMode !== "manual") {
                subj.sortMode = "manual";
                applySortToSubject(subj);
                showToast("Switched to manual order to reorder.", "info");
              }

              const idx = subj.files.findIndex((f) => f.id === file.id);
              const nextIdx = idx + delta;
              if (nextIdx < 0 || nextIdx >= subj.files.length) return;
              const [moved] = subj.files.splice(idx, 1);
              subj.files.splice(nextIdx, 0, moved);
              updateManualOrder(subj);
              saveToStorage();
              renderTable();
              announceLive(
                `Moved “${file.name || "Untitled"}” to position ${nextIdx + 1} in ${subj.name || "subject"}.`
              );
            };

            if (!subj.sortMode || subj.sortMode === "manual") {
              const fileIndex = subj.files.findIndex((f) => f.id === file.id);
              if (fileIndex <= 0) moveUpBtn.disabled = true;
              if (fileIndex === -1 || fileIndex >= subj.files.length - 1) moveDownBtn.disabled = true;
            }

            moveUpBtn.addEventListener("click", (event) => {
              event.stopPropagation();
              ensureManualAndMove(-1);
            });
            moveDownBtn.addEventListener("click", (event) => {
              event.stopPropagation();
              ensureManualAndMove(1);
            });

            actionsRow.appendChild(addTodayActionBtn);
            actionsRow.appendChild(moveUpBtn);
            actionsRow.appendChild(moveDownBtn);
            rightMeta.appendChild(actionsRow);

            row.addEventListener("keydown", (event) => {
              if (!event.altKey) return;
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
              const target = event.target;
              if (target && target.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
              event.preventDefault();
              event.stopPropagation();
              ensureManualAndMove(event.key === "ArrowUp" ? -1 : 1);
            });

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
	                const studyActionsRow = document.createElement("div");
	                studyActionsRow.className = "file-study-actions-row";

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

	                studyActionsRow.appendChild(primaryBtn);
	                studyActionsRow.appendChild(stopBtn);
	                rightMeta.insertBefore(studyActionsRow, rightMeta.firstChild);
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
	      ensureSubjectFourSnap();

	      updateSummary();
	      renderDueSoonLane();
	      renderSmartSuggestions();
      updateStudyTimerDisplay();
    }
