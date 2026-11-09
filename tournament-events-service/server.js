require('dotenv').config();
const app = require('./src/app');
const { startEurekaClient } = require('./src/config/eureka');
const rabbitmq = require('./src/messaging/publisher');

const PORT = process.env.PORT || 8086;

app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════');
  console.log(`🏆  Tournament & Events Service`);
  console.log(`🚀  Démarré sur http://localhost:${PORT}`);
  console.log(`🖥️   Interface web   → http://localhost:${PORT}/`);
  console.log(`📚  Swagger UI     → http://localhost:${PORT}/api-docs`);
  console.log(`📋  Endpoints disponibles :`);
  console.log(`    GET/POST              /api/tournaments`);
  console.log(`    GET/PUT/PATCH/DELETE  /api/tournaments/:id`);
  console.log(`    GET/POST              /api/tournaments/:id/teams`);
  console.log(`    DELETE                /api/tournaments/:id/teams/:teamId`);
  console.log(`    GET/POST              /api/tournaments/:id/rounds`);
  console.log(`    GET/POST              /api/teams`);
  console.log(`    GET/PUT/PATCH/DELETE  /api/teams/:id`);
  console.log(`    GET/POST              /api/matches`);
  console.log(`    GET/PUT/PATCH/DELETE  /api/matches/:id`);
  console.log(`    PATCH                 /api/matches/:id/score`);
  console.log(`    GET                   /health`);
  console.log('═══════════════════════════════════════════════');

  // Enregistrement sur Eureka (après démarrage du serveur)
  startEurekaClient();

  // Connexion au broker de messages (non bloquante, reconnexion automatique)
  rabbitmq.connect();
});

