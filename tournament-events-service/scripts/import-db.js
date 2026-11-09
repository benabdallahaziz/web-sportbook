const mysql = require('mysql2');
const fs    = require('fs');
const path  = require('path');

const conn = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  multipleStatements: true
});

conn.connect(err => {
  if (err) { console.error('❌ Connexion MySQL échouée:', err.message); process.exit(1); }
  console.log('✅ Connecté à MySQL');

  const sqlFile = path.resolve(__dirname, '../../database/sportbook_databases.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  conn.query(sql, (err) => {
    if (err) {
      console.error('❌ Erreur import SQL:', err.message);
    } else {
      console.log('✅ Base de données sportbook_tournament importée avec succès !');
    }
    conn.end();
  });
});
