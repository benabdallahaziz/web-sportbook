const db = require('../config/db');
const { ApiError, asyncHandler, parseId } = require('../utils/http');
const { validate, ensureSomeField } = require('../utils/validate');
const { matchSchema, scoreSchema, approvalSchema } = require('../validators/schemas');
const { publish } = require('../messaging/publisher');
const {
  APPROVAL, currentUser, isOwner, canSee, visibilityClause, assertAdmin, assertCanModify, initialApproval,
} = require('../utils/auth');

// Requête de lecture "enrichie" : noms des équipes, du tour et du tournoi
const SELECT_MATCH = `
  SELECT m.*,
         t1.name AS team1_name,
         t2.name AS team2_name,
         r.name  AS round_name,
         r.tournament_id,
         tr.name AS tournament_name
    FROM matches m
    JOIN team  t1 ON t1.id = m.team1_id
    JOIN team  t2 ON t2.id = m.team2_id
    JOIN round r  ON r.id  = m.round_id
    JOIN tournament tr ON tr.id = r.tournament_id`;

async function findById(id) {
  const [rows] = await db.query(`${SELECT_MATCH} WHERE m.id = ?`, [id]);
  if (rows.length === 0) throw new ApiError(404, `Match ${id} introuvable`);
  return rows[0];
}

async function findVisible(id, user) {
  const m = await findById(id);
  if (!canSee(user, m)) throw new ApiError(404, `Match ${id} introuvable`);
  return m;
}

function checkTeams({ team1_id, team2_id }) {
  if (team1_id === team2_id) {
    throw new ApiError(400, 'Données invalides', ['"team1_id" et "team2_id" doivent être différents']);
  }
}

/**
 * Un match se planifie dans un tournoi validé, ou dans son propre tournoi
 * (encore en attente). Le tour doit exister (sinon 400).
 */
async function checkRound(roundId, user) {
  const [rows] = await db.query(
    `SELECT tr.* FROM round r JOIN tournament tr ON tr.id = r.tournament_id WHERE r.id = ?`, [roundId]
  );
  if (rows.length === 0 || !canSee(user, rows[0])) {
    throw new ApiError(400, 'Données invalides', ['"round_id" fait référence à une ressource inexistante']);
  }
  const tournament = rows[0];
  if (!user.isAdmin && tournament.approval_status !== APPROVAL.APPROVED && !isOwner(user, tournament)) {
    throw new ApiError(409, 'Ce tournoi n’est pas encore validé : impossible d’y planifier un match');
  }
}

/** Un utilisateur planifie : le score et le statut final sont réservés à l'admin. */
function restrictForUser(d, user, existing) {
  if (user.isAdmin) return d;
  return { ...d, score: existing ? existing.score : null, status: existing ? existing.status : 'SCHEDULED' };
}

async function save(id, d, existing, user) {
  const resubmit = !user.isAdmin && existing.approval_status === APPROVAL.REJECTED;
  await db.query(
    `UPDATE matches SET date = ?, score = ?, status = ?, round_id = ?, team1_id = ?, team2_id = ?
       ${resubmit ? ", approval_status = 'PENDING', rejection_reason = NULL" : ''}
     WHERE id = ?`,
    [d.date, d.score, d.status, d.round_id, d.team1_id, d.team2_id, id]
  );
}

// GET /api/matches  (?tournament_id=1, ?approval=PENDING)  -> 200
// Admin : tout. Utilisateur : matchs validés + ses propres propositions.
const getAll = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const where = [];
  const params = [];
  const vis = visibilityClause(user, 'm');
  if (vis.sql) { where.push(vis.sql); params.push(...vis.params); }
  if (req.query.tournament_id !== undefined) {
    where.push('r.tournament_id = ?');
    params.push(parseId(req.query.tournament_id, 'tournament_id'));
  }
  if (req.query.approval) {
    const approval = String(req.query.approval).toUpperCase();
    if (!APPROVAL[approval]) throw new ApiError(400, 'Le filtre "approval" doit valoir PENDING, APPROVED ou REJECTED');
    where.push('m.approval_status = ?');
    params.push(approval);
  }
  const [rows] = await db.query(
    `${SELECT_MATCH} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY m.id DESC`, params
  );
  res.json(rows);
});

// GET /api/matches/:id  -> 200 | 404
const getById = asyncHandler(async (req, res) => {
  res.json(await findVisible(parseId(req.params.id), currentUser(req)));
});

// POST /api/matches  -> 201 (APPROVED si admin, PENDING sinon) | 400 | 409
const create = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const d = restrictForUser(validate(req.body, matchSchema), user);
  checkTeams(d);
  await checkRound(d.round_id, user);
  const [result] = await db.query(
    `INSERT INTO matches (date, score, status, round_id, team1_id, team2_id, approval_status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.date, d.score, d.status, d.round_id, d.team1_id, d.team2_id, initialApproval(user), user.id]
  );
  const created = await findById(result.insertId);
  publish('match.updated', created);
  res.status(201).location(`${req.baseUrl}/${created.id}`).json(created);
});

// PUT /api/matches/:id  -> 200 | 400 | 403 | 404
const replace = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const id = parseId(req.params.id);
  const existing = await findVisible(id, user);
  assertCanModify(user, existing, 'Match');
  const d = restrictForUser(validate(req.body, matchSchema), user, existing);
  checkTeams(d);
  await checkRound(d.round_id, user);
  await save(id, d, existing, user);
  const updated = await findById(id);
  publish('match.updated', updated);
  res.json(updated);
});

// PATCH /api/matches/:id  -> 200 | 400 | 403 | 404
const patch = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const id = parseId(req.params.id);
  const existing = await findVisible(id, user);
  assertCanModify(user, existing, 'Match');
  ensureSomeField(req.body, matchSchema);
  const d = restrictForUser(validate({ ...existing, ...req.body }, matchSchema), user, existing);
  checkTeams(d);
  if (d.round_id !== existing.round_id) await checkRound(d.round_id, user);
  await save(id, d, existing, user);
  const updated = await findById(id);
  publish('match.updated', updated);
  res.json(updated);
});

// PATCH /api/matches/:id/score  { score, status? }  -> 200 | 400 | 403 | 404 | 409
// Saisie du résultat : administrateur uniquement, sur un match validé.
const updateScore = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  assertAdmin(user);
  const id = parseId(req.params.id);
  const existing = await findById(id);
  if (existing.approval_status !== APPROVAL.APPROVED) {
    throw new ApiError(409, 'Ce match doit être validé avant de saisir son score');
  }
  const { score, status } = validate(req.body, scoreSchema);
  await db.query('UPDATE matches SET score = ?, status = ? WHERE id = ?', [score, status, id]);
  const updated = await findById(id);
  publish('match.updated', updated); // consommé par stats-service (classement)
  res.json(updated);
});

// PATCH /api/matches/:id/approval  { decision, reason? }  -> 200 | 400 | 403 | 404 | 409
const decide = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  assertAdmin(user);
  const id = parseId(req.params.id);
  const match = await findById(id);
  const { decision, reason } = validate(req.body, approvalSchema);
  if (decision === APPROVAL.APPROVED) {
    const [[tournament]] = await db.query('SELECT approval_status FROM tournament WHERE id = ?', [match.tournament_id]);
    if (tournament.approval_status !== APPROVAL.APPROVED) {
      throw new ApiError(409, 'Validez d’abord le tournoi de ce match');
    }
  }
  await db.query(
    'UPDATE matches SET approval_status = ?, rejection_reason = ? WHERE id = ?',
    [decision, decision === APPROVAL.REJECTED ? reason : null, id]
  );
  const updated = await findById(id);
  publish('match.updated', updated);
  res.json(updated);
});

// DELETE /api/matches/:id  -> 204 | 403 | 404
const remove = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const id = parseId(req.params.id);
  const match = await findVisible(id, user);
  assertCanModify(user, match, 'Match');
  await db.query('DELETE FROM matches WHERE id = ?', [id]);
  publish('match.deleted', { id, tournament_id: match.tournament_id });
  res.status(204).end();
});

module.exports = { getAll, getById, create, replace, patch, updateScore, decide, remove };
