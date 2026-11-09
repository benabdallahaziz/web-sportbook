const db = require('../config/db');
const { ApiError, asyncHandler, parseId } = require('../utils/http');
const { validate, ensureSomeField } = require('../utils/validate');
const { tournamentSchema, roundSchema, registrationSchema } = require('../validators/schemas');
const { publish } = require('../messaging/publisher');

// ─── Accès aux données ───────────────────────────────────────────────────────

async function findById(id) {
  const [rows] = await db.query('SELECT * FROM tournament WHERE id = ?', [id]);
  if (rows.length === 0) throw new ApiError(404, `Tournoi ${id} introuvable`);
  return rows[0];
}

function checkDates({ start_date, end_date }) {
  if (start_date && end_date && end_date < start_date) {
    throw new ApiError(400, 'Données invalides', ['"end_date" doit être postérieure ou égale à "start_date"']);
  }
}

async function save(id, data) {
  await db.query(
    'UPDATE tournament SET name = ?, start_date = ?, end_date = ?, status = ? WHERE id = ?',
    [data.name, data.start_date, data.end_date, data.status, id]
  );
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

// GET /api/tournaments  -> 200 + tableau
const getAll = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM tournament ORDER BY id DESC');
  res.json(rows);
});

// GET /api/tournaments/:id  -> 200 | 404
const getById = asyncHandler(async (req, res) => {
  res.json(await findById(parseId(req.params.id)));
});

// POST /api/tournaments  -> 201 + Location + ressource créée | 400
const create = asyncHandler(async (req, res) => {
  const data = validate(req.body, tournamentSchema);
  checkDates(data);
  const [result] = await db.query(
    'INSERT INTO tournament (name, start_date, end_date, status) VALUES (?, ?, ?, ?)',
    [data.name, data.start_date, data.end_date, data.status]
  );
  const created = await findById(result.insertId);
  res.status(201).location(`${req.baseUrl}/${created.id}`).json(created);
});

// PUT /api/tournaments/:id  -> remplacement COMPLET : 200 | 400 | 404
const replace = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await findById(id);                              // 404 si absent
  const data = validate(req.body, tournamentSchema); // tous les champs requis
  checkDates(data);
  await save(id, data);
  res.json(await findById(id));
});

// PATCH /api/tournaments/:id  -> modification PARTIELLE : 200 | 400 | 404
const patch = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const existing = await findById(id);
  ensureSomeField(req.body, tournamentSchema);
  // On fusionne l'existant et les champs envoyés, puis on valide le tout
  const data = validate({ ...existing, ...req.body }, tournamentSchema);
  checkDates(data);
  await save(id, data);
  res.json(await findById(id));
});

// DELETE /api/tournaments/:id  -> 204 (pas de corps) | 404
const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await findById(id);
  await db.query('DELETE FROM tournament WHERE id = ?', [id]);
  publish('tournament.deleted', { id }); // ses matchs ont été supprimés en cascade
  res.status(204).end();
});

// ─── Sous-ressource : équipes inscrites (/api/tournaments/:id/teams) ────────

// GET /api/tournaments/:id/teams  -> 200 | 404
const getTournamentTeams = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await findById(id);
  const [rows] = await db.query(
    `SELECT t.*, r.registration_date, r.status AS registration_status
       FROM team t
       JOIN registration r ON r.team_id = t.id
      WHERE r.tournament_id = ?
      ORDER BY t.name`,
    [id]
  );
  res.json(rows);
});

// POST /api/tournaments/:id/teams  { team_id }  -> 201 | 400 | 404 | 409
const registerTeam = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await findById(id);
  const { team_id } = validate(req.body, registrationSchema);
  const [team] = await db.query('SELECT id FROM team WHERE id = ?', [team_id]);
  if (team.length === 0) throw new ApiError(400, `L'équipe ${team_id} n'existe pas`);

  const today = new Date().toISOString().slice(0, 10);
  try {
    const [result] = await db.query(
      'INSERT INTO registration (registration_date, status, tournament_id, team_id) VALUES (?, ?, ?, ?)',
      [today, 'PENDING', id, team_id]
    );
    res.status(201).location(`${req.baseUrl}/${id}/teams/${team_id}`).json({
      id: result.insertId, tournament_id: id, team_id, registration_date: today, status: 'PENDING',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new ApiError(409, 'Cette équipe est déjà inscrite à ce tournoi');
    throw err;
  }
});

// DELETE /api/tournaments/:id/teams/:teamId  -> 204 | 404
const unregisterTeam = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const teamId = parseId(req.params.teamId, 'teamId');
  const [result] = await db.query(
    'DELETE FROM registration WHERE tournament_id = ? AND team_id = ?', [id, teamId]
  );
  if (result.affectedRows === 0) throw new ApiError(404, `L'équipe ${teamId} n'est pas inscrite au tournoi ${id}`);
  res.status(204).end();
});

// ─── Sous-ressource : tours (/api/tournaments/:id/rounds) ───────────────────
// Nécessaire pour créer des matchs (un match appartient à un tour).

// GET /api/tournaments/:id/rounds  -> 200 | 404
const getRounds = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await findById(id);
  const [rows] = await db.query(
    'SELECT * FROM round WHERE tournament_id = ? ORDER BY round_order', [id]
  );
  res.json(rows);
});

// POST /api/tournaments/:id/rounds  { name, round_order }  -> 201 | 400 | 404
const createRound = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await findById(id);
  const data = validate(req.body, roundSchema);
  const [result] = await db.query(
    'INSERT INTO round (name, round_order, tournament_id) VALUES (?, ?, ?)',
    [data.name, data.round_order, id]
  );
  res.status(201).json({ id: result.insertId, ...data, tournament_id: id });
});

module.exports = {
  getAll, getById, create, replace, patch, remove,
  getTournamentTeams, registerTeam, unregisterTeam,
  getRounds, createRound,
};
