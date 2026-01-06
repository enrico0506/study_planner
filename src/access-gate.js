(() => {
  const CHECKING_CLASS = "sp-access-gate-checking";
  const BLOCKED_CLASS = "sp-access-gate-blocked";
  const STYLE_ID = "spAccessGateStyle";
  const OVERLAY_ID = "spAccessGate";

  function shouldBypass() {
    try {
      if (window.location.protocol === "file:") return true;
      const host = String(window.location.hostname || "").toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return true;
    } catch {}
    return false;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html.${CHECKING_CLASS} body { visibility: hidden !important; }
      html.${BLOCKED_CLASS} { overflow: hidden; }
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(2, 6, 23, 0.86);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
      }
      #${OVERLAY_ID} .sp-gate-card {
        width: min(520px, 92vw);
        border-radius: 18px;
        background: rgba(15, 23, 42, 0.96);
        border: 1px solid rgba(255, 255, 255, 0.14);
        box-shadow: 0 30px 80px rgba(0,0,0,0.5);
        color: rgba(255, 255, 255, 0.96);
        padding: 18px 18px 16px;
      }
      #${OVERLAY_ID} .sp-gate-title {
        margin: 0 0 6px;
        font-size: 18px;
        letter-spacing: 0.2px;
      }
      #${OVERLAY_ID} .sp-gate-text {
        margin: 0;
        font-size: 14px;
        line-height: 1.5;
        opacity: 0.9;
      }
      #${OVERLAY_ID} .sp-gate-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 14px;
        align-items: center;
      }
      #${OVERLAY_ID} .sp-gate-btn {
        appearance: none;
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: rgba(255, 255, 255, 0.10);
        color: inherit;
        border-radius: 12px;
        padding: 10px 12px;
        font-weight: 600;
        cursor: pointer;
      }
      #${OVERLAY_ID} .sp-gate-btn-primary {
        border-color: rgba(47, 98, 244, 0.55);
        background: rgba(47, 98, 244, 0.24);
      }
      #${OVERLAY_ID} .sp-gate-btn:hover {
        filter: brightness(1.06);
      }
      #${OVERLAY_ID} .sp-gate-link {
        color: rgba(255, 255, 255, 0.92);
        text-decoration: underline;
        text-underline-offset: 3px;
        font-size: 13px;
        opacity: 0.9;
      }
    `;
    document.head.appendChild(style);
  }

  function setChecking(value) {
    try {
      document.documentElement.classList.toggle(CHECKING_CLASS, value);
    } catch {}
  }

  function setBlocked(value) {
    try {
      document.documentElement.classList.toggle(BLOCKED_CLASS, value);
    } catch {}
  }

  function hasAdsenseScriptTag() {
    try {
      return !!document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]');
    } catch {
      return false;
    }
  }

  function detectByBaitElement() {
    const bait = document.createElement("div");
    bait.className = "adsbox ad-banner ad-unit ad-zone";
    bait.setAttribute("aria-hidden", "true");
    bait.style.position = "absolute";
    bait.style.left = "-9999px";
    bait.style.top = "-9999px";
    bait.style.width = "10px";
    bait.style.height = "10px";
    bait.style.pointerEvents = "none";

    document.body.appendChild(bait);

    const style = window.getComputedStyle(bait);
    const blocked =
      !bait.offsetParent ||
      bait.offsetHeight === 0 ||
      bait.clientHeight === 0 ||
      style.display === "none" ||
      style.visibility === "hidden";

    bait.remove();
    return blocked;
  }

  function detectByAdsenseGlobal() {
    try {
      return typeof window.adsbygoogle === "undefined";
    } catch {
      return false;
    }
  }

  function showOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <div class="sp-gate-card" role="dialog" aria-modal="true" aria-labelledby="spGateTitle">
        <h1 class="sp-gate-title" id="spGateTitle">Ad blocker detected</h1>
        <p class="sp-gate-text">
          Study Planner is funded by ads. Please disable your ad blocker (or allowlist this site) to continue.
        </p>
        <div class="sp-gate-actions">
          <button class="sp-gate-btn sp-gate-btn-primary" type="button" id="spGateRetryBtn">I disabled it — Retry</button>
          <a class="sp-gate-link" href="./privacy.html">Why am I seeing this?</a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const retry = document.getElementById("spGateRetryBtn");
    retry?.addEventListener("click", () => window.location.reload());
  }

  function runDetection() {
    if (!document.body) return false;

    const baitBlocked = detectByBaitElement();
    if (baitBlocked) return true;

    // Fallback: some blockers don’t hide bait elements, but block ad network scripts.
    if (hasAdsenseScriptTag()) {
      return detectByAdsenseGlobal();
    }

    return false;
  }

  function block() {
    setChecking(false);
    setBlocked(true);
    showOverlay();
  }

  function allow() {
    setBlocked(false);
    setChecking(false);
  }

  function whenBodyReady(cb) {
    if (document.body) return cb();
    const observer = new MutationObserver(() => {
      if (!document.body) return;
      observer.disconnect();
      cb();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function start() {
    if (shouldBypass()) return;
    injectStyles();
    setChecking(true);

    whenBodyReady(() => {
      // Make the decision quickly to avoid a long blank screen.
      window.requestAnimationFrame(() => {
        let blocked = false;
        try {
          blocked = runDetection();
        } catch {
          blocked = false;
        }

        if (blocked) {
          block();
          return;
        }

        allow();

        // Secondary check (delayed) for script-blocking-only ad blockers.
        if (!navigator.onLine || !hasAdsenseScriptTag()) return;
        window.setTimeout(() => {
          try {
            if (detectByAdsenseGlobal()) block();
          } catch {}
        }, 2500);
      });
    });

    // Safety net: never keep the page hidden forever.
    window.setTimeout(() => {
      if (document.documentElement.classList.contains(CHECKING_CLASS)) allow();
    }, 3500);
  }

  start();
})();

