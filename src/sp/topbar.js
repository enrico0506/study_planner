(() => {
  const StudyPlanner = (window.StudyPlanner = window.StudyPlanner || {});
  const DOM = StudyPlanner.DOM;

  function pageId() {
    const path = (location.pathname || "").toLowerCase();
    const file = path.split("/").pop() || "index.html";
    if (file.includes("calendar")) return "calendar";
    if (file.includes("stundenplan")) return "timetable";
    if (file.includes("karteikarten")) return "flashcards";
    if (file.includes("account")) return "account";
    return "home";
  }

  const LINKS = [
    { id: "home", href: "./index.html", label: "Board" },
    { id: "calendar", href: "./calendar.html", label: "Calendar" },
    { id: "timetable", href: "./stundenplan.html", label: "Timetable" },
    { id: "flashcards", href: "./karteikarten.html", label: "Flashcards" },
    { id: "account", href: "./account.html", label: "Account" }
  ];

  function mount() {
    if (!DOM) return;
    if (document.querySelector(".sp-topbar")) return;

    const current = pageId();
    const shell =
      document.querySelector(".app") ||
      document.querySelector(".calendar-shell") ||
      document.querySelector(".timetable-shell") ||
      document.querySelector(".flashcards-shell") ||
      document.querySelector(".account-page") ||
      document.body;

    const skip = DOM.el("a", { class: "sp-skip-link", href: "#spMain" }, "Skip to content");
    const nav = DOM.el("nav", { class: "sp-topbar", "aria-label": "Primary navigation" }, [
      DOM.el("div", { class: "sp-topbar-brand" }, [
        DOM.el("a", { class: "sp-brand-link", href: "./index.html" }, [
          DOM.el("span", { class: "sp-brand-mark", "aria-hidden": "true" }, "SP"),
          DOM.el("span", { class: "sp-brand-text" }, "Study Planner")
        ])
      ]),
      DOM.el(
        "div",
        { class: "sp-topbar-links" },
        LINKS.map((l) =>
          DOM.el(
            "a",
            {
              class: `sp-topbar-link${l.id === current ? " is-active" : ""}`,
              href: l.href,
              "aria-current": l.id === current ? "page" : null
            },
            l.label
          )
        )
      ),
      DOM.el("div", { class: "sp-topbar-actions" }, [
        DOM.el(
          "button",
          { class: "sp-topbar-btn", type: "button", id: "spOpenSearchBtn", "aria-label": "Open global search" },
          "Search"
        ),
        DOM.el(
          "button",
          { class: "sp-topbar-btn sp-topbar-btn-primary", type: "button", id: "spOpenDataBtn", "aria-label": "Open import and export" },
          "Data"
        )
      ])
    ]);

    shell.insertBefore(skip, shell.firstChild);
    shell.insertBefore(nav, skip.nextSibling);

    const btnSearch = document.getElementById("spOpenSearchBtn");
    const btnData = document.getElementById("spOpenDataBtn");
    btnSearch?.addEventListener("click", () => StudyPlanner.Modals?.open?.("search"));
    btnData?.addEventListener("click", () => StudyPlanner.Modals?.open?.("data"));
  }

  StudyPlanner.Topbar = Object.assign(StudyPlanner.Topbar || {}, { mount });
})();

