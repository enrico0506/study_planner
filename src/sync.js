(() => {
  const STORAGE_PREFIX = "study";
  const UI_ID = "accountWidgetRoot";
  const STATE_PUSH_DEBOUNCE_MS = 1500;

  function $(selector) {
    return document.querySelector(selector);
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

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

  function ensureWidget() {
    if (document.getElementById(UI_ID)) return;

    const root = document.createElement("div");
    root.id = UI_ID;
    root.className = "account-widget";
    root.innerHTML = `
      <div class="account-widget__row">
        <div class="account-widget__title">Account</div>
        <div class="account-widget__status" id="accountWidgetStatus">…</div>
      </div>
      <div class="account-widget__body" id="accountWidgetBody"></div>
    `;
    document.body.appendChild(root);
  }

  function renderLoggedOut(message = "") {
    ensureWidget();
    $("#accountWidgetStatus").textContent = "Signed out";

    const body = $("#accountWidgetBody");
    body.innerHTML = `
      ${message ? `<div class="account-widget__msg">${message}</div>` : ""}
      <div class="account-widget__form">
        <input class="account-widget__input" id="accountEmail" type="email" placeholder="Email" autocomplete="email" />
        <input class="account-widget__input" id="accountPassword" type="password" placeholder="Password (min 8 chars)" autocomplete="current-password" />
        <div class="account-widget__actions">
          <button class="account-widget__btn" id="accountLoginBtn" type="button">Login</button>
          <button class="account-widget__btn account-widget__btn--secondary" id="accountRegisterBtn" type="button">Register</button>
        </div>
      </div>
    `;

    $("#accountLoginBtn").addEventListener("click", async () => {
      const email = normalizeEmail($("#accountEmail").value);
      const password = $("#accountPassword").value;
      try {
        await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
        await afterAuth();
      } catch (err) {
        renderLoggedOut(String(err?.message || "Login failed"));
      }
    });

    $("#accountRegisterBtn").addEventListener("click", async () => {
      const email = normalizeEmail($("#accountEmail").value);
      const password = $("#accountPassword").value;
      try {
        await apiFetch("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        await afterAuth();
      } catch (err) {
        renderLoggedOut(String(err?.message || "Registration failed"));
      }
    });
  }

  function renderLoggedIn(email, message = "") {
    ensureWidget();
    $("#accountWidgetStatus").textContent = email;

    const body = $("#accountWidgetBody");
    body.innerHTML = `
      ${message ? `<div class="account-widget__msg">${message}</div>` : ""}
      <div class="account-widget__actions">
        <button class="account-widget__btn" id="accountSyncBtn" type="button">Sync now</button>
        <button class="account-widget__btn account-widget__btn--secondary" id="accountLogoutBtn" type="button">Logout</button>
      </div>
      <div class="account-widget__conflict" id="accountConflict" hidden></div>
    `;

    $("#accountLogoutBtn").addEventListener("click", async () => {
      try {
        await apiFetch("/api/auth/logout", { method: "POST" });
      } catch {}
      renderLoggedOut("Logged out.");
    });

    $("#accountSyncBtn").addEventListener("click", async () => {
      try {
        await syncNowInteractive();
      } catch (err) {
        renderLoggedIn(email, String(err?.message || "Sync failed"));
      }
    });
  }

  function showConflict(handlers) {
    const container = $("#accountConflict");
    container.hidden = false;
    container.innerHTML = `
      <div class="account-widget__msg">
        Cloud and local data differ. Choose which to keep:
      </div>
      <div class="account-widget__actions">
        <button class="account-widget__btn" id="accountUseCloudBtn" type="button">Use cloud</button>
        <button class="account-widget__btn account-widget__btn--secondary" id="accountUseLocalBtn" type="button">Upload local</button>
      </div>
    `;
    $("#accountUseCloudBtn").addEventListener("click", handlers.useCloud);
    $("#accountUseLocalBtn").addEventListener("click", handlers.useLocal);
  }

  async function syncNowInteractive() {
    const me = await getMe();
    if (!me) throw new Error("Not logged in");

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

    showConflict({
      useCloud: async () => {
        replaceLocalStateFromSnapshot(cloudData);
        location.reload();
      },
      useLocal: async () => {
        await pushCloudState(local);
        $("#accountConflict").hidden = true;
      }
    });
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

  async function afterAuth() {
    const me = await getMe();
    if (!me) return renderLoggedOut("Signed out.");
    renderLoggedIn(me.email, "Signed in. Syncing…");
    try {
      await syncNowInteractive();
    } catch {}
    renderLoggedIn(me.email);
    schedulePush();
  }

  async function init() {
    ensureWidget();
    patchLocalStorage();

    const me = await getMe();
    if (!me) {
      renderLoggedOut();
      return;
    }

    renderLoggedIn(me.email);
    try {
      await syncNowInteractive();
    } catch {}
    schedulePush();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

