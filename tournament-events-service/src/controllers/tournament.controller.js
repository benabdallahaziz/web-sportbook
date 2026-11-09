const db = require('../config/db');
const { ApiError, asyncHandler, parseId } = require('../utils/http');
const { validate, ensureSomeField } = require('../utils/validate');
const {
  tournamentSchema, roundSchema, registrationSchema, approvalSchema, registrationDecisionSchema,
} = require('../validators/schemas');
const { publish } = require('../messaging/publisher');
const {
  APPROVAL, currentUser, isOwner, canSee, visibilityClause, assertAdmin, assertCanModify, assertTeamOwner, initialApproval,
} = require('../utils/auth');

// ─── Accès aux données ───────────────────────────────────────────────────────

async function findById(id) {
  const [rows] = await db.query('SELECT * FROM tournament WHERE id = ?', [id]);
  if (rows.length === 0) throw new ApiError(404, `Tournoi ${id} introuvable`);
  return rows[0];
}

/** Comme findById, mais 404 si le tournoi est une proposition d'un autre utilisateur. */
async function findVisible(id, user) {
  const t = await findById(id);
  if (!canSee(user, t)) throw new ApiError(404, `Tournoi ${id} introuvable`);
  return t;
}

function checkDates({ start_date, end_date }) {
  if (start_date && end_date && end_date < start_date) {
    throw new ApiError(400, 'Données invalides', ['"end_date" doit être postérieure ou égale à "start_date"']);
  }
}

/**
 * Enregistre les champs modifiables. Si l'auteur modifie une proposition
 * refusée, elle repart en attente de validation (nouvelle soumission).
 */
async function save(id, data, existing, user) {
  const resubmit = !user.isAdmin && existing.approval_status === APPROVAL.REJECTED;
  await db.query(
    `UPDATE tournament SET name = ?, start_date = ?, end_date = ?, status = ?
       ${resubmit ? ", approval_status = 'PENDING', rejection_reason = NULL" : ''}
     WHERE id = ?`,
    [data.name, data.start_date, data.end_date, data.status, id]
  );
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

// GET /api/tournaments[?approval=PENDING]  -> 200
// Admin : tout. Utilisateur : tournois validés + ses propres propositions.
const getAll = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const where = [];
  const params = [];
  const vis = visibilityClause(user, 't');
  if (vis.sql) { where.push(vis.sql); params.push(...vis.params); }
  if (req.query.approval) {
    const approval = String(req.query.approval).toUpperCase();
    if (!APPROVAL[approval]) throw new ApiError(400, 'Le filtre "approval" doit valoir PENDING, APPROVED ou REJECTED');
    where.push('t.approval_status = ?');
    params.push(approval);
  }
  const [rows] = await db.query(
    `SELECT t.* FROM tournament t ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY t.id DESC`,
    params
  );
  res.json(rows);
});

// GET /api/tournaments/:id  -> 200 | 404
const getById = asyncHandler(async (req, res) => {
  res.json(await findVisible(parseId(req.params.id), currentUser(req)));
});

// POST /api/tournaments  -> 201 (APPROVED si admin, PENDING sinon) | 400
const create = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const data = validate(req.body, tournamentSchema);
  checkDates(data);
  const [result] = await db.query(
    'INSERT INTO tournament (name, start_date, end_date, status, approval_status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    [data.name, data.start_date, data.end_date, data.status, initialApproval(user), user.id]
  );
  const created = await findById(result.insertId);
  res.status(201).location(`${req.baseUrl}/${created.id}`).json(created);
});

// PUT /api/tournaments/:id  -> 200 | 400 | 403 | 404
const replace = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const id = parseId(req.params.id);
  const existing = await findVisible(id, user);
  assertCanModify(user, existing, 'Tournoi');
  const data = validate(req.body, tournamentSchema);
  checkDates(data);
  await save(id, data, existing, user);
  res.json(await findById(id));
});

// PATCH /api/tournaments/:id  -> 200 | 400 | 403 | 404
const patch = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const id = parseId(req.params.id);
  const existing = await findVisible(id, user);
  assertCanModify(user, existing, 'Tournoi');
  ensureSomeField(req.body, tournamentSchema);
  const data = validate({ ...existing, ...req.body }, tournamentSchema);
  checkDates(data);
  await save(id, data, existing, user);
  res.json(await findById(id));
});

// DELETE /api/tournaments/:id  -> 204 | 403 | 404
const remove = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const id = parseId(req.params.id);
  const existing = await findVisible(id, user);
  assertCanModify(user, existing, 'Tournoi');
  await db.query('DELETE FROM tournament WHERE id = ?', [id]);
  publish('tournament.deleted', { id }); // ses matchs ont été supprimés en cascade
  res.status(204).end();
});

// PATCH /api/tournaments/:id/approval  { decision, reason? }  -> 200 | 400 | 403 | 404
// Validation (ou refus) d'une proposition par l'administrateur.
const decide = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  assertAdmin(user);
  const id = parseId(req.params.id);
  await findById(id);
  const { decision, reason } = validate(req.body, approvalSchema);
  await db.query(
    'UPDATE tournament SET approval_status = ?, rejection_reason = ? WHERE id = ?',
    [decision, decision === APPROVAL.REJECTED ? reason : null, id]
  );
  res.json(await findById(id));
});

// ─── Sous-ressource : équipes inscrites (/api/tournaments/:id/teams) ────────

// GET /api/tournaments/:id/teams  -> 200 | 404
const getTournamentTeams = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await findVisible(id, currentUser(req));
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
// L'inscription part « en attente » ; l'admin la confirme. Un admin qui inscrit confirme directement.
const registerTeam = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const id = parseId(req.params.id);
  const tournament = await findVisible(id, user);
  if (tournament.approval_status !== APPROVAL.APPROVED) {
    throw new ApiError(409, 'Les inscriptions ouvrent quand le tournoi a été validé par un administrateur');
  }
  const { team_id } = validate(req.body, registrationSchema);
  const [team] = await db.query('SELECT * FROM team WHERE id = ?', [team_id]);
  if (team.length === 0) throw new ApiError(400, `L'équipe ${team_id} n'existe pas`);
  assertTeamOwner(user, team[0], 'inscrire');

  const today = new Date().toISOString().slice(0, 10);
  const status = user.isAdmin ? 'CONFIRMED' : 'PENDING';
  try {
    const [result] = await db.query(
      'INSERT INTO registration (registration_date, status, tournament_id, team_id) VALUES (?, ?, ?, ?)',
      [today, status, id, team_id]
    );
    res.status(201).location(`${req.baseUrl}/${id}/teams/${team_id}`).json({
      id: result.insertId, tournament_id: id, team_id, registration_date: today, status,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new ApiError(409, 'Cette équipe est déjà inscrite à ce tournoi');
    throw err;
  }
});

// PATCH /api/tournaments/:id/teams/:teamId  { status: CONFIRMED | REJECTED }  -> 200 | 403 | 404
const decideRegistration = asyncHandler(async (req, res) => {
  assertAdmin(currentUser(req));
  const id = parseId(req.params.id);
  const teamId = parseId(req.params.teamId, 'teamId');
  const { status } = validate(req.body, registrationDecisionSchema);
  const [result] = await db.query(
    'UPDATE registration SET status = ? WHERE tournament_id = ? AND team_id = ?', [status, id, teamId]
  );
  if (result.affectedRows === 0) throw new ApiError(404, `L'équipe ${teamId} n'est pas inscrite au tournoi ${id}`);
  res.json({ tournament_id: id, team_id: teamId, status });
});

// GET /api/tournaments/registrations?status=PENDING  -> 200 | 403   (file d'attente de l'admin)
const listRegistrations = asyncHandler(async (req, res) => {
  assertAdmin(currentUser(req));
  const status = String(req.query.status || 'PENDING').toUpperCase();
  const [rows] = await db.query(
    `SELECT r.id, r.tournament_id, tr.name AS tournament_name, r.team_id, t.name AS team_name,
            t.members, r.registration_date, r.status
       FROM registration r
       JOIN team t        ON t.id  = r.team_id
       JOIN tournament tr ON tr.id = r.tournament_id
      WHERE r.status = ?
      ORDER BY r.registration_date, r.id`,
    [status]
  );
  res.json(rows);
});

// DELETE /api/tournaments/:id/teams/:teamId  -> 204 | 403 | 404   (propriétaire de l'équipe ou admin)
const unregisterTeam = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const id = parseId(req.params.id);
  const teamId = parseId(req.params.teamId, 'teamId');
  await findVisible(id, user);
  const [team] = await db.query('SELECT * FROM team WHERE id = ?', [teamId]);
  if (team.length) assertTeamOwner(user, team[0], 'désinscrire');
  const [result] = await db.query(
    'DELETE FROM registration WHERE tournament_id = ? AND team_id = ?', [id, teamId]
  );
  if (result.affectedRows === 0) throw new ApiError(404, `L'équipe ${teamId} n'est pas inscrite au tournoi ${id}`);
  res.status(204).end();
});

// ─── Sous-ressource : tours (/api/tournaments/:id/rounds) ───────────────────

// GET /api/tournaments/:id/rounds  -> 200 | 404
const getRounds = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await findVisible(id, currentUser(req));
  const [rows] = await db.query(
    'SELECT * FROM round WHERE tournament_id = ? ORDER BY round_order', [id]
  );
  res.json(rows);
});

// POST /api/tournaments/:id/rounds  { name, round_order }  -> 201 | 400 | 403 | 404
// Le tour est créé par l'admin ou par l'auteur du tournoi (organisateur).
const createRound = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const id = parseId(req.params.id);
  const tournament = await findVisible(id, user);
  if (!user.isAdmin && !isOwner(user, tournament)) {
    throw new ApiError(403, 'Seul l’organisateur du tournoi ou un administrateur peut ajouter un tour');
  }
  const data = validate(req.body, roundSchema);
  const [result] = await db.query(
    'INSERT INTO round (name, round_order, tournament_id) VALUES (?, ?, ?)',
    [data.name, data.round_order, id]
  );
  res.status(201).json({ id: result.insertId, ...data, tournament_id: id });
});

module.exports = {
  getAll, getById, create, replace, patch, remove, decide,
  getTournamentTeams, registerTeam, decideRegistration, listRegistrations, unregisterTeam,
  getRounds, createRound,
};
