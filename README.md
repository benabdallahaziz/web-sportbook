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
