const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yaml");
const { waitForDb, query } = require("./db");
const { requireAuth, register, login } = require("./auth");
const {
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
} = require("./notes");

const PORT = Number(process.env.PORT || 8080);
const app = express();

app.use(cors());
app.use(express.json());

const openapiPath = path.join(__dirname, "..", "openapi.yaml");
const openapiDoc = YAML.parse(fs.readFileSync(openapiPath, "utf8"));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));
app.get("/openapi.yaml", (_req, res) => {
  res.type("text/yaml").send(fs.readFileSync(openapiPath, "utf8"));
});

app.get("/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    return res.json({ status: "ok" });
  } catch (err) {
    return res.status(503).json({ status: "error", error: err.message });
  }
});

app.post("/auth/register", asyncHandler(register));
app.post("/auth/login", asyncHandler(login));

app.get("/notes", requireAuth, asyncHandler(listNotes));
app.post("/notes", requireAuth, asyncHandler(createNote));
app.get("/notes/:id", requireAuth, asyncHandler(getNote));
app.put("/notes/:id", requireAuth, asyncHandler(updateNote));
app.delete("/notes/:id", requireAuth, asyncHandler(deleteNote));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

async function start() {
  await waitForDb();
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Knowledge Notes API listening on :${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
