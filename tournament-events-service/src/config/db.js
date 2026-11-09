const mysql2 = require('mysql2');
require('dotenv').config();

const pool = mysql2.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'sportbook_tournament',
  // Renvoie les DATE sous forme "2027-03-10" (et non un objet Date converti
  // en UTC, ce qui décalerait les dates d'un jour selon le fuseau horaire)
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const promisePool = pool.promise();

// Test de connexion au démarrage
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Erreur connexion MySQL:', err.message || err.code, '→ XAMPP/MySQL est-il démarré ?');
    return;
  }
  console.log('✅ Connecté à MySQL - Base: sportbook_tournament');
  connection.release();
});

module.exports = promisePool;

