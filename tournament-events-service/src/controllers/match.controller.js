const db = require('../config/db');
const { ApiError, asyncHandler, parseId } = require('../utils/http');
const { validate, ensureSomeField } = require('../utils/validate');
const { matchSchema, scoreSchema } = require('../validators/schemas');
const { publish } = require('../messaging/publisher');

// Requête de lecture "enrichie" : noms des équipes et du tour
const SELECT_MATCH = `
  SELECT m.*,
         t1.name AS team1_name,
         t2.name AS team2_name,
         r.name  AS round_name,
         r.tournament_id
    FROM matches m
    JOIN team  t1 ON t1.id = m.team1_id
    JOIN team  t2 ON t2.id = m.team2_id
    JOIN round r  ON r.id  = m.round_id`;

async function findById(id) {
  const [rows] = await db.query(`${SELECT_MATCH} WHERE m.id = ?`, [id]);
  if (rows.length === 0) throw new ApiError(404, `Match ${id} introuvable`);
  return rows[0];
}

function checkTeams({ team1_id, team2_id }) {
  if (team1_id === team2_id) {
    throw new ApiError(400, 'Données invalides', ['"team1_id" et "team2_id" doivent être différents']);
  }
}

async function save(id, d) {
  await db.query(
    'UPDATE matches SET date = ?, score = ?, status = ?, round_id = ?, team1_id = ?, team2_id = ? WHERE id = ?',
    [d.date, d.score, d.status, d.round_id, d.team1_id, d.team2_id, id]
  );
}

// GET /api/matches  (filtre optionnel ?tournament_id=1)  -> 200
const getAll = asyncHandler(async (req, res) => {
  const params = [];
  let where = '';
  if (req.query.tournament_id !== undefined) {
    where = ' WHERE r.tournament_id = ?';
    params.push(parseId(req.query.tournament_id, 'tournament_id'));
  }
  const [rows] = await db.query(`${SELECT_MATCH}${where} ORDER BY m.id DESC`, params);
  res.json(rows);
});

// GET /api/matches/:id  -> 200 | 404
const getById = asyncHandler(async (req, res) => {
  res.json(await findById(parseId(req.params.id)));
});

// POST /api/matches  -> 201 | 400 (champs ou références invalides)
const create = asyncHandler(async (req, res) => {
  const d = validate(req.body, matchSchema);
  checkTeams(d);
  const [result] = await db.query(
    'INSERT INTO matches (date, score, status, round_id, team1_id, team2_id) VALUES (?, ?, ?, ?, ?, ?)',
    [d.date, d.score, d.status, d.round_id, d.team1_id, d.team2_id]
  );
  const created = await findById(result.insertId);
  publish('match.updated', created);
  res.status(201).location(`${req.baseUrl}/${created.id}`).json(created);
});

// PUT /api/matches/:id  -> 200 | 400 | 404
const replace = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await findById(id);
  const d = validate(req.body, matchSchema);
  checkTeams(d);
  await save(id, d);
  const updated = await findById(id);
  publish('match.updated', updated);
  res.json(updated);
});

// PATCH /api/matches/:id  -> 200 | 400 | 404
const patch = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const existing = await findById(id);
  ensureSomeField(req.body, matchSchema);
  const d = validate({ ...existing, ...req.body }, matchSchema);
  checkTeams(d);
  await save(id, d);
  const updated = await findById(id);
  publish('match.updated', updated);
  res.json(updated);
});

// PATCH /api/matches/:id/score  { score, status? }  -> 200 | 400 | 404
// Raccourci conservé pour la compatibilité : équivalent à PATCH /api/matches/:id
const updateScore = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await findById(id);
  const { score, status } = validate(req.body, scoreSchema);
  await db.query('UPDATE matches SET score = ?, status = ? WHERE id = ?', [score, status, id]);
  const updated = await findById(id);
  publish('match.updated', updated); // ex. consommé par stats-service (classement)
  res.json(updated);
});

// DELETE /api/matches/:id  -> 204 | 404
const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const match = await findById(id);
  await db.query('DELETE FROM matches WHERE id = ?', [id]);
  publish('match.deleted', { id, tournament_id: match.tournament_id });
  res.status(204).end();
});

module.exports = { getAll, getById, create, replace, patch, updateScore, remove };
