const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

async function register(req, res) {
  const { email, password } = req.body || {};

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email is required" });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, created_at`,
      [email.toLowerCase().trim(), passwordHash]
    );
    const user = result.rows[0];
    return res.status(201).json({ id: user.id, email: user.email, createdAt: user.created_at });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Email already registered" });
    }
    throw err;
  }
}

async function login(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const result = await query(
    `SELECT id, email, password_hash FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { email: user.email },
    JWT_SECRET,
    { subject: String(user.id), expiresIn: "7d" }
  );

  return res.json({ token });
}

module.exports = { requireAuth, register, login };
