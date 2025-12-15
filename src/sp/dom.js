(() => {
  const StudyPlanner = (window.StudyPlanner = window.StudyPlanner || {});

  function clear(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function text(value) {
    return document.createTextNode(value == null ? "" : String(value));
  }

  function el(tag, attrs = null, children = null) {
    const node = document.createElement(tag);
    if (attrs && typeof attrs === "object") {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null) continue;
        if (k === "class") node.className = String(v);
        else if (k === "dataset" && v && typeof v === "object") {
          for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = String(dv);
        } else if (k === "style" && v && typeof v === "object") {
          for (const [sk, sv] of Object.entries(v)) node.style.setProperty(sk, String(sv));
        } else if (k.startsWith("aria-")) node.setAttribute(k, String(v));
        else if (k === "text") node.textContent = String(v);
        else node.setAttribute(k, String(v));
      }
    }
    const list = Array.isArray(children) ? children : children != null ? [children] : [];
    for (const child of list) {
      if (child == null) continue;
      node.appendChild(typeof child === "string" ? text(child) : child);
    }
    return node;
  }

  function escapeHtml(value) {
    const s = value == null ? "" : String(value);
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setSafeInnerHTML(el, html) {
    if (!el) return;
    el.innerHTML = html;
  }

  StudyPlanner.DOM = Object.assign(StudyPlanner.DOM || {}, {
    clear,
    el,
    text,
    escapeHtml,
    setSafeInnerHTML
  });
})();

