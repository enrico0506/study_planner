(() => {
  const menus = Array.from(document.querySelectorAll(".header-menu"));
  if (!menus.length) return;

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
})();

