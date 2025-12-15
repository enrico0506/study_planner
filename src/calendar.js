(() => {
  const STORAGE_KEY = "studyCalendarEvents_v1";

  const monthLabel = document.getElementById("monthLabel");
  const calendarGrid = document.getElementById("calendarGrid");
  const selectedDateLabel = document.getElementById("selectedDateLabel");
  const selectedDateMeta = document.getElementById("selectedDateMeta");
  const selectedEventList = document.getElementById("selectedEventList");
  const upcomingList = document.getElementById("upcomingList");

  const eventForm = document.getElementById("calendarForm");
  const calendarModal = document.getElementById("calendarModal");
  const calendarModalBackdrop = document.getElementById("calendarModalBackdrop");
  const modalDateLabel = document.getElementById("modalDateLabel");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const openSelectedFormBtn = document.getElementById("openSelectedFormBtn");
  const formTitleInput = document.getElementById("eventTitleInput");
  const formDateInput = document.getElementById("eventDateInput");
  const formTimeInput = document.getElementById("eventTimeInput");
  const formTypeSelect = document.getElementById("eventTypeSelect");
  const formPrioritySelect = document.getElementById("eventPrioritySelect");
  const formNotesInput = document.getElementById("eventNotesInput");
  const formStatus = document.getElementById("formStatus");
  const formSubmitBtn = document.getElementById("formSubmitBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  const newDeadlineTodayBtn = document.getElementById("newDeadlineTodayBtn");
  const prevMonthBtn = document.getElementById("prevMonthBtn");
  const nextMonthBtn = document.getElementById("nextMonthBtn");
  const todayMonthBtn = document.getElementById("todayMonthBtn");

  const today = new Date();
  let selectedDate = formatDate(today);
  let currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let currentWeekStart = weekStart(today);
  let events = loadEvents();
  let editingId = null;

  function isPhoneLayout() {
    return window.matchMedia && window.matchMedia("(max-width: 720px)").matches;
  }

  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function weekStart(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const weekday = (d.getDay() + 6) % 7; // Monday=0
    d.setDate(d.getDate() - weekday);
    d.setHours(12, 0, 0, 0);
    return d;
  }

  function formatWeekRange(start) {
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  }

  function parseDateString(dateString) {
    const [y, m, d] = (dateString || "").split("-").map((v) => parseInt(v, 10));
    if (!y || !m || !d) return new Date();
    return new Date(y, m - 1, d);
  }

  function loadEvents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn("Could not load calendar events", err);
      return [];
    }
  }

  function saveEvents() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch (err) {
      console.warn("Could not save calendar events", err);
    }
  }

  function calendarStart(date) {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const weekday = (first.getDay() + 6) % 7; // start week on Monday
    first.setDate(first.getDate() - weekday);
    return first;
  }

  function formatDisplayDate(date) {
    return new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric" }).format(date);
  }

  function formatDisplayMonth(date) {
    return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
  }

  function labelForType(type) {
    switch (type) {
      case "exam":
        return "Exam";
      case "study":
        return "Study";
      case "reminder":
        return "Reminder";
      default:
        return "Deadline";
    }
  }

  function labelForPriority(priority) {
    switch (priority) {
      case "important":
        return "Important";
      case "critical":
        return "Critical";
      default:
        return "Normal";
    }
  }

  function badgeTone(type) {
    switch (type) {
      case "exam":
        return "exam";
      case "study":
        return "study";
      case "reminder":
        return "reminder";
      default:
        return "deadline";
    }
  }

  function sortEvents(list) {
    return list.slice().sort((a, b) => {
      const timeA = a.time || "24:00";
      const timeB = b.time || "24:00";
      if (timeA === timeB) return a.title.localeCompare(b.title);
      return timeA.localeCompare(timeB);
    });
  }

  function eventsForDate(dateString) {
    return sortEvents(events.filter((evt) => evt.date === dateString));
  }

  function renderCalendar() {
    calendarGrid.innerHTML = "";
    if (isPhoneLayout()) {
      monthLabel.textContent = `Week · ${formatWeekRange(currentWeekStart)}`;
      const start = new Date(currentWeekStart);
      for (let i = 0; i < 7; i++) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        const dayKey = formatDate(day);
        const dayEvents = eventsForDate(dayKey);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "calendar-day";
        if (dayKey === selectedDate) btn.classList.add("calendar-day-selected");
        if (dayKey === formatDate(today)) btn.classList.add("calendar-day-today");
        if (dayEvents.length) btn.classList.add("calendar-day-has");

        const top = document.createElement("div");
        top.className = "calendar-day-top";
        top.textContent = day.toLocaleString("en", { weekday: "short" }) + " · " + day.getDate();

        const badges = document.createElement("div");
        badges.className = "calendar-day-badges";
        if (dayEvents.length) {
          const countChip = document.createElement("span");
          countChip.className = "calendar-chip calendar-chip-more";
          countChip.textContent = `${dayEvents.length} item${dayEvents.length === 1 ? "" : "s"}`;
          badges.appendChild(countChip);
          dayEvents.slice(0, 2).forEach((evt) => {
            const chip = document.createElement("span");
            chip.className = `calendar-chip calendar-chip-${badgeTone(evt.type)}`;
            chip.textContent = labelForType(evt.type);
            badges.appendChild(chip);
          });
        } else {
          const emptyChip = document.createElement("span");
          emptyChip.className = "calendar-chip calendar-chip-more";
          emptyChip.textContent = "No items";
          badges.appendChild(emptyChip);
        }

        btn.appendChild(top);
        btn.appendChild(badges);
        btn.setAttribute("aria-label", `${formatDisplayDate(day)}`);
        btn.addEventListener("click", () => selectDate(dayKey, false));
        calendarGrid.appendChild(btn);
      }
      return;
    }

    monthLabel.textContent = formatDisplayMonth(currentMonth);
    const start = calendarStart(currentMonth);
    for (let i = 0; i < 42; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const dayKey = formatDate(day);
      const dayEvents = eventsForDate(dayKey);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "calendar-day";
      if (day.getMonth() !== currentMonth.getMonth()) btn.classList.add("calendar-day-outside");
      if (dayKey === selectedDate) btn.classList.add("calendar-day-selected");
      if (dayKey === formatDate(today)) btn.classList.add("calendar-day-today");
      if (dayEvents.length) btn.classList.add("calendar-day-has");

      const top = document.createElement("div");
      top.className = "calendar-day-top";
      top.textContent = day.getDate();

      const badges = document.createElement("div");
      badges.className = "calendar-day-badges";
      dayEvents.slice(0, 3).forEach((evt) => {
        const chip = document.createElement("span");
        chip.className = `calendar-chip calendar-chip-${badgeTone(evt.type)}`;
        chip.textContent = labelForType(evt.type);
        badges.appendChild(chip);
      });
      if (dayEvents.length > 3) {
        const more = document.createElement("span");
        more.className = "calendar-chip calendar-chip-more";
        more.textContent = `+${dayEvents.length - 3}`;
        badges.appendChild(more);
      }

      btn.appendChild(top);
      btn.appendChild(badges);
      const eventLabel = dayEvents.length ? `${dayEvents.length} item${dayEvents.length === 1 ? "" : "s"}` : "No items";
      btn.setAttribute("aria-label", `${formatDisplayDate(day)} · ${eventLabel}`);
      btn.addEventListener("click", () => selectDate(dayKey, true));
      calendarGrid.appendChild(btn);
    }
  }

  function renderSelectedDay() {
    const dateObj = parseDateString(selectedDate);
    selectedDateLabel.textContent = formatDisplayDate(dateObj);
    const list = eventsForDate(selectedDate);
    selectedDateMeta.textContent = list.length
      ? `${list.length} scheduled item${list.length === 1 ? "" : "s"}`
      : "No items yet – add one from the form.";
    selectedEventList.innerHTML = "";

    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "calendar-empty";
      empty.textContent = "Nothing planned here yet.";
      selectedEventList.appendChild(empty);
      return;
    }

    list.forEach((evt) => {
      const row = document.createElement("div");
      row.className = "calendar-event-row";
      if (evt.done) row.classList.add("calendar-event-done");

      const left = document.createElement("div");
      left.className = "calendar-event-left";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!evt.done;
      checkbox.addEventListener("change", () => toggleDone(evt.id, checkbox.checked));
      left.appendChild(checkbox);

      const body = document.createElement("div");
      body.className = "calendar-event-body";
      const title = document.createElement("div");
      title.className = "calendar-event-title";
      title.textContent = evt.title;
      const meta = document.createElement("div");
      meta.className = "calendar-event-meta";
      const pieces = [
        labelForType(evt.type),
        evt.time ? evt.time : "Any time",
        labelForPriority(evt.priority || "normal")
      ];
      meta.textContent = pieces.join(" · ");
      body.appendChild(title);
      body.appendChild(meta);
      if (evt.notes) {
        const notes = document.createElement("div");
        notes.className = "calendar-event-notes";
        notes.textContent = evt.notes;
        body.appendChild(notes);
      }

      const actions = document.createElement("div");
      actions.className = "calendar-event-actions";
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "chip-btn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => startEditing(evt.id));
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "icon-btn icon-btn-ghost";
      deleteBtn.textContent = "✕";
      deleteBtn.setAttribute("aria-label", "Delete item");
      deleteBtn.addEventListener("click", () => deleteEvent(evt.id));
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      row.appendChild(left);
      row.appendChild(body);
      row.appendChild(actions);
      selectedEventList.appendChild(row);
    });
  }

  function renderUpcoming() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const horizon = new Date(now);
    horizon.setDate(now.getDate() + 21);
    const upcoming = events
      .filter((evt) => {
        if (evt.done) return false;
        const date = parseDateString(evt.date);
        return date >= now && date <= horizon;
      })
      .sort((a, b) => {
        const da = parseDateString(a.date);
        const db = parseDateString(b.date);
        if (da.getTime() === db.getTime()) {
          const ta = a.time || "24:00";
          const tb = b.time || "24:00";
          if (ta === tb) return a.title.localeCompare(b.title);
          return ta.localeCompare(tb);
        }
        return da - db;
      })
      .slice(0, 8);

    upcomingList.innerHTML = "";
    if (!upcoming.length) {
      const empty = document.createElement("div");
      empty.className = "calendar-empty";
      empty.textContent = "No upcoming items in the next three weeks.";
      upcomingList.appendChild(empty);
      return;
    }

    upcoming.forEach((evt) => {
      const card = document.createElement("div");
      card.className = "calendar-upcoming-row";
      const chip = document.createElement("span");
      chip.className = `calendar-chip calendar-chip-${badgeTone(evt.type)}`;
      chip.textContent = labelForType(evt.type);
      const title = document.createElement("div");
      title.className = "calendar-upcoming-title";
      title.textContent = evt.title;
      const dateLine = document.createElement("div");
      dateLine.className = "calendar-upcoming-meta";
      const dateObj = parseDateString(evt.date);
      const relDays = Math.round((dateObj - now) / (1000 * 60 * 60 * 24));
      const relLabel = relDays === 0 ? "Today" : relDays === 1 ? "Tomorrow" : `In ${relDays} days`;
      const timeLabel = evt.time ? evt.time : "Any time";
      dateLine.textContent = `${formatDisplayDate(dateObj)} · ${timeLabel} · ${relLabel}`;
      card.appendChild(chip);
      card.appendChild(title);
      card.appendChild(dateLine);
      upcomingList.appendChild(card);
    });
  }

  function selectDate(dateString, openForm = false) {
    selectedDate = dateString;
    const target = parseDateString(dateString);
    currentMonth = new Date(target.getFullYear(), target.getMonth(), 1);
    currentWeekStart = weekStart(target);
    formDateInput.value = dateString;
    if (modalDateLabel) modalDateLabel.textContent = formatDisplayDate(target);
    renderCalendar();
    renderSelectedDay();
    if (openForm) {
      resetForm();
      openModal();
    }
  }

  function shiftMonth(delta) {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1);
    currentMonth = next;
    renderCalendar();
  }

  function shiftWeek(deltaWeeks) {
    const next = new Date(currentWeekStart);
    next.setDate(currentWeekStart.getDate() + deltaWeeks * 7);
    currentWeekStart = weekStart(next);
    selectDate(formatDate(currentWeekStart));
  }

  function openModal() {
    if (!calendarModal) return;
    calendarModal.classList.add("is-open");
    calendarModal.setAttribute("aria-hidden", "false");
    formTitleInput?.focus();
  }

  function closeModal() {
    if (!calendarModal || !calendarModal.classList.contains("is-open")) return;
    calendarModal.classList.remove("is-open");
    calendarModal.setAttribute("aria-hidden", "true");
    resetForm();
  }

  function toggleDone(id, done) {
    const idx = events.findIndex((evt) => evt.id === id);
    if (idx === -1) return;
    events[idx].done = done;
    saveEvents();
    renderSelectedDay();
    renderCalendar();
    renderUpcoming();
  }

  function deleteEvent(id) {
    const idx = events.findIndex((evt) => evt.id === id);
    if (idx === -1) return;
    if (!confirm("Remove this item from the calendar?")) return;
    events.splice(idx, 1);
    saveEvents();
    if (editingId === id) resetForm();
    renderSelectedDay();
    renderCalendar();
    renderUpcoming();
    setStatus("Removed.", "muted");
  }

  function startEditing(id) {
    const evt = events.find((item) => item.id === id);
    if (!evt) return;
    editingId = id;
    formTitleInput.value = evt.title;
    formDateInput.value = evt.date;
    formTimeInput.value = evt.time || "";
    formTypeSelect.value = evt.type || "deadline";
    formPrioritySelect.value = evt.priority || "normal";
    formNotesInput.value = evt.notes || "";
    formSubmitBtn.textContent = "Save changes";
    setStatus("Editing existing entry.", "muted");
    selectDate(evt.date);
    openModal();
    formTitleInput.focus();
  }

  function resetForm() {
    editingId = null;
    eventForm.reset();
    formDateInput.value = selectedDate;
    formTypeSelect.value = "deadline";
    formPrioritySelect.value = "normal";
    formSubmitBtn.textContent = "Add to calendar";
    if (modalDateLabel) modalDateLabel.textContent = formatDisplayDate(parseDateString(selectedDate));
    setStatus("", "muted");
  }

  function setStatus(message, tone = "muted") {
    formStatus.textContent = message;
    formStatus.dataset.tone = tone;
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const title = formTitleInput.value.trim();
    const date = formDateInput.value || selectedDate;
    if (!title || !date) {
      setStatus("Title and date are required.", "error");
      return;
    }
    const payload = {
      id: editingId || (crypto.randomUUID ? crypto.randomUUID() : `evt-${Date.now()}`),
      title,
      date,
      time: formTimeInput.value,
      type: formTypeSelect.value || "deadline",
      priority: formPrioritySelect.value || "normal",
      notes: formNotesInput.value.trim(),
      done: editingId ? events.find((evt) => evt.id === editingId)?.done || false : false
    };

    if (editingId) {
      const idx = events.findIndex((evt) => evt.id === editingId);
      if (idx !== -1) {
        events[idx] = payload;
      }
    } else {
      events.push(payload);
    }

    saveEvents();
    selectDate(date);
    renderUpcoming();
    closeModal();
  }

  // Event bindings
  prevMonthBtn?.addEventListener("click", () => (isPhoneLayout() ? shiftWeek(-1) : shiftMonth(-1)));
  nextMonthBtn?.addEventListener("click", () => (isPhoneLayout() ? shiftWeek(1) : shiftMonth(1)));
  todayMonthBtn?.addEventListener("click", () => {
    const now = new Date();
    currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    currentWeekStart = weekStart(now);
    selectDate(formatDate(now));
  });
  newDeadlineTodayBtn?.addEventListener("click", () => {
    const now = formatDate(new Date());
    selectDate(now, true);
    formTitleInput.focus();
  });
  formDateInput?.addEventListener("change", (e) => {
    if (e.target.value) selectDate(e.target.value);
  });
  eventForm?.addEventListener("submit", handleFormSubmit);
  cancelEditBtn?.addEventListener("click", closeModal);
  closeModalBtn?.addEventListener("click", closeModal);
  calendarModalBackdrop?.addEventListener("click", closeModal);
  openSelectedFormBtn?.addEventListener("click", () => {
    resetForm();
    openModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  window.addEventListener("study:state-replaced", () => {
    events = loadEvents();
    renderCalendar();
    renderSelectedDay();
    renderUpcoming();
  });

  renderCalendar();
  renderSelectedDay();
  renderUpcoming();
  resetForm();
})();
