# SportBook – Architecture microservices

```
Clients (Web / Mobile)
        │
   API Gateway :8085  ──── Eureka Server :8761
        │
 ┌──────┼───────────────────────────────┐
 6 microservices (un par membre, langages différents)
```

## Démarrage
1. `cd eureka-server && mvn spring-boot:run`  → http://localhost:8761
2. `cd api-gateway && mvn spring-boot:run`    → http://localhost:8085
3. Chaque membre lance son microservice (il doit s'enregistrer sur Eureka).

## Contrat pour chaque microservice (peu importe le langage)

| Microservice | Nom Eureka (`spring.application.name`) | Port | Préfixes via Gateway |
|---|---|---|---|
| Identity & User | `identity-user-service` | 8081 | /api/users, /api/auth, /api/roles |
| Venue Management | `venue-management-service` | 8082 | /api/venues, /api/fields |
| Booking & Availability | `booking-availability-service` | 8083 | /api/bookings, /api/timeslots |
| Marketplace | `marketplace-service` | 8084 | /api/products, /api/cart, /api/orders |
| Tournament & Events | `tournament-events-service` | 8086 | /api/tournaments, /api/teams, /api/matches |
| Coach & Training | `coach-training-service` | 8087 | /api/coaches, /api/sessions, /api/programs |
| Recommendation (Python/FastAPI) | `recommendation-service` | 8090 | /api/recommendations |

## Lancement rapide (Windows)
`start-all.bat` lance Eureka, Identity, Gateway, Venue, Marketplace, Tournament (Node.js),
Coach & Training (.NET 8, `dotnet run`), Recommendation (Python) et le frontend Angular.

Prérequis : JDK 17 + Maven, Node.js, Python 3.11+, **.NET 8 SDK**, XAMPP (MySQL).

### Coach & Training (.NET 8)
- Swagger : http://localhost:8087/swagger
- Sécurité Keycloak (Atelier 9) désactivée par défaut dans le projet intégré, car le frontend
  s'authentifie via `identity-user-service` sans jeton JWT. Pour la réactiver :
  `"Security": { "KeycloakEnabled": true }` dans `coach-training-service/appsettings.json`
  (Keycloak attendu sur http://localhost:8180/realms/sportbook).
- RabbitMQ (Atelier 6) : configuré dans `appsettings.json` (`RabbitMQ:Enabled`). Si le broker est
  injoignable, le service continue de fonctionner (les événements ne sont pas publiés).

### Docker (atelier « Application multi-conteneurs »)
`docker-compose.yml` décrit **toute l'application (13 conteneurs)** : MariaDB, RabbitMQ, Keycloak,
Eureka, API Gateway, Identity (Java), Venue / Marketplace / Recommendation / Stats (Python),
Tournament (Node.js), Coach (.NET) et le frontend Angular (nginx, qui relaie `/api` vers la Gateway).

1. **Lancer en local** (Docker Desktop démarré, services de dev arrêtés car mêmes ports) :
   `docker compose up -d --build` puis http://localhost:8000 (frontend), http://localhost:8761 (Eureka).
   La base est initialisée au premier lancement avec `database/sportbook_databases.sql`
   (MariaDB exposée sur le port **3307** pour ne pas gêner XAMPP).
2. **Keycloak** : le realm `sportbook` (`keycloak/sportbook-realm.json`) est importé automatiquement
   (http://localhost:8180, admin/admin ; utilisateurs `admin.sportbook`/`admin123`, `sportif.test`/`sportif123`).
3. **Docker Hub** : copier `.env.example` en `.env`, mettre son identifiant dans `DOCKERHUB_USER`, puis
   `docker login`, `docker compose build`, `docker compose push`.
4. **Cloud (KillerCoda)** : `docker-compose.cloud.yml` est le même fichier **sans les lignes `build`**.
   Y copier ce fichier ainsi que les dossiers `database/` et `keycloak/`, puis
   `DOCKERHUB_USER=<compte> docker compose -f docker-compose.cloud.yml up -d`, `docker ps`,
   et ouvrir les ports 8000 / 8761 via *Traffic / Ports*.

Commandes utiles : `docker compose ps`, `docker compose logs -f <service>`, `docker compose down`
(`down -v` supprime aussi les données MariaDB).

**Règle d'or :** le nom enregistré dans Eureka (en minuscules) doit être exactement celui utilisé après `lb://` dans la Gateway, et les endpoints du service doivent commencer par le préfixe `/api/...` indiqué.

## Enregistrer un service non-Java sur Eureka
- **Spring Boot (Java)** : dépendance `spring-cloud-starter-netflix-eureka-client` + `@EnableDiscoveryClient`.
- **Node.js** : paquet `eureka-js-client`.
- **Python** : paquet `py-eureka-client` (`eureka_client.init(eureka_server="http://localhost:8761/eureka", app_name="...", instance_port=...)`).
- **.NET** : paquet `Steeltoe.Discovery.Eureka`.
- **PHP / Go / autres** : API REST d'Eureka (`POST /eureka/apps/{APP_NAME}` + heartbeat `PUT`).

## Base de données (XAMPP / MySQL)
1. Ouvrir XAMPP Control Panel → démarrer **Apache** et **MySQL**.
2. Aller sur http://localhost/phpmyadmin → onglet **Importer** → choisir `database/sportbook_databases.sql` → **Exécuter**.
3. 6 bases sont créées (une par microservice) : `sportbook_identity`, `sportbook_venue`, `sportbook_booking`, `sportbook_marketplace`, `sportbook_tournament`, `sportbook_coach`.

Connexion depuis un microservice Spring Boot (XAMPP : user `root`, mot de passe vide) :
```properties
spring.datasource.url=jdbc:mysql://localhost:3306/sportbook_identity?useSSL=false&serverTimezone=UTC
spring.datasource.username=root
spring.datasource.password=
spring.jpa.hibernate.ddl-auto=update
```
Dépendances Maven : `spring-boot-starter-data-jpa` + `mysql-connector-j`.
Pour les autres langages : Node `mysql2`, Python `mysql-connector-python` / `SQLAlchemy`, PHP `PDO`, .NET `Pomelo.EntityFrameworkCore.MySql`.
