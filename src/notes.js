const { query } = require("./db");

async function listNotes(req, res) {
  const result = await query(
    `SELECT id, title, body, created_at, updated_at
     FROM notes
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [req.user.id]
  );

  return res.json(
    result.rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }))
  );
}

async function getNote(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const result = await query(
    `SELECT id, title, body, created_at, updated_at
     FROM notes
     WHERE id = $1 AND user_id = $2`,
    [id, req.user.id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: "Note not found" });
  }

  const n = result.rows[0];
  return res.json({
    id: n.id,
    title: n.title,
    body: n.body,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  });
}

async function createNote(req, res) {
  const { title, body } = req.body || {};

  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }

  const result = await query(
    `INSERT INTO notes (user_id, title, body)
     VALUES ($1, $2, $3)
     RETURNING id, title, body, created_at, updated_at`,
    [req.user.id, title.trim(), typeof body === "string" ? body : ""]
  );

  const n = result.rows[0];
  return res.status(201).json({
    id: n.id,
    title: n.title,
    body: n.body,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  });
}

async function updateNote(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const { title, body } = req.body || {};
  const existing = await query(
    `SELECT id, title, body FROM notes WHERE id = $1 AND user_id = $2`,
    [id, req.user.id]
  );

  if (!existing.rows[0]) {
    return res.status(404).json({ error: "Note not found" });
  }

  const nextTitle =
    title !== undefined ? String(title).trim() : existing.rows[0].title;
  const nextBody =
    body !== undefined ? String(body) : existing.rows[0].body;

  if (!nextTitle) {
    return res.status(400).json({ error: "Title cannot be empty" });
  }

  const result = await query(
    `UPDATE notes
     SET title = $1, body = $2, updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING id, title, body, created_at, updated_at`,
    [nextTitle, nextBody, id, req.user.id]
  );

  const n = result.rows[0];
  return res.json({
    id: n.id,
    title: n.title,
    body: n.body,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  });
}

async function deleteNote(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const result = await query(
    `DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, req.user.id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: "Note not found" });
  }

  return res.status(204).send();
}

module.exports = {
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
};
