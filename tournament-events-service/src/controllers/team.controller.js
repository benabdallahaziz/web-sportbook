const db = require('../config/db');
const { ApiError, asyncHandler, parseId } = require('../utils/http');
const { validate, ensureSomeField } = require('../utils/validate');
const { teamSchema } = require('../validators/schemas');

async function findById(id) {
  const [rows] = await db.query('SELECT * FROM team WHERE id = ?', [id]);
  if (rows.length === 0) throw new ApiError(404, `Équipe ${id} introuvable`);
  return rows[0];
}

async function save(id, data) {
  await db.query('UPDATE team SET name = ?, members = ? WHERE id = ?', [data.name, data.members, id]);
}

// GET /api/teams  -> 200
const getAll = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM team ORDER BY id DESC');
  res.json(rows);
});

// GET /api/teams/:id  -> 200 | 404
const getById = asyncHandler(async (req, res) => {
  res.json(await findById(parseId(req.params.id)));
});

// POST /api/teams  -> 201 | 400
const create = asyncHandler(async (req, res) => {
  const data = validate(req.body, teamSchema);
  const [result] = await db.query('INSERT INTO team (name, members) VALUES (?, ?)', [data.name, data.members]);
  const created = await findById(result.insertId);
  res.status(201).location(`${req.baseUrl}/${created.id}`).json(created);
});

// PUT /api/teams/:id  -> 200 | 400 | 404
const replace = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await findById(id);
  await save(id, validate(req.body, teamSchema));
  res.json(await findById(id));
});

// PATCH /api/teams/:id  -> 200 | 400 | 404
const patch = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const existing = await findById(id);
  ensureSomeField(req.body, teamSchema);
  await save(id, validate({ ...existing, ...req.body }, teamSchema));
  res.json(await findById(id));
});

// DELETE /api/teams/:id  -> 204 | 404 | 409 (équipe utilisée dans un match)
const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await findById(id);
  await db.query('DELETE FROM team WHERE id = ?', [id]);
  res.status(204).end();
});

module.exports = { getAll, getById, create, replace, patch, remove };
