(() => {
  const existing = window.StudyPlanner && typeof window.StudyPlanner === "object" ? window.StudyPlanner : {};
  const StudyPlanner = (window.StudyPlanner = existing);

  const FRAME_HTML = `
    <div class="neon-checkbox__box">
      <div class="neon-checkbox__check-container">
        <svg viewBox="0 0 24 24" class="neon-checkbox__check" aria-hidden="true">
          <path d="M3,12.5l7,7L21,5"></path>
        </svg>
      </div>
      <div class="neon-checkbox__glow"></div>
      <div class="neon-checkbox__borders">
        <span></span><span></span><span></span><span></span>
      </div>
    </div>
    <div class="neon-checkbox__effects">
      <div class="neon-checkbox__particles">
        <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
      </div>
      <div class="neon-checkbox__rings">
        <div class="ring"></div>
        <div class="ring"></div>
        <div class="ring"></div>
      </div>
      <div class="neon-checkbox__sparks">
        <span></span><span></span><span></span><span></span>
      </div>
    </div>
  `;

  function createNeonCheckbox({
    id,
    checked = false,
    disabled = false,
    className = "",
    inputClassName = "",
    ariaLabel,
    title,
    stopPropagation = false
  } = {}) {
    const label = document.createElement("label");
    label.className = `neon-checkbox${className ? ` ${className}` : ""}`;
    if (title) label.title = title;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = `neon-checkbox__input${inputClassName ? ` ${inputClassName}` : ""}`;
    if (id) input.id = id;
    input.checked = !!checked;
    input.disabled = !!disabled;
    if (ariaLabel) input.setAttribute("aria-label", String(ariaLabel));

    const frame = document.createElement("div");
    frame.className = "neon-checkbox__frame";
    frame.innerHTML = FRAME_HTML;

    label.appendChild(input);
    label.appendChild(frame);

    if (stopPropagation) {
      label.addEventListener("click", (event) => event.stopPropagation());
    }

    return { label, input, frame };
  }

  StudyPlanner.UI = Object.assign(StudyPlanner.UI || {}, { createNeonCheckbox });
})();

