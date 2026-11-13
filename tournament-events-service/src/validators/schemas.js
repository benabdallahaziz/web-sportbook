/**
 * Règles de validation de chaque ressource (alignées sur les tables MySQL).
 */
const TOURNAMENT_STATUS = ['PLANNED', 'ONGOING', 'FINISHED'];
const MATCH_STATUS = ['SCHEDULED', 'ONGOING', 'FINISHED'];

const tournamentSchema = {
  name:       { type: 'string', required: true, maxLength: 150 },
  start_date: { type: 'date' },
  end_date:   { type: 'date' },
  status:     { type: 'enum', values: TOURNAMENT_STATUS, default: 'PLANNED' },
};

const teamSchema = {
  name:    { type: 'string', required: true, maxLength: 100 },
  members: { type: 'int', min: 0, default: 0 },
};

const matchSchema = {
  date:     { type: 'date' },
  score:    { type: 'string', maxLength: 20, pattern: /^\d+-\d+$/, patternMessage: 'doit être au format "3-1"' },
  status:   { type: 'enum', values: MATCH_STATUS, default: 'SCHEDULED' },
  round_id: { type: 'int', required: true, min: 1 },
  team1_id: { type: 'int', required: true, min: 1 },
  team2_id: { type: 'int', required: true, min: 1 },
};

const scoreSchema = {
  score:  { type: 'string', required: true, maxLength: 20, pattern: /^\d+-\d+$/, patternMessage: 'doit être au format "3-1"' },
  status: { type: 'enum', values: MATCH_STATUS, default: 'FINISHED' },
};

const roundSchema = {
  name:        { type: 'string', required: true, maxLength: 100 },
  round_order: { type: 'int', required: true, min: 1 },
};

const registrationSchema = {
  team_id: { type: 'int', required: true, min: 1 },
};

module.exports = {
  tournamentSchema, teamSchema, matchSchema, scoreSchema, roundSchema, registrationSchema,
  TOURNAMENT_STATUS, MATCH_STATUS,
};

// ─── Circuit de validation (réservé à l'admin) ───────────────────────────────
const approvalSchema = {
  decision: { type: 'enum', values: ['APPROVED', 'REJECTED'], required: true },
  reason:   { type: 'string', maxLength: 255 },
};

const registrationDecisionSchema = {
  status: { type: 'enum', values: ['CONFIRMED', 'REJECTED'], required: true },
};

module.exports.approvalSchema = approvalSchema;
module.exports.registrationDecisionSchema = registrationDecisionSchema;
