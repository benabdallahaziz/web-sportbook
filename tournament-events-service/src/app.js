const path = require('path');
const express = require('express');
const { setupSwagger } = require('./config/swagger');
const { notFound, errorHandler } = require('./middlewares/error.middleware');

const app = express();

// ─── Middlewares ─────────────────────────────────────────────────────────────
app.use(express.json());   // lit les corps JSON (Content-Type: application/json)

// CORS : autorise une page servie depuis une AUTRE origine (ex. Live Server
// sur http://127.0.0.1:5500) à appeler cette API avec fetch().
// Le navigateur envoie d'abord une requête OPTIONS ("preflight") pour PUT,
// PATCH, DELETE ou un body JSON : on y répond 204 avec les autorisations.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-User-Id,X-User-Roles');
  res.setHeader('Access-Control-Expose-Headers', 'Location');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Front-end (HTML/CSS/JS natif) servi sur http://localhost:8086/ ─────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Routes de l'API ─────────────────────────────────────────────────────────
app.use('/api/tournaments', require('./routes/tournament.routes'));
app.use('/api/teams',       require('./routes/team.routes'));
app.use('/api/matches',     require('./routes/match.routes'));

// Documentation Swagger : /api-docs (UI) et /api-docs.json (spécification)
setupSwagger(app);

// Health check (utilisé par Eureka)
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'tournament-events-service' });
});

// ─── Gestion des erreurs (toujours en dernier) ───────────────────────────────
app.use(notFound);      // 404 JSON pour une route inconnue
app.use(errorHandler);  // format d'erreur unique { status, message, details? }

module.exports = app;
