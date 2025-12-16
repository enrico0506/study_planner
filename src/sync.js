(() => {
  const STATE_PUSH_DEBOUNCE_MS = 1500;
  const SYNC_META_KEY = "sync_cloud_updated_ms_v1";
  const CLOUD_POLL_MS = 15000;
  const SYNC_APPLIED_EVENT = "study:state-replaced";

  const DATA_KEYS = new Set([
    "studySubjects_v1",
    "studyTimetable_v1",
    "studyTodayTodos_v1",
    "studyDailyFocus_v1",
    "studyCalendarEvents_v1",
    "studyFlashcards_v1",
    "studyAssignments",
    "studyAssignmentsSettings",
    "studyNotes_v1",
    "studySessions_v1",
    "studyReviewSettings_v1",
    "studyNotificationSettings_v1",
    "studyNotificationState_v1",
    "studyTimeBudgetSettings_v1",
    "studyExamMode_v1",
    "studyFlashcardImports_v1",
    "studyAutoPlanSettings_v1"
  ]);

  function isSyncedKey(key) {
    return DATA_KEYS.has(String(key));
  }

  function hashString(input, seed) {
    let hash = seed >>> 0;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  function stableHashSnapshot(obj) {
    const keys = Object.keys(obj || {}).sort();
    let hash = 0x811c9dc5;
    for (const key of keys) {
      hash = hashString(key, hash);
      const value = obj[key];
      hash = hashString(value == null ? "" : String(value), hash);
    }
    return `h${hash.toString(16)}`;
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

  function hasAnySyncedState(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return false;
    for (const key of DATA_KEYS) {
      if (!(key in snapshot)) continue;
      if (!isEmptyJsonString(snapshot[key])) return true;
    }
    return false;
  }

  function snapshotLocalState() {
    const out = {};
    for (const key of DATA_KEYS) {
      try {
        const value = localStorage.getItem(key);
        if (value == null) continue;
        out[key] = value;
      } catch {}
    }
    return out;
  }

  function filterSnapshot(snapshot) {
    const source = snapshot && typeof snapshot === "object" ? snapshot : {};
    const out = {};
    for (const key of DATA_KEYS) {
      if (key in source) out[key] = source[key];
    }
    return out;
  }

  function replaceLocalStateFromSnapshot(snapshot) {
    const incoming = filterSnapshot(snapshot);
    const wantedKeys = new Set(Object.keys(incoming).filter((key) => isSyncedKey(key)));
    const existingKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && isSyncedKey(key)) existingKeys.push(key);
    }

    for (const key of existingKeys) {
      if (!wantedKeys.has(key)) localStorage.removeItem(key);
    }

    for (const [key, value] of Object.entries(incoming)) {
      if (!isSyncedKey(key)) continue;
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

  let suppressPush = false;
  function applyCloudSnapshot(snapshot, cloudUpdatedMs) {
    const filtered = filterSnapshot(snapshot);
    const signature = stableHashSnapshot(filtered);
    suppressPush = true;
    try {
      replaceLocalStateFromSnapshot(filtered);
    } finally {
      suppressPush = false;
    }
    lastPushedSignature = signature;
    localStorage.setItem(SYNC_META_KEY, String(Number(cloudUpdatedMs) || Date.now()));

    try {
      window.dispatchEvent(
        new CustomEvent(SYNC_APPLIED_EVENT, {
          detail: { source: "cloud", updatedAtMs: cloudUpdatedMs || Date.now() }
        })
      );
    } catch {}
  }

  async function syncNowAuto() {
    const me = await getMe();
    if (!me) return;

    const local = snapshotLocalState();
    const cloud = await pullCloudState();
    const cloudData = filterSnapshot((cloud && cloud.data) || {});
    const localHasData = hasAnySyncedState(local) || hasPlannerData(local);
    const cloudHasData = hasAnySyncedState(cloudData) || hasPlannerData(cloudData);

    const cloudUpdatedMs = cloud?.updatedAt ? Date.parse(cloud.updatedAt) : 0;
    const lastSeenCloudMs = Number(localStorage.getItem(SYNC_META_KEY) || 0) || 0;

    // First time on this device: choose the non-empty side (last-writer-wins for later conflicts).
    if (!lastSeenCloudMs) {
      if (cloudHasData) {
        applyCloudSnapshot(cloudData, cloudUpdatedMs || Date.now());
        return;
      }
      if (localHasData) {
        await pushCloudState(local);
        lastPushedSignature = stableHashSnapshot(local);
        localStorage.setItem(SYNC_META_KEY, String(Date.now()));
        return;
      }
      return;
    }

    if (cloudHasData && !localHasData) {
      applyCloudSnapshot(cloudData, cloudUpdatedMs);
      return;
    }

    if (!cloudHasData && localHasData) {
      await pushCloudState(local);
      lastPushedSignature = stableHashSnapshot(local);
      localStorage.setItem(SYNC_META_KEY, String(Date.now()));
      return;
    }

    const localSig = stableHashSnapshot(local);
    const cloudSig = stableHashSnapshot(cloudData);
    if (cloudSig === localSig) {
      if (cloudUpdatedMs) localStorage.setItem(SYNC_META_KEY, String(cloudUpdatedMs));
      return;
    }

    // If cloud changed since we last saw it, prefer cloud for data (keep local prefs).
    if (cloudUpdatedMs && cloudUpdatedMs > lastSeenCloudMs) {
      applyCloudSnapshot(cloudData, cloudUpdatedMs);
      return;
    }

    // Otherwise, push local snapshot (last-writer-wins). This avoids wiping cloud when local only has prefs.
    await pushCloudState(local);
    lastPushedSignature = localSig;
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

    const cloudData = filterSnapshot((cloud && cloud.data) || {});
    applyCloudSnapshot(cloudData, cloudUpdatedMs);
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
    const lastSeenCloudMs = Number(localStorage.getItem(SYNC_META_KEY) || 0) || 0;
    if (!lastSeenCloudMs) return;

    const snapshot = snapshotLocalState();
    const signature = stableHashSnapshot(snapshot);
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
      if (!suppressPush && isSyncedKey(key)) schedulePush();
    };

    localStorage.removeItem = (key) => {
      originalRemoveItem(key);
      if (!suppressPush && isSyncedKey(key)) schedulePush();
    };

    localStorage.clear = () => {
      originalClear();
      if (!suppressPush) schedulePush();
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
    lastPushedSignature = stableHashSnapshot(snapshotLocalState());
    startPolling();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
