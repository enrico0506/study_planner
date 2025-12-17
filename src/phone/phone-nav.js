(() => {
  const nav = document.querySelector(".phone-bottom-nav");
  if (!nav) return;

  const media = window.matchMedia("(max-width: 768px)");
  function isPhone() {
    return media.matches;
  }

  function updateBodyPadding() {
    if (!document.body) return;
    document.body.classList.toggle("phone-has-bottom-nav", isPhone());
  }

  media.addEventListener("change", updateBodyPadding);
  updateBodyPadding();

  function currentMode() {
    return document.body?.dataset?.mode || "board";
  }

  function setActiveNav() {
    const mode = currentMode();
    nav.querySelectorAll(".phone-bottom-nav__btn").forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-current", active ? "page" : "false");
    });
  }

  setActiveNav();

  const observer = new MutationObserver(() => setActiveNav());
  observer.observe(document.body, { attributes: true, attributeFilter: ["data-mode"] });

  function navigateToMode(mode) {
    if (!mode) return;
    if (typeof setPageMode === "function") {
      setPageMode(mode);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    window.location.href = url.toString();
  }

  nav.addEventListener("click", (event) => {
    const btn = event.target.closest(".phone-bottom-nav__btn");
    if (!btn) return;
    navigateToMode(btn.dataset.mode);
  });

  // Today picker toggle helpers
  const todayAddBtn = document.getElementById("todayPickToggleBtn");
  const todayBackBtn = document.getElementById("todayPickerBackBtn");

  function setTodayPicker(open) {
    const shouldOpen = !!open;
    document.body.classList.toggle("today-picker-open", shouldOpen);
    if (todayAddBtn) todayAddBtn.textContent = shouldOpen ? "Back to Today" : "Add from subjects";
    if (todayBackBtn) todayBackBtn.hidden = !shouldOpen;
    if (typeof renderTable === "function") renderTable();
    const target = shouldOpen
      ? document.querySelector("#layoutRow .main-area")
      : document.querySelector("#layoutRow .today-sidebar");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  todayAddBtn?.addEventListener("click", () => {
    const open = !document.body.classList.contains("today-picker-open");
    setTodayPicker(open);
  });

  todayBackBtn?.addEventListener("click", () => {
    setTodayPicker(false);
  });
})();
