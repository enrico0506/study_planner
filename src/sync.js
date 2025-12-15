(() => {
  const STORAGE_PREFIX = "study";
  const STATE_PUSH_DEBOUNCE_MS = 1500;
  const SYNC_META_KEY = "sync_cloud_updated_ms_v1";
  const CLOUD_POLL_MS = 15000;

  const DATA_KEYS = new Set([
    "studySubjects_v1",
    "studyTimetable_v1",
    "studyTodayTodos_v1",
    "studyDailyFocus_v1",
    "studyCalendarEvents_v1",
    "studyFlashcards_v1"
  ]);

  const PREF_KEYS = new Set([
    "studyTheme_v1",
    "studyLanguage_v1",
    "studyStylePrefs_v1",
    "studyConfidenceMode_v1",
    "studyFocusConfig_v1",
    "studyColorPalette_v1"
  ]);

  function stableStringifyObject(obj) {
    const keys = Object.keys(obj).sort();
    const entries = keys.map((key) => [key, obj[key]]);
    return JSON.stringify(Object.fromEntries(entries));
  }

  function isEmptyJsonString(value) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return true;
    if (trimmed === "[]" || trimmed === "{}") return true;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.length === 0;
      if (parsed && typeof parsed === "object") return Object.keys(parsed).length === 0;
    } catch {
      return false;
    }
    return false;
  }

  function hasPlannerData(snapshot) {
    for (const key of DATA_KEYS) {
      if (!(key in snapshot)) continue;
      if (!isEmptyJsonString(snapshot[key])) return true;
    }
    return false;
  }

  function mergeCloudWithLocalPrefs(cloudData, localSnapshot) {
    const merged = { ...(cloudData || {}) };
    for (const key of PREF_KEYS) {
      if (key in localSnapshot) merged[key] = localSnapshot[key];
    }
    return merged;
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
    const cloud = await pullCloudState();
    const cloudData = (cloud && cloud.data) || {};
    const localHasData = hasPlannerData(local);
    const cloudHasData = hasPlannerData(cloudData);

    const cloudUpdatedMs = cloud?.updatedAt ? Date.parse(cloud.updatedAt) : 0;
    const lastSeenCloudMs = Number(localStorage.getItem(SYNC_META_KEY) || 0) || 0;

    if (cloudHasData && !localHasData) {
      const applied = mergeCloudWithLocalPrefs(cloudData, local);
      replaceLocalStateFromSnapshot(applied);
      if (cloudUpdatedMs) localStorage.setItem(SYNC_META_KEY, String(cloudUpdatedMs));
      location.reload();
      return;
    }

    if (!cloudHasData && localHasData) {
      await pushCloudState(local);
      localStorage.setItem(SYNC_META_KEY, String(Date.now()));
      return;
    }

    const localStr = stableStringifyObject(local);
    const cloudStr = stableStringifyObject(cloudData);
    if (cloudStr === localStr) {
      if (cloudUpdatedMs) localStorage.setItem(SYNC_META_KEY, String(cloudUpdatedMs));
      return;
    }

    // If cloud changed since we last saw it, prefer cloud for data (keep local prefs).
    if (cloudUpdatedMs && cloudUpdatedMs > lastSeenCloudMs) {
      const applied = mergeCloudWithLocalPrefs(cloudData, local);
      replaceLocalStateFromSnapshot(applied);
      localStorage.setItem(SYNC_META_KEY, String(cloudUpdatedMs));
      location.reload();
      return;
    }

    // Otherwise, push local snapshot (last-writer-wins). This avoids wiping cloud when local only has prefs.
    await pushCloudState(local);
    localStorage.setItem(SYNC_META_KEY, String(Date.now()));
  }

  let lastPushedSignature = null;
  let pushTimer = null;
  let lastLocalMutationMs = 0;
  let pollTimer = null;

  async function pollCloudAndApplyIfNewer() {
    const me = await getMe();
    if (!me) return;
    if (Date.now() - lastLocalMutationMs < 5000) return;

    const lastSeenCloudMs = Number(localStorage.getItem(SYNC_META_KEY) || 0) || 0;
    let cloud;
    try {
      cloud = await pullCloudState();
    } catch {
      return;
    }

    const cloudUpdatedMs = cloud?.updatedAt ? Date.parse(cloud.updatedAt) : 0;
    if (!cloudUpdatedMs || cloudUpdatedMs <= lastSeenCloudMs) return;

    const cloudData = (cloud && cloud.data) || {};
    const local = snapshotLocalState();

    const applied = mergeCloudWithLocalPrefs(cloudData, local);
    replaceLocalStateFromSnapshot(applied);
    localStorage.setItem(SYNC_META_KEY, String(cloudUpdatedMs));
    location.reload();
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      pollCloudAndApplyIfNewer().catch(() => {});
    }, CLOUD_POLL_MS);
  }

  async function pushIfChanged() {
    const me = await getMe();
    if (!me) return;

    const snapshot = snapshotLocalState();
    const signature = stableStringifyObject(snapshot);
    if (signature === lastPushedSignature) return;

    await pushCloudState(snapshot);
    lastPushedSignature = signature;
    localStorage.setItem(SYNC_META_KEY, String(Date.now()));
  }

  function schedulePush() {
    if (pushTimer) clearTimeout(pushTimer);
    lastLocalMutationMs = Date.now();
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
    startPolling();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
