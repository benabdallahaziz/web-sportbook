/**
 * Migration au démarrage : ajoute les colonnes du circuit de validation si
 * elles n'existent pas encore (bases importées avant cette fonctionnalité).
 * Les lignes déjà présentes sont considérées comme validées (DEFAULT 'APPROVED').
 */
const db = require('./db');

const COLUMNS = [
  ['tournament', 'approval_status', "VARCHAR(20) NOT NULL DEFAULT 'APPROVED'"],
  ['tournament', 'created_by', 'BIGINT NULL'],
  ['tournament', 'rejection_reason', 'VARCHAR(255) NULL'],
  ['matches', 'approval_status', "VARCHAR(20) NOT NULL DEFAULT 'APPROVED'"],
  ['matches', 'created_by', 'BIGINT NULL'],
  ['matches', 'rejection_reason', 'VARCHAR(255) NULL'],
  ['team', 'created_by', 'BIGINT NULL'], // propriétaire de l'équipe
];

async function migrate() {
  for (const [table, column, definition] of COLUMNS) {
    const [rows] = await db.query(
      `SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    if (rows.length === 0) {
      await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      console.log(`🛠️  Migration : colonne ${table}.${column} ajoutée`);
    }
  }
}

module.exports = { migrate };
