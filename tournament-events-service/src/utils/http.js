/**
 * Petits outils HTTP partagés par tous les contrôleurs.
 */

// Erreur "métier" qui porte son code HTTP (400, 404, 409...).
// Un contrôleur fait `throw new ApiError(404, 'Tournoi introuvable')`
// et le middleware d'erreurs (error.middleware.js) construit la réponse JSON.
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details; // ex. liste des champs invalides
  }
}

// Express 4 n'attrape pas les erreurs des fonctions async :
// ce wrapper les transmet à next(err) => un seul endroit gère les erreurs.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Vérifie qu'un paramètre d'URL (:id) est un entier positif.
// /api/teams/abc  -> 400 (requête mal formée) et non 500 ou 404.
function parseId(value, name = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, `Le paramètre "${name}" doit être un entier positif`);
  }
  return id;
}

module.exports = { ApiError, asyncHandler, parseId };
