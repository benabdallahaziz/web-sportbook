/**
 * Utilisateur courant et règles d'autorisation du circuit de validation.
 *
 * identity-user-service ne délivre pas encore de jeton JWT : le front envoie
 * l'utilisateur connecté dans deux en-têtes HTTP (transmis par la Gateway) :
 *   X-User-Id:    12
 *   X-User-Roles: SPORTIF            (ou "ADMIN", "GERANT,ADMIN"...)
 * Avec JWT, ces informations seraient lues dans le jeton signé, ce qui
 * empêcherait un client de les falsifier. Les règles ci-dessous resteraient
 * identiques : seul currentUser() changerait.
 *
 * Règles :
 *   - un ADMIN crée directement des éléments validés et peut tout faire ;
 *   - un utilisateur crée des propositions « en attente » (PENDING) et ne
 *     peut modifier / supprimer que SES propositions non encore validées ;
 *   - seul un ADMIN valide, refuse, saisit les scores, confirme les inscriptions.
 */
const { ApiError } = require('./http');

const APPROVAL = { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' };

function currentUser(req) {
  const id = Number(req.get('X-User-Id'));
  const roles = String(req.get('X-User-Roles') || '')
    .split(',')
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);
  return { id: Number.isInteger(id) && id > 0 ? id : null, roles, isAdmin: roles.includes('ADMIN') };
}

const isOwner = (user, row) => user.id !== null && row.created_by !== null && Number(row.created_by) === user.id;

/** Un élément est visible s'il est validé, si on en est l'auteur, ou si on est admin. */
function canSee(user, row) {
  return user.isAdmin || row.approval_status === APPROVAL.APPROVED || isOwner(user, row);
}

/** Clause SQL équivalente à canSee() pour les listes. */
function visibilityClause(user, alias) {
  if (user.isAdmin) return { sql: '', params: [] };
  return { sql: `(${alias}.approval_status = 'APPROVED' OR ${alias}.created_by = ?)`, params: [user.id ?? 0] };
}

function assertAdmin(user) {
  if (!user.isAdmin) throw new ApiError(403, 'Action réservée à un administrateur');
}

/** Modifier / supprimer : admin, ou auteur tant que ce n'est pas validé. */
function assertCanModify(user, row, label) {
  if (user.isAdmin) return;
  if (!isOwner(user, row)) throw new ApiError(403, `Vous ne pouvez modifier que vos propres propositions (${label})`);
  if (row.approval_status === APPROVAL.APPROVED) {
    throw new ApiError(403, `${label} déjà validé(e) : seul un administrateur peut le modifier`);
  }
}

/**
 * Équipes : pas de validation, mais seul leur propriétaire (ou un admin) peut
 * les modifier, les supprimer, les inscrire ou les désinscrire d'un tournoi.
 * Les équipes créées avant cette règle (created_by NULL) relèvent de l'admin.
 */
function assertTeamOwner(user, team, action = 'modifier') {
  if (user.isAdmin || isOwner(user, team)) return;
  throw new ApiError(403, `Vous ne pouvez ${action} que vos propres équipes`);
}

/** Statut de validation d'un nouvel élément selon son auteur. */
const initialApproval = (user) => (user.isAdmin ? APPROVAL.APPROVED : APPROVAL.PENDING);

module.exports = {
  APPROVAL, currentUser, isOwner, canSee, visibilityClause, assertAdmin, assertCanModify, assertTeamOwner, initialApproval,
};
