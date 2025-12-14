(() => {
  function $(id) {
    return document.getElementById(id);
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
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("study")) continue;
      out[key] = localStorage.getItem(key);
    }
    return out;
  }

  function stableStringifyObject(obj) {
    const keys = Object.keys(obj).sort();
    const entries = keys.map((key) => [key, obj[key]]);
    return JSON.stringify(Object.fromEntries(entries));
  }

  function setPill(isAuthed, text) {
    const dot = $("authDot");
    const pillText = $("authPillText");
    if (dot) dot.classList.toggle("ok", !!isAuthed);
    if (pillText) pillText.textContent = text;
  }

  function setAuthedUi(isAuthed) {
    const authCard = $("authCard");
    if (authCard) authCard.style.display = isAuthed ? "none" : "";

    const ids = [
      "accountSyncNowBtn",
      "accountLogoutBtn",
      "changePasswordBtn",
      "requestVerifyBtn",
      "verifyEmailBtn",
      "refreshVersionsBtn"
    ];
    for (const id of ids) {
      const el = $(id);
      if (el) el.disabled = !isAuthed;
    }
  }

  async function loginOrRegister(path, email, password) {
    await apiFetch(path, { method: "POST", body: JSON.stringify({ email, password }) });
  }

  async function initialSyncAfterAuth() {
    const local = snapshotLocalState();
    const localStr = stableStringifyObject(local);
    const cloud = await apiFetch("/api/state");
    const cloudData = (cloud && cloud.data) || {};
    const cloudStr = stableStringifyObject(cloudData);

    const localEmpty = Object.keys(local).length === 0;
    const cloudEmpty = Object.keys(cloudData).length === 0;

    if (cloudEmpty && !localEmpty) {
      await apiFetch("/api/state", { method: "PUT", body: JSON.stringify({ data: local }) });
      return "Uploaded your existing local data to the new account.";
    }

    if (!cloudEmpty && localEmpty) {
      for (const [k, v] of Object.entries(cloudData)) localStorage.setItem(k, v ?? "");
      return "Downloaded your cloud data into this browser.";
    }

    if (cloudStr === localStr) return "Already in sync.";

    // Default: merge local wins to avoid losing the user's current work.
    const merged = { ...cloudData, ...local };
    await apiFetch("/api/state", { method: "PUT", body: JSON.stringify({ data: merged }) });
    return "Merged cloud + local (local wins) and synced.";
  }

  async function syncNow() {
    if (!window.location.origin) return;
    const local = snapshotLocalState();
    const cloud = await apiFetch("/api/state");
    const cloudData = (cloud && cloud.data) || {};

    const localEmpty = Object.keys(local).length === 0;
    const cloudEmpty = Object.keys(cloudData).length === 0;

    if (!cloudEmpty && localEmpty) {
      for (const [k, v] of Object.entries(cloudData)) localStorage.setItem(k, v ?? "");
      return;
    }
    if (cloudEmpty && !localEmpty) {
      await apiFetch("/api/state", { method: "PUT", body: JSON.stringify({ data: local }) });
      return;
    }

    const merged = { ...cloudData, ...local };
    await apiFetch("/api/state", { method: "PUT", body: JSON.stringify({ data: merged }) });
  }

  async function refreshVersions() {
    $("versionsMsg").textContent = "";
    $("versionsList").innerHTML = "";
    try {
      const result = await apiFetch("/api/state/versions");
      const versions = result.versions || [];
      if (!versions.length) {
        $("versionsMsg").textContent = "No backups yet. (A backup is stored on each sync/save.)";
        return;
      }
      for (const v of versions) {
        const li = document.createElement("li");
        const left = document.createElement("div");
        left.className = "account-mono";
        left.textContent = `#${v.id}  ${new Date(v.created_at).toLocaleString()}`;
        const btn = document.createElement("button");
        btn.className = "account-btn secondary";
        btn.type = "button";
        btn.textContent = "Restore";
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          try {
            const restored = await apiFetch("/api/state/restore", {
              method: "POST",
              body: JSON.stringify({ versionId: v.id })
            });
            const data = restored.data || {};
            // Replace only study* keys
            const wanted = new Set(Object.keys(data));
            const existing = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith("study")) existing.push(key);
            }
            for (const key of existing) if (!wanted.has(key)) localStorage.removeItem(key);
            for (const [k, val] of Object.entries(data)) localStorage.setItem(k, val ?? "");
            window.location.href = "./index.html";
          } catch (err) {
            $("versionsMsg").textContent = String(err?.message || "Restore failed");
          } finally {
            btn.disabled = false;
          }
        });
        li.appendChild(left);
        li.appendChild(btn);
        $("versionsList").appendChild(li);
      }
    } catch (err) {
      $("versionsMsg").textContent = String(err?.message || "Failed to load backups");
    }
  }

  async function init() {
    if (window.location && window.location.protocol === "file:") {
      setPill(false, "Offline (file://)");
      setAuthedUi(false);
      $("authMsg").textContent =
        "Accounts/sync need the backend. Run `npm start` and open http://localhost:10000/account.html (or use your Render URL).";
      $("accountStatusMsg").textContent = "Not connected to a server.";
      return;
    }

    const me = await getMe();
    if (!me) {
      setPill(false, "Signed out");
      setAuthedUi(false);
      $("accountStatusMsg").textContent = "Login or register to enable cross-browser sync.";
    } else {
      setPill(true, me.emailVerified ? "Signed in" : "Signed in (unverified)");
      setAuthedUi(true);
      $("accountStatusMsg").textContent = `Logged in as ${me.email}${me.emailVerified ? " (verified)" : " (unverified)"}`;
      $("accountLogoutBtn").addEventListener("click", async () => {
        try {
          await apiFetch("/api/auth/logout", { method: "POST" });
        } catch {}
        window.location.href = "./index.html";
      });
      $("accountSyncNowBtn").addEventListener("click", async () => {
        $("accountStatusMsg").textContent = "Syncing…";
        try {
          await syncNow();
          $("accountStatusMsg").textContent = `Synced. Logged in as ${me.email}`;
          await refreshVersions();
        } catch (err) {
          $("accountStatusMsg").textContent = String(err?.message || "Sync failed");
        }
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
        } catch (err) {
          $("changePasswordMsg").textContent = String(err?.message || "Change password failed");
        }
      });
      $("requestVerifyBtn").addEventListener("click", async () => {
        $("verifyMsg").textContent = "";
        try {
          const result = await apiFetch("/api/auth/request-verify", { method: "POST" });
          if (result.alreadyVerified) {
            $("verifyMsg").textContent = "Email already verified.";
          } else if (result.token) {
            $("verifyMsg").textContent = `Verification token (dev): ${result.token}`;
          } else {
            $("verifyMsg").textContent = "Verification requested (email sender not implemented).";
          }
        } catch (err) {
          $("verifyMsg").textContent = String(err?.message || "Request verify failed");
        }
      });
      $("verifyEmailBtn").addEventListener("click", async () => {
        $("verifyMsg").textContent = "";
        try {
          await apiFetch("/api/auth/verify-email", {
            method: "POST",
            body: JSON.stringify({ token: $("verifyToken").value })
          });
          $("verifyToken").value = "";
          $("verifyMsg").textContent = "Email verified.";
        } catch (err) {
          $("verifyMsg").textContent = String(err?.message || "Verify failed");
        }
      });
      $("refreshVersionsBtn").addEventListener("click", refreshVersions);
      await refreshVersions();
    }

    $("loginBtn").addEventListener("click", async () => {
      $("authMsg").textContent = "";
      try {
        await loginOrRegister(
          "/api/auth/login",
          normalizeEmail($("authEmail").value),
          $("authPassword").value
        );
        $("authPassword").value = "";
        const msg = await initialSyncAfterAuth().catch(() => "Signed in.");
        $("authMsg").textContent = msg;
        window.location.reload();
      } catch (err) {
        $("authMsg").textContent = String(err?.message || "Login failed");
      }
    });

    $("registerBtn").addEventListener("click", async () => {
      $("authMsg").textContent = "";
      try {
        await loginOrRegister(
          "/api/auth/register",
          normalizeEmail($("authEmail").value),
          $("authPassword").value
        );
        $("authPassword").value = "";
        const msg = await initialSyncAfterAuth().catch(() => "Registered.");
        $("authMsg").textContent = msg;
        window.location.reload();
      } catch (err) {
        $("authMsg").textContent = String(err?.message || "Registration failed");
      }
    });

    $("requestResetBtn").addEventListener("click", async () => {
      $("resetMsg").textContent = "";
      const email = normalizeEmail($("resetEmail").value);
      if (!email) return ($("resetMsg").textContent = "Email required.");
      try {
        const result = await apiFetch("/api/auth/request-reset", {
          method: "POST",
          body: JSON.stringify({ email })
        });
        if (result.token) {
          $("resetMsg").textContent = `Reset token (dev): ${result.token}`;
        } else {
          $("resetMsg").textContent = "Reset requested. (Email sender not implemented.)";
        }
      } catch (err) {
        $("resetMsg").textContent = String(err?.message || "Request reset failed");
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
      } catch (err) {
        $("resetMsg").textContent = String(err?.message || "Reset failed");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
