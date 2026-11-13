/**
 * Gestion centralisée des erreurs.
 * Toutes les erreurs ont le même format JSON :
 *   { "status": 404, "message": "Tournoi introuvable" }
 *   { "status": 400, "message": "Données invalides", "details": ["\"name\" est obligatoire"] }
 */
const { ApiError } = require('../utils/http');

// Route inexistante -> 404 JSON (et non la page HTML par défaut d'Express)
function notFound(req, res, next) {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} introuvable`));
}

// Traduit les erreurs techniques (JSON mal formé, MySQL) en codes HTTP corrects
function toApiError(err) {
  if (err instanceof ApiError) return err;

  // JSON mal formé dans le body, ex. {"name": }
  if (err.type === 'entity.parse.failed') {
    return new ApiError(400, 'Le corps de la requête n\'est pas un JSON valide');
  }

  switch (err.code) {
    case 'ER_DUP_ENTRY':
      return new ApiError(409, 'Cette ressource existe déjà (doublon)');
    case 'ER_NO_REFERENCED_ROW_2': {
      // ex. "... FOREIGN KEY (`team1_id`) REFERENCES `team` ..."
      const m = /FOREIGN KEY \(`(\w+)`\)/.exec(err.sqlMessage || '');
      const field = m ? `"${m[1]}"` : 'Un identifiant';
      return new ApiError(400, `${field} fait référence à une ressource inexistante`);
    }
    case 'ER_ROW_IS_REFERENCED_2':
      return new ApiError(409, 'Suppression impossible : la ressource est utilisée ailleurs (ex. une équipe présente dans un match)');
    case 'ECONNREFUSED':
    case 'PROTOCOL_CONNECTION_LOST':
    case 'ER_ACCESS_DENIED_ERROR':
    case 'ER_BAD_DB_ERROR':
      return new ApiError(503, 'Base de données indisponible. Réessayez plus tard.');
    default:
      return null; // erreur imprévue -> 500
  }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const apiErr = toApiError(err);

  if (!apiErr) {
    // On logue le détail côté serveur, mais on ne l'envoie PAS au client
    // (ne jamais exposer une requête SQL ou une stack trace).
    console.error('❌ Erreur serveur:', err);
    return res.status(500).json({ status: 500, message: 'Erreur interne du serveur' });
  }

  const body = { status: apiErr.status, message: apiErr.message };
  if (apiErr.details) body.details = apiErr.details;
  res.status(apiErr.status).json(body);
}

module.exports = { notFound, errorHandler };
