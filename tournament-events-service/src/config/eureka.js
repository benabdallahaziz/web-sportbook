const { Eureka } = require('eureka-js-client');
require('dotenv').config();

// Docker : EUREKA_INSTANCE_HOST=tournament-events-service (nom du conteneur, résolu par le DNS Docker)
const INSTANCE_HOST = process.env.EUREKA_INSTANCE_HOST || 'localhost';

const client = new Eureka({
  instance: {
    app: 'tournament-events-service',
    hostName: INSTANCE_HOST,
    ipAddr: process.env.EUREKA_INSTANCE_HOST || '127.0.0.1',
    port: {
      '$': parseInt(process.env.PORT) || 8086,
      '@enabled': true
    },
    vipAddress: 'tournament-events-service',
    dataCenterInfo: {
      '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
      name: 'MyOwn'
    },
    statusPageUrl: `http://${INSTANCE_HOST}:${process.env.PORT || 8086}/health`,
    healthCheckUrl: `http://${INSTANCE_HOST}:${process.env.PORT || 8086}/health`
  },
  eureka: {
    host: process.env.EUREKA_HOST || 'localhost',
    port: process.env.EUREKA_PORT || 8761,
    servicePath: '/eureka/apps/'
  }
});

function startEurekaClient() {
  client.start((err) => {
    if (err) {
      console.error('❌ Erreur enregistrement Eureka:', err.message);
      console.warn('⚠️  Le service tourne sans Eureka (Gateway ne pourra pas router)');
    } else {
      console.log('✅ Enregistré sur Eureka en tant que [tournament-events-service]');
    }
  });
}

// Désenregistrement propre à l'arrêt
process.on('SIGINT', () => {
  client.stop(() => {
    console.log('🔌 Désenregistré d\'Eureka — arrêt du service');
    process.exit();
  });
});

module.exports = { startEurekaClient };

