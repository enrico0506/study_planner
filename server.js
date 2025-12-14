import "dotenv/config";
import express from "express";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const app = express();
const port = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// Static assets
app.use(express.static(path.join(__dirname, "public")));
app.use("/src", express.static(path.join(__dirname, "src")));

function sendHtml(res, filename) {
  res.sendFile(path.join(__dirname, filename));
}

// Front-end entry points
app.get("/", (_req, res) => sendHtml(res, "index.html"));
app.get("/index.html", (_req, res) => sendHtml(res, "index.html"));
app.get("/calendar.html", (_req, res) => sendHtml(res, "calendar.html"));
app.get("/stundenplan.html", (_req, res) => sendHtml(res, "stundenplan.html"));
app.get("/karteikarten.html", (_req, res) => sendHtml(res, "karteikarten.html"));
app.get("/account.html", (_req, res) => sendHtml(res, "account.html"));
app.get("/study-confidence-table.html", (_req, res) =>
  sendHtml(res, "study-confidence-table.html")
);

// Health check
app.get("/healthz", (_req, res) => res.send("ok"));

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

let pool;
function getPool() {
  if (!pool) {
    let connectionString = requireEnv("DATABASE_URL").trim();
    if (connectionString.startsWith("DATABASE_URL=")) {
      connectionString = connectionString.slice("DATABASE_URL=".length);
    }
    pool = new pg.Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

function getJwtSecret() {
  return requireEnv("JWT_SECRET");
}

function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function clearAuthCookie(res) {
  res.clearCookie("token", { path: "/" });
}

function authMiddleware(req, _res, next) {
  const token = req.cookies?.token;
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.user = { id: payload.sub, email: payload.email };
  } catch {
    req.user = null;
  }

  next();
}

app.use(authMiddleware);

function requireAuth(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validatePassword(password) {
  const value = String(password || "");
  if (value.length < 8) return "Password must be at least 8 characters";
  return null;
}

app.get("/api/me", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  try {
    const pool = getPool();
    const found = await pool.query("select email, email_verified from users where id = $1", [
      req.user.id
    ]);
    const row = found.rows[0];
    if (!row) {
      clearAuthCookie(res);
      return res.status(401).json({ error: "Unauthorized" });
    }
    res.json({ email: row.email, emailVerified: row.email_verified });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load user" });
  }
});

function shouldRevealTokens() {
  return process.env.ALLOW_TOKEN_DEBUG === "true" || process.env.NODE_ENV !== "production";
}

function generateToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

app.post("/api/auth/register", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!email) return res.status(400).json({ error: "Email required" });
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

  try {
    const passwordHash = await bcrypt.hash(String(password), 12);
    const pool = getPool();
    const created = await pool.query(
      "insert into users (email, password_hash) values ($1, $2) returning id, email",
      [email, passwordHash]
    );
    const user = created.rows[0];
    await pool.query(
      "insert into user_states (user_id, data) values ($1, '{}'::jsonb) on conflict (user_id) do nothing",
      [user.id]
    );

    const token = jwt.sign({ sub: String(user.id), email: user.email }, getJwtSecret(), {
      expiresIn: "7d"
    });
    setAuthCookie(res, token);
    res.status(201).json({ email: user.email });
  } catch (err) {
    const message = String(err?.message || "");
    if (message.startsWith("Missing required env var:")) {
      return res.status(500).json({ error: message });
    }
    if (err?.code === "42P01") {
      return res.status(500).json({ error: "Database not initialized. Run `npm run migrate`." });
    }
    if (message.includes("users_email_key")) {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  try {
    const pool = getPool();
    const found = await pool.query("select id, email, password_hash from users where email = $1", [
      email
    ]);
    const user = found.rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ sub: String(user.id), email: user.email }, getJwtSecret(), {
      expiresIn: "7d"
    });
    setAuthCookie(res, token);
    res.json({ email: user.email });
  } catch (err) {
    const message = String(err?.message || "");
    if (message.startsWith("Missing required env var:")) {
      return res.status(500).json({ error: message });
    }
    if (err?.code === "42P01") {
      return res.status(500).json({ error: "Database not initialized. Run `npm run migrate`." });
    }
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.post("/api/auth/change-password", requireAuth, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = req.body?.newPassword;
  if (!currentPassword) return res.status(400).json({ error: "Current password required" });
  const pwError = validatePassword(newPassword);
  if (pwError) return res.status(400).json({ error: pwError });

  try {
    const pool = getPool();
    const found = await pool.query("select id, password_hash from users where id = $1", [req.user.id]);
    const user = found.rows[0];
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const passwordHash = await bcrypt.hash(String(newPassword), 12);
    await pool.query("update users set password_hash = $1 where id = $2", [passwordHash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Change password failed" });
  }
});

app.post("/api/auth/request-reset", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const pool = getPool();
    const found = await pool.query("select id, email from users where email = $1", [email]);
    const user = found.rows[0];

    // Always return ok to avoid user enumeration.
    if (!user) return res.json({ ok: true });

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await pool.query(
      "insert into auth_tokens (user_id, kind, token_hash, expires_at) values ($1, 'password_reset', $2, $3)",
      [user.id, tokenHash, expiresAt]
    );

    if (shouldRevealTokens()) return res.json({ ok: true, token });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Request reset failed" });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const token = String(req.body?.token || "");
  const newPassword = req.body?.newPassword;
  if (!email || !token) return res.status(400).json({ error: "Email and token required" });
  const pwError = validatePassword(newPassword);
  if (pwError) return res.status(400).json({ error: pwError });

  try {
    const pool = getPool();
    const found = await pool.query("select id from users where email = $1", [email]);
    const user = found.rows[0];
    if (!user) return res.status(400).json({ error: "Invalid token" });

    const tokenHash = hashToken(token);
    const tokenRow = await pool.query(
      `
        select id
        from auth_tokens
        where user_id = $1
          and kind = 'password_reset'
          and token_hash = $2
          and used_at is null
          and expires_at > now()
        order by created_at desc
        limit 1
      `,
      [user.id, tokenHash]
    );
    if (!tokenRow.rows[0]) return res.status(400).json({ error: "Invalid token" });

    const passwordHash = await bcrypt.hash(String(newPassword), 12);
    await pool.query("begin");
    await pool.query("update users set password_hash = $1 where id = $2", [passwordHash, user.id]);
    await pool.query("update auth_tokens set used_at = now() where id = $1", [tokenRow.rows[0].id]);
    await pool.query("commit");
    res.json({ ok: true });
  } catch (err) {
    try {
      await getPool().query("rollback");
    } catch {}
    console.error(err);
    res.status(500).json({ error: "Reset password failed" });
  }
});

app.post("/api/auth/request-verify", requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const found = await pool.query("select id, email_verified from users where id = $1", [req.user.id]);
    const user = found.rows[0];
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (user.email_verified) return res.json({ ok: true, alreadyVerified: true });

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query(
      "insert into auth_tokens (user_id, kind, token_hash, expires_at) values ($1, 'email_verify', $2, $3)",
      [user.id, tokenHash, expiresAt]
    );

    if (shouldRevealTokens()) return res.json({ ok: true, token });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Request verify failed" });
  }
});

app.post("/api/auth/verify-email", requireAuth, async (req, res) => {
  const token = String(req.body?.token || "");
  if (!token) return res.status(400).json({ error: "Token required" });

  try {
    const pool = getPool();
    const tokenHash = hashToken(token);
    const tokenRow = await pool.query(
      `
        select id
        from auth_tokens
        where user_id = $1
          and kind = 'email_verify'
          and token_hash = $2
          and used_at is null
          and expires_at > now()
        order by created_at desc
        limit 1
      `,
      [req.user.id, tokenHash]
    );
    if (!tokenRow.rows[0]) return res.status(400).json({ error: "Invalid token" });

    await pool.query("begin");
    await pool.query("update users set email_verified = true where id = $1", [req.user.id]);
    await pool.query("update auth_tokens set used_at = now() where id = $1", [tokenRow.rows[0].id]);
    await pool.query("commit");
    res.json({ ok: true });
  } catch (err) {
    try {
      await getPool().query("rollback");
    } catch {}
    console.error(err);
    res.status(500).json({ error: "Verify email failed" });
  }
});

app.get("/api/state", requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      "select data, updated_at from user_states where user_id = $1",
      [req.user.id]
    );
    const row = result.rows[0];
    res.json({ data: row?.data || {}, updatedAt: row?.updated_at || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load state" });
  }
});

app.put("/api/state", requireAuth, async (req, res) => {
  const data = req.body?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return res.status(400).json({ error: "Invalid state payload" });
  }

  try {
    const pool = getPool();
    await pool.query("begin");

    await pool.query(
      `
        insert into user_states (user_id, data, updated_at)
        values ($1, $2::jsonb, now())
        on conflict (user_id)
        do update set data = excluded.data, updated_at = now()
      `,
      [req.user.id, JSON.stringify(data)]
    );

    await pool.query("insert into user_state_versions (user_id, data) values ($1, $2::jsonb)", [
      req.user.id,
      JSON.stringify(data)
    ]);

    await pool.query(
      `
        delete from user_state_versions
        where user_id = $1
          and id not in (
            select id from user_state_versions
            where user_id = $1
            order by created_at desc
            limit 20
          )
      `,
      [req.user.id]
    );

    await pool.query("commit");
    res.json({ ok: true });
  } catch (err) {
    try {
      await getPool().query("rollback");
    } catch {}
    console.error(err);
    res.status(500).json({ error: "Failed to save state" });
  }
});

app.get("/api/state/versions", requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `
        select id, created_at
        from user_state_versions
        where user_id = $1
        order by created_at desc
        limit 20
      `,
      [req.user.id]
    );
    res.json({ versions: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list versions" });
  }
});

app.post("/api/state/restore", requireAuth, async (req, res) => {
  const versionId = Number(req.body?.versionId);
  if (!Number.isFinite(versionId) || versionId <= 0) {
    return res.status(400).json({ error: "Invalid versionId" });
  }

  try {
    const pool = getPool();
    const found = await pool.query(
      "select data from user_state_versions where id = $1 and user_id = $2",
      [versionId, req.user.id]
    );
    const row = found.rows[0];
    if (!row) return res.status(404).json({ error: "Version not found" });

    await pool.query("begin");
    await pool.query(
      `
        insert into user_states (user_id, data, updated_at)
        values ($1, $2::jsonb, now())
        on conflict (user_id)
        do update set data = excluded.data, updated_at = now()
      `,
      [req.user.id, JSON.stringify(row.data)]
    );
    await pool.query("insert into user_state_versions (user_id, data) values ($1, $2::jsonb)", [
      req.user.id,
      JSON.stringify(row.data)
    ]);
    await pool.query("commit");

    res.json({ ok: true, data: row.data });
  } catch (err) {
    try {
      await getPool().query("rollback");
    } catch {}
    console.error(err);
    res.status(500).json({ error: "Failed to restore version" });
  }
});

// Simple DB check (optional)
app.get("/dbcheck", async (_req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: "DATABASE_URL not set" });
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const { rows } = await client.query("select now()");
    res.json({ now: rows[0].now });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ error: "DB connection failed" });
  } finally {
    await client.end();
  }
});

app.use((_req, res) => {
  res.status(404).send("Not found");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Listening on ${port}`);
});
