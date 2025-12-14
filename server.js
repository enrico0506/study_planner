import express from "express";
import pg from "pg";

const app = express();
const port = process.env.PORT || 10000;

app.use(express.static("public")); // serve static files from ./public

app.get("/healthz", (_req, res) => res.send("ok"));

app.get("/dbcheck", async (_req, res) => {
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

app.listen(port, "0.0.0.0", () => {
  console.log(`Listening on ${port}`);
});
