/**
 * Validation simple des corps de requête (sans bibliothèque externe).
 *
 * Un "schéma" décrit les champs autorisés d'une ressource :
 *   { name: { type: 'string', required: true, maxLength: 150 }, ... }
 *
 * validate(body, schema) :
 *   - renvoie un objet propre contenant UNIQUEMENT les champs du schéma
 *     (les champs inconnus sont ignorés => pas d'injection de colonnes)
 *   - applique les valeurs par défaut
 *   - lève une ApiError 400 avec la liste de toutes les erreurs trouvées
 */
const { ApiError } = require('./http');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

function checkField(field, value, rule, errors) {
  switch (rule.type) {
    case 'string': {
      if (typeof value !== 'string') { errors.push(`"${field}" doit être une chaîne de caractères`); return; }
      const v = value.trim();
      if (rule.required && v === '') { errors.push(`"${field}" ne peut pas être vide`); return; }
      if (rule.maxLength && v.length > rule.maxLength) { errors.push(`"${field}" ne doit pas dépasser ${rule.maxLength} caractères`); return; }
      if (rule.pattern && !rule.pattern.test(v)) { errors.push(`"${field}" ${rule.patternMessage || 'a un format invalide'}`); return; }
      return v;
    }
    case 'int': {
      const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      if (!Number.isInteger(n)) { errors.push(`"${field}" doit être un entier`); return; }
      if (rule.min !== undefined && n < rule.min) { errors.push(`"${field}" doit être supérieur ou égal à ${rule.min}`); return; }
      return n;
    }
    case 'date':
      if (!isValidDate(value)) { errors.push(`"${field}" doit être une date valide au format AAAA-MM-JJ`); return; }
      return value;
    case 'enum':
      if (!rule.values.includes(value)) { errors.push(`"${field}" doit valoir : ${rule.values.join(', ')}`); return; }
      return value;
    default:
      throw new Error(`Type de règle inconnu : ${rule.type}`);
  }
}

function validate(body, schema) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Le corps de la requête doit être un objet JSON');
  }
  const data = {};
  const errors = [];

  for (const [field, rule] of Object.entries(schema)) {
    const value = body[field];
    const empty = value === undefined || value === null || value === '';

    if (empty) {
      if (rule.required) errors.push(`"${field}" est obligatoire`);
      else data[field] = rule.default !== undefined ? rule.default : null;
      continue;
    }
    const clean = checkField(field, value, rule, errors);
    if (clean !== undefined) data[field] = clean;
  }

  if (errors.length) throw new ApiError(400, 'Données invalides', errors);
  return data;
}

// Pour PATCH : vérifie qu'au moins un champ connu est envoyé.
function ensureSomeField(body, schema) {
  const known = body && typeof body === 'object' && !Array.isArray(body)
    ? Object.keys(body).filter((k) => k in schema)
    : [];
  if (known.length === 0) {
    throw new ApiError(400, `Aucun champ à modifier. Champs acceptés : ${Object.keys(schema).join(', ')}`);
  }
}

module.exports = { validate, ensureSomeField };
