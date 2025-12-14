(() => {
  const STORAGE_PREFIX = "study";
  const STATE_PUSH_DEBOUNCE_MS = 1500;

  function stableStringifyObject(obj) {
    const keys = Object.keys(obj).sort();
    const entries = keys.map((key) => [key, obj[key]]);
    return JSON.stringify(Object.fromEntries(entries));
  }

  function snapshotLocalState() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      out[key] = localStorage.getItem(key);
    }
    return out;
  }

  function replaceLocalStateFromSnapshot(snapshot) {
    const wantedKeys = new Set(Object.keys(snapshot));
    const existingKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) existingKeys.push(key);
    }

    for (const key of existingKeys) {
      if (!wantedKeys.has(key)) localStorage.removeItem(key);
    }

    for (const [key, value] of Object.entries(snapshot)) {
      if (typeof value === "string" || value === null) {
        localStorage.setItem(key, value ?? "");
      } else {
        localStorage.setItem(key, String(value));
      }
    }
  }

  async function apiFetch(path, options = {}) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
    if (!res.ok) {
      const message =
        (body && typeof body === "object" && body.error) ||
        (typeof body === "string" && body) ||
        `HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async function getMe() {
    try {
      return await apiFetch("/api/me");
    } catch {
      return null;
    }
  }

  async function pullCloudState() {
    return apiFetch("/api/state");
  }

  async function pushCloudState(data) {
    return apiFetch("/api/state", { method: "PUT", body: JSON.stringify({ data }) });
  }

  async function syncNowAuto() {
    const me = await getMe();
    if (!me) return;

    const local = snapshotLocalState();
    const localStr = stableStringifyObject(local);

    const cloud = await pullCloudState();
    const cloudData = (cloud && cloud.data) || {};
    const cloudStr = stableStringifyObject(cloudData);

    const localEmpty = Object.keys(local).length === 0;
    const cloudEmpty = Object.keys(cloudData).length === 0;

    if (!cloudEmpty && localEmpty) {
      replaceLocalStateFromSnapshot(cloudData);
      location.reload();
      return;
    }

    if (cloudEmpty && !localEmpty) {
      await pushCloudState(local);
      return;
    }

    if (cloudStr === localStr) return;

    // Default conflict policy: merge with local taking priority.
    const merged = { ...cloudData, ...local };
    await pushCloudState(merged);
    replaceLocalStateFromSnapshot(merged);
    location.reload();
  }

  let lastPushedSignature = null;
  let pushTimer = null;
  async function pushIfChanged() {
    const me = await getMe();
    if (!me) return;

    const snapshot = snapshotLocalState();
    const signature = stableStringifyObject(snapshot);
    if (signature === lastPushedSignature) return;

    await pushCloudState(snapshot);
    lastPushedSignature = signature;
  }

  function schedulePush() {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushIfChanged().catch(() => {});
    }, STATE_PUSH_DEBOUNCE_MS);
  }

  function patchLocalStorage() {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);
    const originalClear = localStorage.clear.bind(localStorage);

    localStorage.setItem = (key, value) => {
      originalSetItem(key, value);
      if (String(key).startsWith(STORAGE_PREFIX)) schedulePush();
    };

    localStorage.removeItem = (key) => {
      originalRemoveItem(key);
      if (String(key).startsWith(STORAGE_PREFIX)) schedulePush();
    };

    localStorage.clear = () => {
      originalClear();
      schedulePush();
    };
  }

  async function init() {
    patchLocalStorage();

    const me = await getMe();
    if (!me) {
      return;
    }

    try {
      await syncNowAuto();
    } catch {}
    schedulePush();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
