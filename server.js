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
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import Stripe from "stripe";

const app = express();
const port = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      const url = typeof req.originalUrl === "string" ? req.originalUrl : "";
      if (url.startsWith("/api/billing/webhook")) {
        req.rawBody = buf;
      }
    }
  })
);
app.use(cookieParser());

const AUTH_SESSION_DAYS = (() => {
  const raw = Number(process.env.AUTH_SESSION_DAYS || 90);
  if (!Number.isFinite(raw) || raw <= 0) return 90;
  return Math.max(1, Math.min(365, Math.round(raw)));
})();
const AUTH_SESSION_MS = AUTH_SESSION_DAYS * 24 * 60 * 60 * 1000;

function rateLimitJsonHandler(_req, res) {
  res.status(429).json({ error: "Too many requests, please try again later." });
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitJsonHandler
});

const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitJsonHandler
});

function getAppBaseUrl(req) {
  const configured = process.env.APP_BASE_URL;
  if (configured) return String(configured).replace(/\/+$/, "");
  const proto = isRequestSecure(req) ? "https" : "http";
  return `${proto}://${req.get("host")}`;
}

let mailTransport = null;
function getMailTransport() {
  if (mailTransport) return mailTransport;

  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (gmailUser && gmailAppPassword) {
    mailTransport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailAppPassword },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000
    });
    return mailTransport;
  }

  if (smtpHost && smtpUser && smtpPass) {
    const port = smtpPort ? Number(smtpPort) : 587;
    mailTransport = nodemailer.createTransport({
      host: smtpHost,
      port: Number.isFinite(port) ? port : 587,
      secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000
    });
    return mailTransport;
  }

  return null;
}

function getFromAddress() {
  return (
    process.env.MAIL_FROM ||
    process.env.GMAIL_USER ||
    process.env.SMTP_USER ||
    "no-reply@localhost"
  );
}

async function sendEmail({ to, subject, html, text }) {
  const transport = getMailTransport();
  if (!transport) return { ok: false, reason: "not_configured" };
  try {
    await transport.sendMail({
      from: getFromAddress(),
      to,
      subject,
      text,
      html
    });
    return { ok: true };
  } catch (err) {
    console.error("Email send failed:", err);
    return { ok: false, reason: "send_failed" };
  }
}

// Static assets
app.use(express.static(path.join(__dirname, "public")));
app.use("/src", express.static(path.join(__dirname, "src")));

function sendHtml(res, filename) {
  res.sendFile(path.join(__dirname, filename));
}

// PWA assets (explicit headers for installability + updates)
app.get("/manifest.webmanifest", (_req, res) => {
  res.type("application/manifest+json");
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(__dirname, "manifest.webmanifest"));
});

app.get("/sw.js", (_req, res) => {
  res.type("application/javascript");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Service-Worker-Allowed", "/");
  res.sendFile(path.join(__dirname, "sw.js"));
});

// Front-end entry points
app.get("/", (_req, res) => sendHtml(res, "index.html"));
app.get("/index.html", (_req, res) => sendHtml(res, "index.html"));
app.get("/calendar.html", (_req, res) => sendHtml(res, "calendar.html"));
app.get("/stundenplan.html", (_req, res) => sendHtml(res, "stundenplan.html"));
app.get("/account.html", (_req, res) => sendHtml(res, "account.html"));
app.get("/about.html", (_req, res) => sendHtml(res, "about.html"));
app.get("/contact.html", (_req, res) => sendHtml(res, "contact.html"));
app.get("/privacy.html", (_req, res) => sendHtml(res, "privacy.html"));
app.get("/terms.html", (_req, res) => sendHtml(res, "terms.html"));
app.get("/impressum.html", (_req, res) => sendHtml(res, "impressum.html"));
app.get("/offline.html", (_req, res) => sendHtml(res, "offline.html"));
app.get("/ad-highperformance-160x600.html", (_req, res) =>
  sendHtml(res, "ad-highperformance-160x600.html")
);

// Health check
app.get("/healthz", (_req, res) => res.send("ok"));

app.get("/robots.txt", (req, res) => {
  res.type("text/plain; charset=utf-8");
  const baseUrl = getAppBaseUrl(req);
  res.send(`User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`);
});

app.get("/sitemap.xml", (req, res) => {
  res.type("application/xml; charset=utf-8");
  const baseUrl = getAppBaseUrl(req);
  const urls = [
    "/",
    "/index.html",
    "/calendar.html",
    "/stundenplan.html",
    "/account.html",
    "/about.html",
    "/contact.html",
    "/privacy.html",
    "/terms.html",
    "/impressum.html"
  ];
  const now = new Date().toISOString();
  const body = urls
    .map(
      (url) =>
        `  <url>\n` +
        `    <loc>${baseUrl}${url}</loc>\n` +
        `    <lastmod>${now}</lastmod>\n` +
        `  </url>`
    )
    .join("\n");
  res.send(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `${body}\n` +
      `</urlset>\n`
  );
});

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

function isRequestSecure(req) {
  if (req.secure) return true;
  const forwarded = req.headers["x-forwarded-proto"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim() === "https";
  return false;
}

function setAuthCookie(req, res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isRequestSecure(req),
    path: "/",
    maxAge: AUTH_SESSION_MS
  });
}

function clearAuthCookie(req, res) {
  res.clearCookie("token", { path: "/", secure: isRequestSecure(req), sameSite: "lax" });
}

function authMiddleware(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.user = { id: payload.sub, email: payload.email };
  } catch {
    clearAuthCookie(req, res);
    req.user = null;
  }

  next();
}

app.use(authMiddleware);

function requireAuth(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
  next();
}

async function requireVerifiedEmail(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
  try {
    const pool = getPool();
    const found = await pool.query("select email_verified from users where id = $1", [req.user.id]);
    const row = found.rows[0];
    if (!row) return res.status(401).json({ error: "Unauthorized" });
    if (!row.email_verified) return res.status(403).json({ error: "Email not verified" });
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to check email verification" });
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizePlan(plan) {
  const value = String(plan || "").trim().toLowerCase();
  if (value === "premium" || value === "pro") return "premium";
  return "free";
}

function isPremiumPlan(plan) {
  return normalizePlan(plan) === "premium";
}

async function requirePremiumSync(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
  try {
    const pool = getPool();
    const found = await pool.query("select email_verified, plan from users where id = $1", [req.user.id]);
    const row = found.rows[0];
    if (!row) return res.status(401).json({ error: "Unauthorized" });
    if (!row.email_verified) return res.status(403).json({ error: "Email not verified" });
    if (!isPremiumPlan(row.plan)) return res.status(402).json({ error: "Premium required" });
    req.user.plan = normalizePlan(row.plan);
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to check subscription" });
  }
}

function validatePassword(password) {
  const value = String(password || "");
  if (value.length < 8) return "Password must be at least 8 characters";
  return null;
}

function formatDbError(err) {
  const code = err?.code;
  if (code === "42P01") return "Database not initialized. Run `npm run migrate`.";
  if (code === "28P01") return "Database authentication failed. Check the username/password in `DATABASE_URL`.";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    const host = err?.hostname || err?.host || "unknown-host";
    return `Cannot resolve database host (${host}). If running locally, use the external Render DB URL.`;
  }
  if (code === "ECONNREFUSED") return "Database connection refused. Check `DATABASE_URL` and network access.";
  if (code === "ETIMEDOUT") return "Database connection timed out. Check `DATABASE_URL` and network access.";
  return null;
}

app.get("/api/me", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  try {
    const pool = getPool();
    const found = await pool.query("select email, email_verified, plan from users where id = $1", [
      req.user.id
    ]);
    const row = found.rows[0];
    if (!row) {
      clearAuthCookie(req, res);
      return res.status(401).json({ error: "Unauthorized" });
    }
    const plan = normalizePlan(row.plan);
    res.json({ email: row.email, emailVerified: row.email_verified, plan, isPremium: plan === "premium" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load user" });
  }
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getContactRecipient() {
  const value = process.env.CONTACT_EMAIL;
  if (!value) return null;
  return String(value).trim();
}

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitJsonHandler
});

function looksLikeEmail(value) {
  const email = String(value || "").trim();
  if (!email || email.length > 254) return false;
  if (email.includes(" ")) return false;
  const at = email.indexOf("@");
  if (at <= 0 || at === email.length - 1) return false;
  return true;
}

app.post("/api/contact", contactLimiter, async (req, res) => {
  const to = getContactRecipient();
  if (!to) return res.status(503).json({ error: "Contact form is not configured." });

  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim();
  const message = String(req.body?.message || "").trim();

  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ error: "Please enter a name (2–80 characters)." });
  }
  if (!looksLikeEmail(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (message.length < 10 || message.length > 5000) {
    return res.status(400).json({ error: "Please enter a message (10–5000 characters)." });
  }

  const now = new Date().toISOString();
  const subject = `Study Planner contact: ${name}`;
  const text = `Name: ${name}\nEmail: ${email}\nTime: ${now}\n\n${message}\n`;
  const html =
    `<p><strong>Name:</strong> ${escapeHtml(name)}</p>` +
    `<p><strong>Email:</strong> ${escapeHtml(email)}</p>` +
    `<p><strong>Time:</strong> ${escapeHtml(now)}</p>` +
    `<pre style="white-space:pre-wrap;line-height:1.5;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">${escapeHtml(message)}</pre>`;

  const result = await sendEmail({ to, subject, text, html });
  if (!result.ok) {
    const reason =
      result.reason === "not_configured" ? "Contact email is not configured." : "Failed to send email.";
    return res.status(503).json({ error: reason });
  }

  res.json({ ok: true });
});

function shouldRevealTokens() {
  return process.env.ALLOW_TOKEN_DEBUG === "true" || process.env.NODE_ENV !== "production";
}

function generateToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function generateVerificationCode() {
  const value = crypto.randomInt(0, 1_000_000);
  return String(value).padStart(6, "0");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function isLikelyShortVerificationCode(token) {
  return /^\d{6}$/.test(String(token || "").trim());
}

function getAuth0Config() {
  const domainRaw = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;
  if (!domainRaw || !clientId || !clientSecret) return null;

  const domain = String(domainRaw).trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const normalizedClientId = String(clientId).trim();
  const normalizedClientSecret = String(clientSecret).trim();
  if (!domain || !normalizedClientId || !normalizedClientSecret) return null;

  const audienceRaw = process.env.AUTH0_AUDIENCE;
  const audience = audienceRaw ? String(audienceRaw).trim() : null;

  return { domain, clientId: normalizedClientId, clientSecret: normalizedClientSecret, audience };
}

function isSafeReturnTo(value) {
  const input = String(value || "").trim();
  if (!input) return false;
  if (input.length > 2000) return false;
  if (!input.startsWith("/")) return false;
  if (input.startsWith("//")) return false;
  if (input.includes("\n") || input.includes("\r")) return false;
  if (input.includes("://")) return false;
  return true;
}

const AUTH0_FLOW_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;
const AUTH0_FLOW_COOKIE_PATH = "/api/auth/auth0";

function setAuth0FlowCookie(req, res, name, value) {
  res.cookie(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: isRequestSecure(req),
    path: AUTH0_FLOW_COOKIE_PATH,
    maxAge: AUTH0_FLOW_COOKIE_MAX_AGE_MS
  });
}

function clearAuth0FlowCookies(req, res) {
  const options = { path: AUTH0_FLOW_COOKIE_PATH, secure: isRequestSecure(req), sameSite: "lax" };
  res.clearCookie("auth0_state", options);
  res.clearCookie("auth0_nonce", options);
  res.clearCookie("auth0_return_to", options);
}

function redirectToAccountAuth0Error(req, res, code) {
  const baseUrl = getAppBaseUrl(req);
  const param = encodeURIComponent(String(code || "error"));
  res.redirect(`${baseUrl}/account.html?auth0=${param}`);
}

let auth0JwksCache = { fetchedAt: 0, keys: new Map() };
const AUTH0_JWKS_TTL_MS = 6 * 60 * 60 * 1000;

async function refreshAuth0Jwks(domain) {
  const res = await fetch(`https://${domain}/.well-known/jwks.json`, {
    headers: { accept: "application/json" }
  });
  if (!res.ok) throw new Error(`JWKS fetch failed (HTTP ${res.status})`);
  const jwks = await res.json();
  const keys = new Map();
  for (const jwk of jwks?.keys || []) {
    const kid = jwk?.kid;
    if (!kid) continue;
    try {
      const keyObject = crypto.createPublicKey({ key: jwk, format: "jwk" });
      const pem = keyObject.export({ type: "spki", format: "pem" });
      keys.set(kid, pem);
    } catch {}
  }
  auth0JwksCache = { fetchedAt: Date.now(), keys };
}

async function getAuth0PublicKey(domain, kid) {
  const now = Date.now();
  const cachedKey = auth0JwksCache.keys.get(kid);
  const isFresh = now - auth0JwksCache.fetchedAt < AUTH0_JWKS_TTL_MS;
  if (cachedKey && isFresh) return cachedKey;

  try {
    await refreshAuth0Jwks(domain);
  } catch (err) {
    if (cachedKey) return cachedKey;
    throw err;
  }

  const key = auth0JwksCache.keys.get(kid);
  if (!key) throw new Error("Unknown signing key (kid)");
  return key;
}

async function verifyAuth0IdToken(idToken, { domain, clientId, nonce } = {}) {
  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded?.header?.kid;
  const alg = decoded?.header?.alg;
  if (!kid) throw new Error("Invalid id_token (missing kid)");
  if (alg !== "RS256") throw new Error("Unsupported id_token algorithm");

  const key = await getAuth0PublicKey(domain, kid);
  const issuer = `https://${domain}/`;
  const payload = jwt.verify(idToken, key, {
    algorithms: ["RS256"],
    audience: clientId,
    issuer
  });

  if (!payload || typeof payload !== "object") throw new Error("Invalid id_token payload");
  if (nonce && payload.nonce !== nonce) throw new Error("Invalid nonce");

  return payload;
}

async function findOrCreateUserForAuth0Login(pool, { email, emailVerified }) {
  const found = await pool.query("select id, email, email_verified, plan from users where email = $1", [email]);
  const existing = found.rows[0];
  if (existing) {
    await pool.query(
      "insert into user_states (user_id, data) values ($1, '{}'::jsonb) on conflict (user_id) do nothing",
      [existing.id]
    );
    if (emailVerified && !existing.email_verified) {
      const updated = await pool.query(
        "update users set email_verified = true where id = $1 returning id, email, email_verified, plan",
        [existing.id]
      );
      return updated.rows[0] || existing;
    }
    return existing;
  }

  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
  const created = await pool.query(
    "insert into users (email, password_hash, email_verified) values ($1, $2, $3) returning id, email, email_verified, plan",
    [email, passwordHash, !!emailVerified]
  );
  const user = created.rows[0];
  await pool.query(
    "insert into user_states (user_id, data) values ($1, '{}'::jsonb) on conflict (user_id) do nothing",
    [user.id]
  );
  return user;
}

app.get("/api/auth/auth0/login", authLimiter, (req, res) => {
  const config = getAuth0Config();
  if (!config) return redirectToAccountAuth0Error(req, res, "not_configured");

  const baseUrl = getAppBaseUrl(req);
  const callbackUrl = `${baseUrl}/api/auth/auth0/callback`;
  const returnTo = isSafeReturnTo(req.query?.returnTo) ? String(req.query.returnTo) : "/account.html";

  const state = crypto.randomBytes(16).toString("base64url");
  const nonce = crypto.randomBytes(16).toString("base64url");
  setAuth0FlowCookie(req, res, "auth0_state", state);
  setAuth0FlowCookie(req, res, "auth0_nonce", nonce);
  setAuth0FlowCookie(req, res, "auth0_return_to", returnTo);

  const url = new URL(`https://${config.domain}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  if (config.audience) url.searchParams.set("audience", config.audience);

  const connection = String(req.query?.connection || "").trim();
  if (connection && /^[a-zA-Z0-9_-]{1,64}$/.test(connection)) {
    url.searchParams.set("connection", connection);
  }

  res.redirect(url.toString());
});

app.get("/api/auth/auth0/callback", authLimiter, async (req, res) => {
  const config = getAuth0Config();
  if (!config) return redirectToAccountAuth0Error(req, res, "not_configured");

  const baseUrl = getAppBaseUrl(req);
  const callbackUrl = `${baseUrl}/api/auth/auth0/callback`;

  const error = String(req.query?.error || "");
  if (error) {
    clearAuth0FlowCookies(req, res);
    return redirectToAccountAuth0Error(req, res, error);
  }

  const code = String(req.query?.code || "");
  const state = String(req.query?.state || "");
  const expectedState = String(req.cookies?.auth0_state || "");
  if (!code || !state || !expectedState || state !== expectedState) {
    clearAuth0FlowCookies(req, res);
    return redirectToAccountAuth0Error(req, res, "state_mismatch");
  }

  const expectedNonce = String(req.cookies?.auth0_nonce || "");
  const returnTo = isSafeReturnTo(req.cookies?.auth0_return_to)
    ? String(req.cookies.auth0_return_to)
    : "/account.html";

  try {
    const tokenRes = await fetch(`https://${config.domain}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: callbackUrl
      })
    });
    const tokenBody = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok) {
      clearAuth0FlowCookies(req, res);
      return redirectToAccountAuth0Error(req, res, tokenBody?.error || "token_exchange_failed");
    }

    const idToken = tokenBody?.id_token;
    if (!idToken) {
      clearAuth0FlowCookies(req, res);
      return redirectToAccountAuth0Error(req, res, "missing_id_token");
    }

    const profile = await verifyAuth0IdToken(idToken, {
      domain: config.domain,
      clientId: config.clientId,
      nonce: expectedNonce
    });

    const email = normalizeEmail(profile.email);
    if (!email) {
      clearAuth0FlowCookies(req, res);
      return redirectToAccountAuth0Error(req, res, "missing_email");
    }

    const emailVerified = profile.email_verified === true;
    const pool = getPool();
    const user = await findOrCreateUserForAuth0Login(pool, { email, emailVerified });

    const token = jwt.sign({ sub: String(user.id), email: user.email }, getJwtSecret(), {
      expiresIn: `${AUTH_SESSION_DAYS}d`
    });
    setAuthCookie(req, res, token);
    clearAuth0FlowCookies(req, res);
    res.redirect(`${baseUrl}${returnTo}`);
  } catch (err) {
    console.error("Auth0 callback failed:", err);
    clearAuth0FlowCookies(req, res);
    redirectToAccountAuth0Error(req, res, "callback_failed");
  }
});

async function createEmailVerificationCode(pool, userId) {
  const token = generateVerificationCode();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await pool.query(
    "update auth_tokens set used_at = now() where user_id = $1 and kind = 'email_verify' and used_at is null",
    [userId]
  );
  await pool.query(
    "insert into auth_tokens (user_id, kind, token_hash, expires_at) values ($1, 'email_verify', $2, $3)",
    [userId, tokenHash, expiresAt]
  );

  return { token, expiresAt };
}

async function sendEmailVerificationCode(req, email, code) {
  return sendEmail({
    to: email,
    subject: "Verify your email",
    text:
      `Your Study Planner verification code is:\n\n${code}\n\n` +
      `Enter this code in the app to verify your email.\n\n` +
      `This code expires in 1 hour.`,
    html:
      `<p>Your verification code for <strong>Study Planner</strong> is:</p>` +
      `<p style="font-size:28px;font-weight:700;letter-spacing:0.18em;margin:12px 0">${code}</p>` +
      `<p>Enter this code in the app to verify your email.</p>` +
      `<p style="color:#6b7280;font-size:12px">This code expires in 1 hour.</p>`
  });
}

async function requestEmailVerificationCode(req, pool, userId, email) {
  const { token } = await createEmailVerificationCode(pool, userId);
  console.log("Sending verification email to:", email);
  const mailResult = await sendEmailVerificationCode(req, email, token);
  console.log("Verification email result:", mailResult.ok ? "sent" : "not sent");
  return { token, emailSent: mailResult.ok };
}

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!email) return res.status(400).json({ error: "Email required" });
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

  try {
    const passwordHash = await bcrypt.hash(String(password), 12);
    const pool = getPool();
    const created = await pool.query(
      "insert into users (email, password_hash) values ($1, $2) returning id, email, email_verified, plan",
      [email, passwordHash]
    );
    const user = created.rows[0];
    await pool.query(
      "insert into user_states (user_id, data) values ($1, '{}'::jsonb) on conflict (user_id) do nothing",
      [user.id]
    );

    const token = jwt.sign({ sub: String(user.id), email: user.email }, getJwtSecret(), {
      expiresIn: `${AUTH_SESSION_DAYS}d`
    });
    setAuthCookie(req, res, token);

    let verification = { emailSent: false };
    if (user.email && !user.email_verified) {
      try {
        verification = await requestEmailVerificationCode(req, pool, user.id, user.email);
      } catch (err) {
        console.error("Failed to send verification code during registration:", err);
      }
    }

    res.status(201).json({
      email: user.email,
      emailVerified: !!user.email_verified,
      plan: normalizePlan(user.plan),
      isPremium: isPremiumPlan(user.plan),
      verificationRequired: !user.email_verified,
      verification: shouldRevealTokens() ? verification : { emailSent: verification.emailSent }
    });
  } catch (err) {
    const message = String(err?.message || "");
    if (message.startsWith("Missing required env var:")) {
      return res.status(500).json({ error: message });
    }
    const dbMessage = formatDbError(err);
    if (dbMessage) return res.status(500).json({ error: dbMessage });
    if (err?.code === "23505" || message.includes("users_email_key")) {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  try {
    const pool = getPool();
    const found = await pool.query(
      "select id, email, password_hash, email_verified, plan from users where email = $1",
      [email]
    );
    const user = found.rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ sub: String(user.id), email: user.email }, getJwtSecret(), {
      expiresIn: `${AUTH_SESSION_DAYS}d`
    });
    setAuthCookie(req, res, token);
    res.json({
      email: user.email,
      emailVerified: !!user.email_verified,
      plan: normalizePlan(user.plan),
      isPremium: isPremiumPlan(user.plan)
    });
  } catch (err) {
    const message = String(err?.message || "");
    if (message.startsWith("Missing required env var:")) {
      return res.status(500).json({ error: message });
    }
    const dbMessage = formatDbError(err);
    if (dbMessage) return res.status(500).json({ error: dbMessage });
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  clearAuthCookie(req, res);
  res.json({ ok: true });
});

function getAdminApiToken() {
  const raw = process.env.ADMIN_API_TOKEN;
  if (!raw) return null;
  const token = String(raw).trim();
  return token ? token : null;
}

function requireAdminToken(req, res, next) {
  const token = getAdminApiToken();
  if (!token) return res.status(404).send("Not found");

  const header = String(req.headers.authorization || "");
  const provided = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!provided || provided !== token) return res.status(401).json({ error: "Unauthorized" });
  next();
}

app.post("/api/admin/set-plan", strictAuthLimiter, requireAdminToken, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const rawPlan = String(req.body?.plan || "").trim().toLowerCase();
  const plan = rawPlan === "premium" || rawPlan === "pro" ? "premium" : rawPlan === "free" ? "free" : null;
  if (!email) return res.status(400).json({ error: "Email required" });
  if (!plan) return res.status(400).json({ error: "Plan must be 'free' or 'premium'" });

  try {
    const pool = getPool();
    const updated = await pool.query(
      "update users set plan = $1 where email = $2 returning id, email, email_verified, plan",
      [plan, email]
    );
    const row = updated.rows[0];
    if (!row) return res.status(404).json({ error: "User not found" });
    res.json({
      ok: true,
      user: {
        id: String(row.id),
        email: row.email,
        emailVerified: !!row.email_verified,
        plan: normalizePlan(row.plan),
        isPremium: isPremiumPlan(row.plan)
      }
    });
  } catch (err) {
    const dbMessage = formatDbError(err);
    if (dbMessage) return res.status(500).json({ error: dbMessage });
    console.error(err);
    res.status(500).json({ error: "Failed to update plan" });
  }
});

function getStripeSecretKey() {
  const raw = process.env.STRIPE_SECRET_KEY;
  if (!raw) return null;
  const value = String(raw).trim();
  return value ? value : null;
}

function getStripePriceId() {
  const raw = process.env.STRIPE_PRICE_ID;
  if (!raw) return null;
  const value = String(raw).trim();
  return value ? value : null;
}

function getStripeWebhookSecret() {
  const raw = process.env.STRIPE_WEBHOOK_SECRET;
  if (!raw) return null;
  const value = String(raw).trim();
  return value ? value : null;
}

let stripeClient = null;
function getStripeClient() {
  const secretKey = getStripeSecretKey();
  if (!secretKey) return null;
  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}

function parseNumericId(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  return raw;
}

function isStripePremiumStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  return value === "active" || value === "trialing" || value === "past_due";
}

function toStripePeriodEndDate(periodEndSeconds) {
  const seconds = Number(periodEndSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(Math.trunc(seconds) * 1000);
}

async function ensureStripeCustomerId(pool, stripe, { userId, email, existingCustomerId }) {
  if (existingCustomerId) return existingCustomerId;

  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: String(userId) }
  });

  const updated = await pool.query(
    "update users set stripe_customer_id = $1 where id = $2 and stripe_customer_id is null returning stripe_customer_id",
    [customer.id, userId]
  );
  const stored = updated.rows[0]?.stripe_customer_id;
  if (stored) return stored;

  try {
    await stripe.customers.del(customer.id);
  } catch {}

  const refetched = await pool.query("select stripe_customer_id from users where id = $1", [userId]);
  return refetched.rows[0]?.stripe_customer_id || customer.id;
}

async function applyStripeSubscriptionToUser(pool, { userId, customerId, subscriptionId, status, currentPeriodEnd }) {
  const plan = isStripePremiumStatus(status) ? "premium" : "free";
  const periodEnd = toStripePeriodEndDate(currentPeriodEnd);

  if (customerId) {
    const updatedByCustomer = await pool.query(
      `
        update users
           set plan = $1,
               stripe_subscription_id = $2,
               stripe_subscription_status = $3,
               stripe_current_period_end = $4
         where stripe_customer_id = $5
         returning id
      `,
      [plan, subscriptionId || null, status || null, periodEnd, customerId]
    );
    if (updatedByCustomer.rows[0]?.id) return String(updatedByCustomer.rows[0].id);
  }

  if (!userId) return null;
  const updatedById = await pool.query(
    `
      update users
         set plan = $1,
             stripe_customer_id = coalesce(stripe_customer_id, $2),
             stripe_subscription_id = $3,
             stripe_subscription_status = $4,
             stripe_current_period_end = $5
       where id = $6
       returning id
    `,
    [plan, customerId || null, subscriptionId || null, status || null, periodEnd, userId]
  );
  if (updatedById.rows[0]?.id) return String(updatedById.rows[0].id);
  return null;
}

app.post("/api/billing/create-checkout-session", requireAuth, strictAuthLimiter, async (req, res) => {
  const stripe = getStripeClient();
  const priceId = getStripePriceId();
  if (!stripe || !priceId) {
    return res.status(503).json({ error: "Billing is not configured" });
  }

  try {
    const pool = getPool();
    const found = await pool.query("select email, stripe_customer_id from users where id = $1", [req.user.id]);
    const row = found.rows[0];
    if (!row) return res.status(401).json({ error: "Unauthorized" });

    const customerId = await ensureStripeCustomerId(pool, stripe, {
      userId: req.user.id,
      email: row.email,
      existingCustomerId: row.stripe_customer_id
    });

    const baseUrl = getAppBaseUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: String(req.user.id),
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { user_id: String(req.user.id) }
      },
      success_url: `${baseUrl}/account.html?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/account.html?billing=cancel`
    });

    if (!session.url) return res.status(500).json({ error: "Failed to create checkout session" });
    res.json({ url: session.url });
  } catch (err) {
    const message = String(err?.message || "");
    if (message.startsWith("Missing required env var:")) {
      return res.status(500).json({ error: message });
    }
    const dbMessage = formatDbError(err);
    if (dbMessage) return res.status(500).json({ error: dbMessage });
    console.error(err);
    res.status(500).json({ error: "Failed to start checkout" });
  }
});

app.post("/api/billing/create-portal-session", requireAuth, strictAuthLimiter, async (req, res) => {
  const stripe = getStripeClient();
  if (!stripe) return res.status(503).json({ error: "Billing is not configured" });

  try {
    const pool = getPool();
    const found = await pool.query("select stripe_customer_id from users where id = $1", [req.user.id]);
    const row = found.rows[0];
    if (!row) return res.status(401).json({ error: "Unauthorized" });
    const customerId = row.stripe_customer_id;
    if (!customerId) return res.status(400).json({ error: "No billing customer for this account" });

    const baseUrl = getAppBaseUrl(req);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/account.html`
    });

    res.json({ url: session.url });
  } catch (err) {
    const dbMessage = formatDbError(err);
    if (dbMessage) return res.status(500).json({ error: dbMessage });
    console.error(err);
    res.status(500).json({ error: "Failed to open billing portal" });
  }
});

app.post("/api/billing/confirm-checkout", requireAuth, strictAuthLimiter, async (req, res) => {
  const stripe = getStripeClient();
  if (!stripe) return res.status(503).json({ error: "Billing is not configured" });

  const sessionId = String(req.body?.sessionId || "").trim();
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"]
    });

    const expectedUserId = String(req.user.id);
    if (String(session.client_reference_id || "") !== expectedUserId) {
      return res.status(403).json({ error: "Session does not belong to this user" });
    }

    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer && typeof session.customer === "object"
        ? session.customer.id
        : null;
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription && typeof session.subscription === "object"
        ? session.subscription.id
        : null;

    if (!customerId || !subscriptionId) {
      return res.status(400).json({ error: "Checkout session is missing subscription details" });
    }

    const subscription =
      typeof session.subscription === "string"
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;

    const pool = getPool();
    await applyStripeSubscriptionToUser(pool, {
      userId: expectedUserId,
      customerId,
      subscriptionId,
      status: subscription?.status,
      currentPeriodEnd: subscription?.current_period_end
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to confirm checkout" });
  }
});

app.post("/api/billing/webhook", async (req, res) => {
  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();
  if (!stripe || !webhookSecret) return res.status(404).send("Not found");

  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") return res.status(400).send("Missing stripe-signature");

  const rawBody = req.rawBody;
  if (!rawBody) return res.status(400).send("Missing raw body");

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", String(err?.message || err));
    return res.status(400).send("Invalid signature");
  }

  try {
    const pool = getPool();

    if (event.type === "checkout.session.completed") {
      const session = event.data?.object;
      const customerId =
        typeof session?.customer === "string"
          ? session.customer
          : session?.customer && typeof session.customer === "object"
          ? session.customer.id
          : null;
      const subscriptionId =
        typeof session?.subscription === "string"
          ? session.subscription
          : session?.subscription && typeof session.subscription === "object"
          ? session.subscription.id
          : null;
      const userId = parseNumericId(session?.client_reference_id);

      if (customerId && subscriptionId) {
        const subscription =
          typeof session.subscription === "string"
            ? await stripe.subscriptions.retrieve(session.subscription)
            : session.subscription;
        await applyStripeSubscriptionToUser(pool, {
          userId,
          customerId,
          subscriptionId,
          status: subscription?.status,
          currentPeriodEnd: subscription?.current_period_end
        });
      } else {
        console.warn("Stripe webhook checkout.session.completed missing customer/subscription");
      }

      return res.json({ received: true });
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data?.object;
      const customerId =
        typeof subscription?.customer === "string"
          ? subscription.customer
          : subscription?.customer && typeof subscription.customer === "object"
          ? subscription.customer.id
          : null;
      const userId = parseNumericId(subscription?.metadata?.user_id);

      if (!customerId) {
        console.warn("Stripe subscription webhook missing customer");
        return res.json({ received: true });
      }

      const applied = await applyStripeSubscriptionToUser(pool, {
        userId,
        customerId,
        subscriptionId: subscription?.id,
        status: subscription?.status,
        currentPeriodEnd: subscription?.current_period_end
      });

      if (!applied) {
        try {
          const customer = await stripe.customers.retrieve(customerId);
          const fallbackUserId = parseNumericId(customer?.metadata?.user_id);
          if (fallbackUserId) {
            await applyStripeSubscriptionToUser(pool, {
              userId: fallbackUserId,
              customerId,
              subscriptionId: subscription?.id,
              status: subscription?.status,
              currentPeriodEnd: subscription?.current_period_end
            });
          } else {
            console.warn("Stripe webhook could not map customer to a user", customerId);
          }
        } catch (err) {
          console.warn("Stripe webhook customer lookup failed:", String(err?.message || err));
        }
      }

      return res.json({ received: true });
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook handler failed:", err);
    res.status(500).send("Webhook handler failed");
  }
});

app.post("/api/auth/change-password", requireAuth, strictAuthLimiter, async (req, res) => {
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

app.post("/api/auth/request-reset", strictAuthLimiter, async (req, res) => {
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

app.post("/api/auth/reset-password", strictAuthLimiter, async (req, res) => {
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

app.post("/api/auth/request-verify", requireAuth, strictAuthLimiter, async (req, res) => {
  try {
    const pool = getPool();
    const found = await pool.query("select id, email, email_verified from users where id = $1", [
      req.user.id
    ]);
    const user = found.rows[0];
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (user.email_verified) return res.json({ ok: true, alreadyVerified: true });
    if (!user.email) return res.json({ ok: true });

    const verification = await requestEmailVerificationCode(req, pool, user.id, user.email);
    if (shouldRevealTokens()) return res.json({ ok: true, ...verification });
    res.json({ ok: true, emailSent: verification.emailSent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Request verify failed" });
  }
});

async function verifyEmailToken(token, options = {}) {
  const value = String(token || "").trim();
  if (!value) return { ok: false, error: "Token required" };

  try {
    const pool = getPool();
    const tokenHash = hashToken(value);
    const isShortCode = isLikelyShortVerificationCode(value);
    const userId = options?.userId;

    if (isShortCode && !userId) return { ok: false, error: "Code requires login" };

    const params = [tokenHash];
    let userFilter = "";
    if (userId) {
      params.push(userId);
      userFilter = "and user_id = $2";
    }
    const tokenRow = await pool.query(
      `
        select id, user_id
        from auth_tokens
        where kind = 'email_verify'
          and token_hash = $1
          ${userFilter}
          and used_at is null
          and expires_at > now()
        order by created_at desc
        limit 1
      `,
      params
    );
    const row = tokenRow.rows[0];
    if (!row) return { ok: false, error: isShortCode ? "Invalid code" : "Invalid token" };

    await pool.query("begin");
    await pool.query("update users set email_verified = true where id = $1", [row.user_id]);
    await pool.query("update auth_tokens set used_at = now() where id = $1", [row.id]);
    await pool.query("commit");
    return { ok: true };
  } catch (err) {
    try {
      await getPool().query("rollback");
    } catch {}
    console.error(err);
    return { ok: false, error: "Verify email failed" };
  }
}

app.post("/api/auth/verify-email", strictAuthLimiter, async (req, res) => {
  const token = String(req.body?.token || "");
  const result = await verifyEmailToken(token, { userId: req.user?.id });
  if (!result.ok) {
    const status = result.error === "Verify email failed" ? 500 : 400;
    return res.status(status).json({ error: result.error });
  }
  res.json({ ok: true });
});

app.get("/api/auth/verify-email", strictAuthLimiter, async (req, res) => {
  const token = String(req.query?.token || "");
  const result = await verifyEmailToken(token);
  const baseUrl = getAppBaseUrl(req);
  if (!result.ok) {
    return res.redirect(`${baseUrl}/account.html?verify=error`);
  }
  res.redirect(`${baseUrl}/account.html?verify=ok`);
});

app.get("/api/state", requireAuth, requirePremiumSync, async (req, res) => {
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

app.put("/api/state", requireAuth, requirePremiumSync, async (req, res) => {
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

app.get("/api/state/versions", requireAuth, requirePremiumSync, async (req, res) => {
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

app.post("/api/state/restore", requireAuth, requirePremiumSync, async (req, res) => {
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
