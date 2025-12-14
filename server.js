import express from "express";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
app.get("/study-confidence-table.html", (_req, res) =>
  sendHtml(res, "study-confidence-table.html")
);

// Health check
app.get("/healthz", (_req, res) => res.send("ok"));

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
