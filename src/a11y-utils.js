// Basic accessibility helpers: focus trap, focus restore, aria toggles, live announcements.
(function (global) {
  const doc = global.document;

  function qs(sel) {
    return doc.querySelector(sel);
  }

  function trapFocus(container) {
    if (!container) return () => {};
    const focusableSelectors = [
      'a[href]',
      'area[href]',
      'input:not([disabled]):not([tabindex="-1"])',
      'select:not([disabled]):not([tabindex="-1"])',
      'textarea:not([disabled]):not([tabindex="-1"])',
      'button:not([disabled]):not([tabindex="-1"])',
      'iframe',
      'object',
      'embed',
      '[contenteditable]',
      '[tabindex]:not([tabindex="-1"])'
    ];
    const getFocusable = () =>
      Array.from(container.querySelectorAll(focusableSelectors.join(','))).filter(
        (el) => el.offsetWidth || el.offsetHeight || el.getClientRects().length
      );

    function handleKey(event) {
      if (event.key !== 'Tab') return;
      const items = getFocusable();
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = doc.activeElement;
      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    container.addEventListener('keydown', handleKey);
    return () => container.removeEventListener('keydown', handleKey);
  }

  function withFocusRestore(openFn, closeFn) {
    let lastActive = null;
    return {
      open() {
        lastActive = doc.activeElement;
        if (typeof openFn === 'function') openFn();
      },
      close() {
        if (typeof closeFn === 'function') closeFn();
        if (lastActive && typeof lastActive.focus === 'function') {
          try {
            lastActive.focus();
          } catch (e) {}
        }
        lastActive = null;
      }
    };
  }

  function attachEscClose(container, onClose) {
    if (!container || typeof onClose !== 'function') return () => {};
    function handler(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }
    container.addEventListener('keydown', handler);
    return () => container.removeEventListener('keydown', handler);
  }

  function toggleAriaExpanded(trigger, expanded) {
    if (!trigger) return;
    trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function ensureSrOnlyClass() {
    if (qs('.sr-only')) return;
    const style = doc.createElement('style');
    style.textContent =
      '.sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important;}';
    doc.head.appendChild(style);
  }

  const liveId = 'studyAriaLiveGlobal';
  function getLiveRegion() {
    let el = doc.getElementById(liveId);
    if (!el) {
      el = doc.createElement('div');
      el.id = liveId;
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-atomic', 'true');
      el.className = 'sr-only';
      doc.body.appendChild(el);
    }
    return el;
  }

  function announce(message) {
    if (!message) return;
    ensureSrOnlyClass();
    const el = getLiveRegion();
    el.textContent = '';
    requestAnimationFrame(() => {
      el.textContent = String(message);
    });
  }

  function withModalA11y(backdrop, onClose, focusTarget) {
    if (!backdrop) return { open: () => {}, close: () => {} };
    let detachTrap = null;
    let detachEsc = null;
    let focusRestore = null;

    const api = withFocusRestore(
      () => {
        backdrop.style.display = 'flex';
        backdrop.hidden = false;
        detachTrap = trapFocus(backdrop);
        detachEsc = attachEscClose(backdrop, onClose);
        const target = focusTarget && typeof focusTarget === 'function' ? focusTarget() : focusTarget;
        if (target && typeof target.focus === 'function') target.focus();
      },
      () => {
        backdrop.style.display = 'none';
        backdrop.hidden = true;
        if (detachTrap) detachTrap();
        if (detachEsc) detachEsc();
      }
    );

    function open() {
      focusRestore.open();
    }
    function close() {
      focusRestore.close();
    }

    focusRestore = { open: api.open, close: api.close };
    return { open, close };
  }

  global.StudyA11y = {
    trapFocus,
    withFocusRestore,
    attachEscClose,
    toggleAriaExpanded,
    ensureSrOnlyClass,
    announce,
    withModalA11y
  };
})(window);
