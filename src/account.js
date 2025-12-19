(() => {
  const SYNC_META_KEY = "sync_cloud_updated_ms_v1";
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
  const PREF_KEYS = new Set([
    "studyTheme_v1",
    "studyLanguage_v1",
    "studyStylePrefs_v1",
    "studyConfidenceMode_v1",
    "studyFocusConfig_v1",
    "studyColorPalette_v1"
  ]);
  const SYNC_KEYS = new Set([...DATA_KEYS, ...PREF_KEYS]);

  function $(id) {
    return document.getElementById(id);
  }

  const toastStack = $("toastStack");
  let versionsCache = [];
  let pendingRestore = null;
  let isAuthed = false;

  function setButtonLabel(btn, label) {
    if (!btn) return;
    const node = btn.querySelector(".btn-label");
    if (node) node.textContent = label;
    else btn.textContent = label;
  }

  function setButtonLoading(btn, isLoading, label) {
    if (!btn) return;
    if (isLoading) {
      if (!btn.dataset.prevLabel) {
        const current = btn.querySelector(".btn-label")?.textContent || btn.textContent;
        btn.dataset.prevLabel = current;
      }
      btn.classList.add("is-loading");
      btn.disabled = true;
      if (label) setButtonLabel(btn, label);
      return;
    }
    btn.classList.remove("is-loading");
    btn.disabled = false;
    if (btn.dataset.prevLabel) {
      setButtonLabel(btn, btn.dataset.prevLabel);
      delete btn.dataset.prevLabel;
    }
  }

  function showToast(type, message, timeout = 3200) {
    if (!toastStack) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type || "info"}`;
    const text = document.createElement("div");
    text.textContent = message;
    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.textContent = "✕";
    close.addEventListener("click", () => toast.remove());
    toast.appendChild(text);
    toast.appendChild(close);
    toastStack.appendChild(toast);
    if (timeout) {
      window.setTimeout(() => toast.remove(), timeout);
    }
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  async function apiFetch(path, options = {}) {
    let res;
    try {
      res = await fetch(path, {
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options
      });
    } catch (err) {
      if (err && err.name === "AbortError") {
        throw new Error("Request timed out. Please try again.");
      }
      const isFile = window.location && window.location.protocol === "file:";
      const hint = isFile
        ? "You opened this page via file://. Accounts require the Node server. Run `npm start` and open http://localhost:10000/account.html (or use your Render URL)."
        : "Network error. Check that the server is running and reachable.";
      throw new Error(hint);
    }
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

  function snapshotLocalState() {
    const out = {};
    for (const key of SYNC_KEYS) {
      try {
        const val = localStorage.getItem(key);
        if (val == null) continue;
        out[key] = val;
      } catch {}
    }
    return out;
  }

  function filterSnapshot(snapshot) {
    const src = snapshot && typeof snapshot === "object" ? snapshot : {};
    const out = {};
    for (const key of SYNC_KEYS) {
      if (key in src) out[key] = src[key];
    }
    return out;
  }

  function replaceLocalStateFromSnapshot(snapshot) {
    const incoming = snapshot && typeof snapshot === "object" ? snapshot : {};
    const wantedKeys = new Set(Object.keys(incoming).filter((k) => SYNC_KEYS.has(k)));
    const existingKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && SYNC_KEYS.has(key)) existingKeys.push(key);
    }

    for (const key of existingKeys) {
      if (!wantedKeys.has(key)) localStorage.removeItem(key);
    }

    for (const [key, value] of Object.entries(incoming)) {
      if (!SYNC_KEYS.has(key)) continue;
      if (typeof value === "string" || value === null) {
        localStorage.setItem(key, value ?? "");
      } else {
        localStorage.setItem(key, String(value));
      }
    }
  }

  function clearLocalStudyData() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("study")) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
    localStorage.removeItem(SYNC_META_KEY);
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

  function mergeCloudWithLocalPrefs(cloudData, localSnapshot) {
    const merged = { ...(cloudData || {}) };
    for (const key of PREF_KEYS) {
      if (key in localSnapshot) merged[key] = localSnapshot[key];
    }
    return merged;
  }

  function setPill(state, text) {
    const dot = $("authDot");
    const pillText = $("authPillText");
    if (dot) {
      dot.classList.toggle("ok", state === "ok");
      dot.classList.toggle("warn", state === "warn");
    }
    if (pillText) pillText.textContent = text;
  }

  function setAuthedUi(isAuthed) {
    const authCard = $("authCard");
    if (authCard) authCard.style.display = isAuthed ? "none" : "";

    const ids = [
      "accountSyncNowBtn",
      "accountLogoutBtn",
      "changePasswordBtn",
      "refreshVersionsBtn"
    ];
    for (const id of ids) {
      const el = $(id);
      if (el) el.disabled = !isAuthed;
    }
  }

  function formatTimestamp(ts) {
    if (!ts) return "—";
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  }

  function updateOverview(me) {
    const emailValue = $("accountEmailValue");
    const verifyValue = $("accountVerifyValue");
    const avatar = $("accountAvatar");
    const copyBtn = $("accountCopyEmailBtn");
    const lastSyncValue = $("accountLastSyncValue");
    const syncMs = Number(localStorage.getItem(SYNC_META_KEY) || 0) || 0;
    if (lastSyncValue) lastSyncValue.textContent = syncMs ? formatTimestamp(syncMs) : "—";

    if (!me || !me.email) {
      if (emailValue) emailValue.textContent = "Not signed in";
      if (verifyValue) verifyValue.textContent = "Signed out";
      if (avatar) avatar.textContent = "?";
      if (copyBtn) copyBtn.disabled = true;
      return;
    }

    const email = me.email;
    if (emailValue) emailValue.textContent = email;
    if (verifyValue) {
      verifyValue.textContent = me.emailVerified ? "Verified email" : "Email not verified";
    }
    if (avatar) {
      avatar.textContent = email.trim().charAt(0).toUpperCase() || "?";
    }
    if (copyBtn) copyBtn.disabled = false;
  }

  function isEmailValid(input) {
    if (!input) return false;
    return input.validity ? input.validity.valid : /\S+@\S+\.\S+/.test(input.value);
  }

  function updateAuthControls() {
    const email = $("authEmail");
    const password = $("authPassword");
    const loginBtn = $("loginBtn");
    const registerBtn = $("registerBtn");
    const passwordHint = $("authPasswordHint");
    const emailHint = $("authEmailHint");
    const emailOk = isEmailValid(email);
    const passOk = (password?.value || "").length >= 8;
    if (loginBtn) loginBtn.disabled = !(emailOk && passOk);
    if (registerBtn) registerBtn.disabled = !(emailOk && passOk);
    if (passwordHint) {
      passwordHint.textContent = passOk ? "Password looks good." : "Password must be at least 8 characters.";
    }
    if (emailHint) {
      emailHint.textContent = emailOk ? "Email looks valid." : "Enter a valid email address.";
    }
  }

  function updatePasswordControls() {
    const current = $("currentPassword");
    const next = $("newPassword");
    const changeBtn = $("changePasswordBtn");
    const nextHint = $("newPasswordHint");
    const canChange = (current?.value || "").length > 0 && (next?.value || "").length >= 8;
    if (changeBtn) changeBtn.disabled = !canChange || !isAuthed;
    if (nextHint) {
      nextHint.textContent = (next?.value || "").length >= 8 ? "Strong enough." : "Use at least 8 characters.";
    }
  }

  function updateResetControls() {
    const resetEmail = $("resetEmail");
    const resetToken = $("resetToken");
    const resetPassword = $("resetNewPassword");
    const resetBtn = $("resetPasswordBtn");
    const canReset =
      isEmailValid(resetEmail) &&
      (resetToken?.value || "").trim().length > 0 &&
      (resetPassword?.value || "").length >= 8;
    if (resetBtn) resetBtn.disabled = !canReset;
  }

  function updateVerifyControls() {
    const verifyToken = $("verifyToken");
    const verifyBtn = $("verifyEmailBtn");
    const canVerify = (verifyToken?.value || "").trim().length > 0;
    if (verifyBtn) verifyBtn.disabled = !canVerify;
  }

  function initPasswordToggles() {
    const toggles = document.querySelectorAll("[data-toggle-target]");
    toggles.forEach((btn) => {
      const targetId = btn.getAttribute("data-toggle-target");
      if (!targetId) return;
      const input = $(targetId);
      if (!input) return;
      btn.addEventListener("click", () => {
        const isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
        btn.setAttribute("aria-pressed", isHidden ? "true" : "false");
        btn.textContent = isHidden ? "Hide" : "Show";
      });
    });
  }

  async function loginOrRegister(path, email, password) {
    await apiFetch(path, { method: "POST", body: JSON.stringify({ email, password }) });
  }

  async function initialSyncAfterAuth(mode) {
    const flow = mode === "register" ? "register" : "login";
    const local = snapshotLocalState();
    const cloud = await apiFetch("/api/state");
    const cloudData = filterSnapshot((cloud && cloud.data) || {});
    const localHasData = hasPlannerData(local);
    const cloudHasData = hasPlannerData(cloudData);
    const cloudUpdatedMs = cloud?.updatedAt ? Date.parse(cloud.updatedAt) : 0;

    if (flow === "register" && !cloudHasData && localHasData) {
      await apiFetch("/api/state", { method: "PUT", body: JSON.stringify({ data: local }) });
      localStorage.setItem(SYNC_META_KEY, String(Date.now()));
      return "Uploaded your existing local data to the new account.";
    }

    // On login, never upload/merge local data into the account automatically.
    // If the cloud already has data, always prefer it (keep local prefs).
    if (flow === "login" && cloudHasData) {
      const applied = mergeCloudWithLocalPrefs(cloudData, local);
      replaceLocalStateFromSnapshot(applied);
      localStorage.setItem(SYNC_META_KEY, String(cloudUpdatedMs || Date.now()));
      return "Loaded your account data into this browser.";
    }

    if (cloudHasData && !localHasData) {
      const applied = mergeCloudWithLocalPrefs(cloudData, local);
      replaceLocalStateFromSnapshot(applied);
      localStorage.setItem(SYNC_META_KEY, String(cloudUpdatedMs || Date.now()));
      return "Downloaded your cloud data into this browser.";
    }

    if (flow === "login" && !cloudHasData && localHasData) {
      return "Signed in. Cloud is empty, so local data was kept (no upload on login). Use “Sync now” if you want to upload it.";
    }

    const localSig = stableHashSnapshot(local);
    const cloudSig = stableHashSnapshot(cloudData);
    if (cloudSig === localSig) return "Already in sync.";

    // Register flow fallback: merge local wins to avoid losing the user's current work.
    if (flow === "register") {
      const merged = { ...cloudData, ...local };
      await apiFetch("/api/state", { method: "PUT", body: JSON.stringify({ data: merged }) });
      localStorage.setItem(SYNC_META_KEY, String(Date.now()));
      return "Merged cloud + local (local wins) and synced.";
    }

    return "Signed in.";
  }

  async function syncNow() {
    if (!window.location.origin) return;
    const local = snapshotLocalState();
    const cloud = await apiFetch("/api/state");
    const cloudData = filterSnapshot((cloud && cloud.data) || {});

    const localHasData = hasPlannerData(local);
    const cloudHasData = hasPlannerData(cloudData);

    const cloudUpdatedMs = cloud?.updatedAt ? Date.parse(cloud.updatedAt) : 0;
    const lastSeenCloudMs = Number(localStorage.getItem(SYNC_META_KEY) || 0) || 0;

    if (cloudHasData && !localHasData) {
      const applied = mergeCloudWithLocalPrefs(cloudData, local);
      for (const [k, v] of Object.entries(applied)) localStorage.setItem(k, v ?? "");
      if (cloudUpdatedMs) localStorage.setItem(SYNC_META_KEY, String(cloudUpdatedMs));
      return;
    }
    if (!cloudHasData && localHasData) {
      await apiFetch("/api/state", { method: "PUT", body: JSON.stringify({ data: local }) });
      localStorage.setItem(SYNC_META_KEY, String(Date.now()));
      return;
    }

    // If cloud is newer than what this browser last saw, download it (keep local prefs).
    if (cloudUpdatedMs && cloudUpdatedMs > lastSeenCloudMs) {
      const applied = mergeCloudWithLocalPrefs(cloudData, local);
      for (const [k, v] of Object.entries(applied)) localStorage.setItem(k, v ?? "");
      localStorage.setItem(SYNC_META_KEY, String(cloudUpdatedMs));
      return;
    }

    const merged = { ...cloudData, ...local };
    await apiFetch("/api/state", { method: "PUT", body: JSON.stringify({ data: merged }) });
    localStorage.setItem(SYNC_META_KEY, String(Date.now()));
  }

  function renderVersionsList(filterText = "") {
    const listEl = $("versionsList");
    const msgEl = $("versionsMsg");
    if (!listEl) return;
    listEl.innerHTML = "";
    if (msgEl) msgEl.textContent = "";
    const filter = String(filterText || "").trim().toLowerCase();
    const filtered = versionsCache.filter((v) => {
      if (!filter) return true;
      const idText = String(v.id || "");
      const dateText = v.created_at ? new Date(v.created_at).toLocaleString() : "";
      return idText.toLowerCase().includes(filter) || dateText.toLowerCase().includes(filter);
    });

    if (!filtered.length) {
      if (msgEl) {
        msgEl.textContent = versionsCache.length
          ? "No backups match that filter."
          : "No backups yet. (A backup is stored on each sync/save.)";
      }
      return;
    }

    filtered.forEach((v) => {
      const li = document.createElement("li");
      li.className = "account-list-item";
      const left = document.createElement("div");
      const title = document.createElement("div");
      title.className = "account-list-title";
      title.textContent = `Backup #${v.id}`;
      const subtitle = document.createElement("div");
      subtitle.className = "account-list-sub";
      subtitle.textContent = v.created_at ? new Date(v.created_at).toLocaleString() : "Unknown date";
      left.appendChild(title);
      left.appendChild(subtitle);
      const btn = document.createElement("button");
      btn.className = "account-btn account-btn-secondary";
      btn.type = "button";
      btn.innerHTML = '<span class="btn-label">Restore</span><span class="btn-spinner" aria-hidden="true"></span>';
      btn.addEventListener("click", () => {
        openRestoreConfirm(v, btn);
      });
      li.appendChild(left);
      li.appendChild(btn);
      listEl.appendChild(li);
    });
  }

  function openRestoreConfirm(version, sourceBtn) {
    const backdrop = $("restoreConfirmBackdrop");
    const body = $("restoreConfirmBody");
    if (!backdrop || !body) return;
    pendingRestore = { version, sourceBtn };
    const when = version.created_at ? new Date(version.created_at).toLocaleString() : "Unknown date";
    body.textContent = `Restore backup #${version.id} from ${when}? This replaces local data on this device.`;
    backdrop.hidden = false;
    backdrop.style.display = "flex";
  }

  function closeRestoreConfirm() {
    const backdrop = $("restoreConfirmBackdrop");
    if (!backdrop) return;
    pendingRestore = null;
    backdrop.hidden = true;
    backdrop.style.display = "none";
  }

  async function refreshVersions() {
    $("versionsMsg").textContent = "";
    $("versionsList").innerHTML = "";
    try {
      const result = await apiFetch("/api/state/versions");
      versionsCache = result.versions || [];
      const lastBackupValue = $("lastBackupValue");
      if (lastBackupValue) {
        lastBackupValue.textContent = versionsCache[0]?.created_at
          ? new Date(versionsCache[0].created_at).toLocaleString()
          : "—";
      }
      const filterInput = $("versionsFilter");
      renderVersionsList(filterInput ? filterInput.value : "");
    } catch (err) {
      $("versionsMsg").textContent = String(err?.message || "Failed to load backups");
    }
  }

  async function init() {
    if (window.location && window.location.protocol === "file:") {
      setPill("warn", "Offline (file://)");
      setAuthedUi(false);
      $("authMsg").textContent =
        "Accounts/sync need the backend. Run `npm start` and open http://localhost:10000/account.html (or use your Render URL).";
      $("accountStatusMsg").textContent = "Not connected to a server.";
      updateOverview(null);
      return;
    }

    const verifyParam = new URLSearchParams(window.location.search || "").get("verify");
    if (verifyParam === "ok") {
      $("verifyMsg").textContent = "Email verified.";
      showToast("success", "Email verified.");
      window.history.replaceState(null, "", window.location.pathname);
    } else if (verifyParam === "error") {
      $("verifyMsg").textContent = "Verification link invalid or expired. Request a new one.";
      showToast("error", "Verification failed. Request a new link.");
      window.history.replaceState(null, "", window.location.pathname);
    }

    const me = await getMe();
    isAuthed = !!me;
    if (!me) {
      setPill("off", "Signed out");
      setAuthedUi(false);
      $("accountStatusMsg").textContent = "Login or register to enable cross-browser sync.";
      updateOverview(null);
    } else {
      setPill(me.emailVerified ? "ok" : "warn", me.emailVerified ? "Signed in" : "Signed in (unverified)");
      setAuthedUi(true);
      $("accountStatusMsg").textContent = `Logged in as ${me.email}${me.emailVerified ? " (verified)" : " (unverified)"}`;
      updateOverview(me);
      $("accountLogoutBtn").addEventListener("click", async () => {
        try {
          await apiFetch("/api/auth/logout", { method: "POST" });
        } catch {}
        const shouldClear = confirm(
          "Logout successful.\n\nDo you also want to clear this device's local study data (subjects, timetable, calendar, flashcards)?" +
            "\n\nChoose OK = clear local data, Cancel = keep local data."
        );
        if (shouldClear) {
          clearLocalStudyData();
        }
        window.location.href = "./index.html";
      });
      $("accountSyncNowBtn").addEventListener("click", async () => {
        setButtonLoading($("accountSyncNowBtn"), true, "Syncing…");
        $("accountStatusMsg").textContent = "Syncing…";
        try {
          await syncNow();
          $("accountStatusMsg").textContent = `Synced. Logged in as ${me.email}`;
          showToast("success", "Sync complete.");
          await refreshVersions();
          updateOverview(me);
        } catch (err) {
          $("accountStatusMsg").textContent = String(err?.message || "Sync failed");
          showToast("error", String(err?.message || "Sync failed"));
        }
        setButtonLoading($("accountSyncNowBtn"), false);
      });
      $("changePasswordBtn").addEventListener("click", async () => {
        $("changePasswordMsg").textContent = "";
        try {
          await apiFetch("/api/auth/change-password", {
            method: "POST",
            body: JSON.stringify({
              currentPassword: $("currentPassword").value,
              newPassword: $("newPassword").value
            })
          });
          $("currentPassword").value = "";
          $("newPassword").value = "";
          $("changePasswordMsg").textContent = "Password changed.";
          showToast("success", "Password updated.");
          updatePasswordControls();
        } catch (err) {
          $("changePasswordMsg").textContent = String(err?.message || "Change password failed");
          showToast("error", String(err?.message || "Change password failed"));
        }
      });
      $("refreshVersionsBtn").addEventListener("click", refreshVersions);
      await refreshVersions();
    }

    const copyBtn = $("accountCopyEmailBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const emailText = me?.email || "";
        if (!emailText) return;
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(emailText);
          } else {
            const area = document.createElement("textarea");
            area.value = emailText;
            area.style.position = "fixed";
            area.style.opacity = "0";
            document.body.appendChild(area);
            area.select();
            document.execCommand("copy");
            area.remove();
          }
          showToast("success", "Email copied.");
        } catch (err) {
          showToast("error", "Copy failed.");
        }
      });
    }

    const filterInput = $("versionsFilter");
    if (filterInput) {
      filterInput.addEventListener("input", () => renderVersionsList(filterInput.value));
    }

    const restoreBackdrop = $("restoreConfirmBackdrop");
    const restoreCloseBtn = $("restoreConfirmCloseBtn");
    const restoreCancelBtn = $("restoreConfirmCancelBtn");
    const restoreConfirmBtn = $("restoreConfirmConfirmBtn");
    restoreCloseBtn?.addEventListener("click", closeRestoreConfirm);
    restoreCancelBtn?.addEventListener("click", closeRestoreConfirm);
    restoreBackdrop?.addEventListener("click", (event) => {
      if (event.target === restoreBackdrop) closeRestoreConfirm();
    });
    restoreConfirmBtn?.addEventListener("click", async () => {
      if (!pendingRestore) return;
      const { version, sourceBtn } = pendingRestore;
      setButtonLoading(restoreConfirmBtn, true, "Restoring…");
      if (sourceBtn) setButtonLoading(sourceBtn, true, "Restoring…");
      try {
        const restored = await apiFetch("/api/state/restore", {
          method: "POST",
          body: JSON.stringify({ versionId: version.id })
        });
        const data = filterSnapshot(restored.data || {});
        replaceLocalStateFromSnapshot(data);
        showToast("success", "Backup restored. Redirecting...");
        window.location.href = "./index.html";
      } catch (err) {
        $("versionsMsg").textContent = String(err?.message || "Restore failed");
        showToast("error", String(err?.message || "Restore failed"));
      } finally {
        setButtonLoading(restoreConfirmBtn, false);
        if (sourceBtn) setButtonLoading(sourceBtn, false);
        closeRestoreConfirm();
      }
    });

    initPasswordToggles();

    // Email verification handlers (attach regardless of auth state so the UI gives feedback).
    // NOTE: Requesting a verification email requires login; verifying a token does not.
    $("requestVerifyBtn").addEventListener("click", async () => {
      const btn = $("requestVerifyBtn");
      $("verifyMsg").textContent = "";
      setButtonLoading(btn, true, "Sending…");
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20_000);
        const result = await apiFetch("/api/auth/request-verify", {
          method: "POST",
          signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));
        if (result.alreadyVerified) {
          $("verifyMsg").textContent = "Email already verified.";
          showToast("info", "Email already verified.");
        } else if (result.emailSent) {
          $("verifyMsg").textContent = "Verification email sent. Check your inbox (and spam).";
          showToast("success", "Verification email sent.");
        } else if (result.token) {
          $("verifyMsg").textContent = `Verification token (dev): ${result.token}`;
          showToast("info", "Verification token generated.");
        } else {
          $("verifyMsg").textContent =
            "Verification requested, but email sender is not configured (or sending failed).";
          showToast("info", "Verification requested.");
        }
      } catch (err) {
        const msg = String(err?.message || "Request verify failed");
        $("verifyMsg").textContent = msg === "Unauthorized" ? "Please login first to send a verification email." : msg;
        showToast("error", $("verifyMsg").textContent);
      } finally {
        setButtonLoading(btn, false);
      }
    });

    $("verifyEmailBtn").addEventListener("click", async () => {
      const btn = $("verifyEmailBtn");
      $("verifyMsg").textContent = "";
      setButtonLoading(btn, true, "Verifying…");
      try {
        await apiFetch("/api/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ token: $("verifyToken").value })
        });
        $("verifyToken").value = "";
        $("verifyMsg").textContent = "Email verified.";
        showToast("success", "Email verified.");
        setTimeout(() => window.location.reload(), 350);
      } catch (err) {
        $("verifyMsg").textContent = String(err?.message || "Verify failed");
        showToast("error", $("verifyMsg").textContent);
      } finally {
        setButtonLoading(btn, false);
        updateVerifyControls();
      }
    });

    $("loginBtn").addEventListener("click", async () => {
      $("authMsg").textContent = "";
      if (!isEmailValid($("authEmail")) || ($("authPassword").value || "").length < 8) {
        $("authMsg").textContent = "Please enter a valid email and a password with at least 8 characters.";
        showToast("error", $("authMsg").textContent);
        return;
      }
      try {
        await loginOrRegister(
          "/api/auth/login",
          normalizeEmail($("authEmail").value),
          $("authPassword").value
        );
        $("authPassword").value = "";
        const msg = await initialSyncAfterAuth("login").catch(() => "Signed in.");
        $("authMsg").textContent = msg;
        showToast("success", "Signed in.");
        window.location.reload();
      } catch (err) {
        $("authMsg").textContent = String(err?.message || "Login failed");
        showToast("error", $("authMsg").textContent);
      }
    });

    $("registerBtn").addEventListener("click", async () => {
      $("authMsg").textContent = "";
      if (!isEmailValid($("authEmail")) || ($("authPassword").value || "").length < 8) {
        $("authMsg").textContent = "Please enter a valid email and a password with at least 8 characters.";
        showToast("error", $("authMsg").textContent);
        return;
      }
      try {
        await loginOrRegister(
          "/api/auth/register",
          normalizeEmail($("authEmail").value),
          $("authPassword").value
        );
        $("authPassword").value = "";
        const msg = await initialSyncAfterAuth("register").catch(() => "Registered.");
        $("authMsg").textContent = msg;
        showToast("success", "Account created.");
        window.location.reload();
      } catch (err) {
        $("authMsg").textContent = String(err?.message || "Registration failed");
        showToast("error", $("authMsg").textContent);
      }
    });

    $("requestResetBtn").addEventListener("click", async () => {
      $("resetMsg").textContent = "";
      const email = normalizeEmail($("resetEmail").value);
      if (!email) {
        $("resetMsg").textContent = "Email required.";
        showToast("error", $("resetMsg").textContent);
        return;
      }
      try {
        const result = await apiFetch("/api/auth/request-reset", {
          method: "POST",
          body: JSON.stringify({ email })
        });
        if (result.token) {
          $("resetMsg").textContent = `Reset token (dev): ${result.token}`;
          showToast("info", "Reset token generated.");
        } else {
          $("resetMsg").textContent = "Reset requested. (Email sender not implemented.)";
          showToast("info", "Reset requested.");
        }
      } catch (err) {
        $("resetMsg").textContent = String(err?.message || "Request reset failed");
        showToast("error", $("resetMsg").textContent);
      }
    });

    $("resetPasswordBtn").addEventListener("click", async () => {
      $("resetMsg").textContent = "";
      try {
        await apiFetch("/api/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({
            email: normalizeEmail($("resetEmail").value),
            token: $("resetToken").value,
            newPassword: $("resetNewPassword").value
          })
        });
        $("resetToken").value = "";
        $("resetNewPassword").value = "";
        $("resetMsg").textContent = "Password reset completed. You can login now.";
        showToast("success", "Password reset completed.");
        updateResetControls();
      } catch (err) {
        $("resetMsg").textContent = String(err?.message || "Reset failed");
        showToast("error", $("resetMsg").textContent);
      }
    });

    const authEmail = $("authEmail");
    const authPassword = $("authPassword");
    const currentPassword = $("currentPassword");
    const newPassword = $("newPassword");
    const resetEmail = $("resetEmail");
    const resetToken = $("resetToken");
    const resetNewPassword = $("resetNewPassword");
    const verifyToken = $("verifyToken");

    authEmail?.addEventListener("input", updateAuthControls);
    authPassword?.addEventListener("input", updateAuthControls);
    currentPassword?.addEventListener("input", updatePasswordControls);
    newPassword?.addEventListener("input", updatePasswordControls);
    resetEmail?.addEventListener("input", updateResetControls);
    resetToken?.addEventListener("input", updateResetControls);
    resetNewPassword?.addEventListener("input", updateResetControls);
    verifyToken?.addEventListener("input", updateVerifyControls);

    updateAuthControls();
    updatePasswordControls();
    updateResetControls();
    updateVerifyControls();

    // Enter-to-confirm shortcuts
    authEmail?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      authPassword?.focus();
    });
    authPassword?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      $("loginBtn")?.click();
    });

    currentPassword?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      newPassword?.focus();
    });
    newPassword?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      $("changePasswordBtn")?.click();
    });

    verifyToken?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      $("verifyEmailBtn")?.click();
    });

    resetEmail?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      $("requestResetBtn")?.click();
    });
    resetToken?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      resetNewPassword?.focus();
    });
    resetNewPassword?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      $("resetPasswordBtn")?.click();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
