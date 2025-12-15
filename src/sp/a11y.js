(() => {
  const StudyPlanner = (window.StudyPlanner = window.StudyPlanner || {});

  function prefersReducedMotion() {
    try {
      return !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  function focusFirst(container) {
    const root = container || document;
    const focusable = root.querySelector(
      [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])"
      ].join(",")
    );
    focusable?.focus?.();
  }

  function trapFocus(modalEl, { initialFocusEl = null } = {}) {
    if (!modalEl) return () => {};
    const handle = (event) => {
      if (event.key !== "Tab") return;
      const focusables = Array.from(
        modalEl.querySelectorAll(
          [
            "a[href]",
            "button:not([disabled])",
            "input:not([disabled])",
            "select:not([disabled])",
            "textarea:not([disabled])",
            "[tabindex]:not([tabindex='-1'])"
          ].join(",")
        )
      ).filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !modalEl.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    modalEl.addEventListener("keydown", handle);
    const focusTarget = initialFocusEl || modalEl;
    setTimeout(() => focusFirst(focusTarget), 0);
    return () => modalEl.removeEventListener("keydown", handle);
  }

  StudyPlanner.A11y = Object.assign(StudyPlanner.A11y || {}, {
    prefersReducedMotion,
    trapFocus,
    focusFirst
  });
})();

