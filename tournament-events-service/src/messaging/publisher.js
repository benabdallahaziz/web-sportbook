/**
 * Producteur RabbitMQ : publie les événements métier du service.
 *
 *   Exchange : "sportbook.events" (type topic, durable)
 *   Routing keys publiées :
 *     match.updated       → un match a été créé ou modifié (snapshot complet)
 *     match.deleted       → un match a été supprimé
 *     tournament.deleted  → un tournoi (et donc ses matchs) a été supprimé
 *
 * Le service ne sait PAS qui écoute (ex. stats-service en Python) :
 * c'est le découplage apporté par la communication asynchrone.
 *
 * Si RabbitMQ est arrêté, l'API continue de fonctionner normalement :
 * l'événement est perdu, mais stats-service peut se resynchroniser par REST
 * (POST /api/stats/sync).
 */
const amqp = require('amqplib');

const EXCHANGE = 'sportbook.events';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const RETRY_MS = 10000;

let channel = null;
let connecting = false;
let warned = false; // évite de remplir les logs pendant une panne

function scheduleReconnect() {
  setTimeout(connect, RETRY_MS).unref();
}

async function connect() {
  if (channel || connecting) return;
  connecting = true;
  try {
    const conn = await amqp.connect(RABBITMQ_URL);
    conn.on('error', () => { /* géré par 'close' */ });
    conn.on('close', () => {
      channel = null;
      console.warn('⚠️  Connexion RabbitMQ perdue, nouvelle tentative dans 10 s');
      scheduleReconnect();
    });
    const ch = await conn.createChannel();
    await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
    channel = ch;
    warned = false;
    console.log(`✅ RabbitMQ connecté (exchange "${EXCHANGE}")`);
  } catch (err) {
    if (!warned) {
      console.warn(`⚠️  RabbitMQ indisponible (${err.code || err.message}) : les événements ne seront pas publiés. Nouvelle tentative toutes les 10 s.`);
      warned = true;
    }
    scheduleReconnect();
  } finally {
    connecting = false;
  }
}

/**
 * Publie un événement. Ne lève jamais d'erreur : une panne de RabbitMQ
 * ne doit pas faire échouer la requête HTTP de l'utilisateur.
 */
function publish(routingKey, data) {
  if (!channel) {
    console.warn(`⚠️  Événement "${routingKey}" non publié (RabbitMQ indisponible)`);
    return false;
  }
  try {
    const message = { event: routingKey, occurred_at: new Date().toISOString(), source: 'tournament-events-service', data };
    channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(message)), {
      persistent: true,                 // le message survit à un redémarrage de RabbitMQ
      contentType: 'application/json',
    });
    console.log(`📤 Événement publié : ${routingKey}`);
    return true;
  } catch (err) {
    console.warn(`⚠️  Échec de publication "${routingKey}" : ${err.message}`);
    return false;
  }
}

module.exports = { connect, publish, EXCHANGE };
