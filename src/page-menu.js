(() => {
  const menus = Array.from(document.querySelectorAll(".header-menu"));
  if (!menus.length) return;

  function normalizePath(pathname) {
    const p = String(pathname || "").toLowerCase();
    const file = p.split("/").pop() || "";
    return file || "index.html";
  }

  function markActiveLinks() {
    const current = normalizePath(window.location && window.location.pathname);
    const allLinks = document.querySelectorAll("a.header-menu-link");
    allLinks.forEach((a) => {
      const href = a.getAttribute("href") || "";
      const hrefFile = normalizePath(href.split("?")[0]);
      const isActive =
        (current === "index.html" && (hrefFile === "index.html" || hrefFile === "")) ||
        (current !== "index.html" && hrefFile === current);
      a.classList.toggle("header-menu-link-active", isActive);
      if (isActive) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function closeAll(except = null) {
    menus.forEach((menu) => {
      if (except && menu === except) return;
      menu.classList.remove("header-menu-open");
      const toggle = menu.querySelector(".header-menu-toggle");
      toggle?.setAttribute("aria-expanded", "false");
    });
  }

  menus.forEach((menu) => {
    const toggle = menu.querySelector(".header-menu-toggle");
    const panel = menu.querySelector(".header-menu-panel");
    if (!toggle || !panel) return;

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = menu.classList.contains("header-menu-open");
      closeAll();
      if (!isOpen) {
        menu.classList.add("header-menu-open");
        toggle.setAttribute("aria-expanded", "true");
      }
    });

    menu.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      closeAll();
      toggle.focus();
    });
  });

  document.addEventListener("click", (event) => {
    const clickedInside = event.target.closest(".header-menu");
    if (clickedInside) return;
    closeAll();
  });

  markActiveLinks();
})();
