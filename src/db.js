const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl:
    process.env.DB_SSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
});

async function query(text, params) {
  return pool.query(text, params);
}

async function waitForDb(retries = 30, delayMs = 2000) {
  for (let i = 0; i < retries; i += 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      console.log(
        `Waiting for database... (${i + 1}/${retries}): ${err.message}`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Database is not available");
}

module.exports = { pool, query, waitForDb };
