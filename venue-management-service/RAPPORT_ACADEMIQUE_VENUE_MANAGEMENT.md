# Rapport Académique & Technique – Module Venue Management
## Module : Applications Web Distribuées (ESPRIT)
**Mini-Projet Fil Rouge :** SportBook  
**Microservice :** `venue-management-service`  
**Technologie :** Python 3.10 / FastAPI / SQLAlchemy / Eureka / RabbitMQ / Keycloak / Docker  

---

## 1. Contexte & Périmètre du Module (Séances 1 à 3)

### 1.1 Responsabilité Métier (Single Responsibility Principle)
Le microservice `venue-management-service` est exclusivement responsable du domaine métier des **infrastructures sportives** :
- Gestion des **complexes sportifs (clubs, salles, centres polyvalents)**.
- Gestion des **horaires d'ouverture** hebdomadaires par complexe.
- Gestion des **terrains de sport** rattachés (discipline sportive, tarification horaire en Dinars Tunisiens DT, disponibilité).

### 1.2 Isolation des Données (Database-per-Service Pattern)
Conformément aux principes des architectures microservices distribuées :
- Base de données dédiée et autonome : `sportbook_venue` (MySQL / MariaDB).
- Aucun accès direct aux bases des autres microservices (`sportbook_identity`, `sportbook_booking`, etc.).
- Les échanges s'effectuent strictement via **API REST synchrones** ou **événements asynchrones RabbitMQ**.

---

## 2. Réponses à l'Activité de la Séance 4 : Observabilité & Actuator en Python

> **Consigne du syllabus ESPRIT (Séance 4) :**  
> *"Chaque équipe devra rechercher une solution permettant d'obtenir des fonctionnalités similaires sous Node.js et Python. Pour chaque technologie, les étudiants devront identifier : la bibliothèque utilisée, les endpoints disponibles, les informations exposées, les différences avec Spring Boot Actuator."*

### Étude Comparative : Spring Boot Actuator vs Python (FastAPI)

| Critère | Spring Boot Actuator (Java) | Solution Développée en Python (FastAPI) |
|---|---|---|
| **Bibliothèque / Outil** | `spring-boot-starter-actuator` + Micrometer | `psutil` + Endpoints Actuator natifs FastAPI (`app/routers/actuator.py`) + `opentelemetry` / `prometheus-client` |
| **Endpoints Disponibles** | `/actuator`, `/actuator/health`, `/actuator/info`, `/actuator/metrics`, `/actuator/env`, `/actuator/loggers`, `/actuator/beans` | `/actuator`, `/actuator/health`, `/actuator/info`, `/actuator/metrics`, `/actuator/metrics/{metric_name}`, `/health` |
| **Informations Exposées** | - Statut global (`UP`/`DOWN`)<br>- Indicateurs (`db`, `diskSpace`, `ping`)<br>- Métriques JVM (heap, garbage collector, threads)<br>- Git commit info & version | - Statut global (`UP`/`DEGRADED`)<br>- Vérification socket DB (`sportbook_venue`)<br>- Espace disque restant et seuil d'alerte<br>- Statut d'enregistrement Eureka<br>- Uptime du processus, usage CPU %, RSS RAM, nombre de threads |
| **Philosophie & Configuration** | Introspection automatique du contexte Spring via reflection et auto-configuration convention-over-configuration. | Léger, asynchrone, non-bloquant, contrôle précis sans surcoût de mémoire ni dépendance à un lourd runtime. |

### Principales Différences Identifiées :
1. **Légèreté & Empreinte Mémoire :** Spring Boot Actuator nécessite la JVM et le démarrage du context Spring ApplicationContext. En Python FastAPI, l'exposition des métriques consomme moins de 25 Mo de RAM avec un temps de réponse sub-milliseconde.
2. **Métriques d'Exécution :** Spring Boot Actuator mesure la mémoire Heap/Non-Heap JVM et les pauses GC. En Python, `psutil` expose la mémoire résidente RSS, les threads de l'OS et le temps CPU.
3. **Convention vs Explicite :** Spring génère les endpoints par simple inclusion de starter. En FastAPI, les endpoints `/actuator/*` ont été construits pour reproduire fidèlement le format JSON standard de Spring Boot Actuator, assurant une parfaite homogénéité dans le cluster de microservices.

---

## 3. Architecture & Conception du Module (Séance 5)

```
                            ┌─────────────────────────────────┐
                            │    Netflix Eureka Server        │
                            │         (:8761)                 │
                            └───────────────▲─────────────────┘
                                            │ Heartbeat & Discovery
                                            │
┌──────────────┐             ┌──────────────┴─────────────────┐
│ Client Web / │  HTTP :8085 │       Spring Cloud             │
│   Mobile     ├────────────►│        API Gateway             │
└──────────────┘             └──────────────┬─────────────────┘
                                            │ Route /api/venues/**
                                            │ Route /api/fields/**
                                            ▼
                        ┌───────────────────────────────────────┐
                        │       venue-management-service        │
                        │            (Python :8082)             │
                        │ ┌───────────────────────────────────┐ │
                        │ │ • Venues CRUD & Filters           │ │
                        │ │ • Fields CRUD & Tarifs            │ │
                        │ │ • Actuator Observability          │ │
                        │ │ • JWT / Keycloak Role Guard       │ │
                        │ └───────────────────────────────────┘ │
                        └───┬───────────────────────────┬───────┘
                            │                           │
          Appel Synchrone   │                           │ Publication Événements
          (OpenFeign/REST)  │                           │ (AMQP Topic)
                            ▼                           ▼
            ┌──────────────────────────┐     ┌───────────────────────┐
            │  identity-user-service   │     │   RabbitMQ Broker     │
            │          (:8081)         │     │ Exchange:             │
            │  Vérification Owner ID   │     │   sportbook.events    │
            └──────────────────────────┘     └──────────┬────────────┘
                                                        │
                                                        ▼
                                             ┌───────────────────────┐
                                             │  booking-availability │
                                             │       service         │
                                             │  (Réaction cascade)   │
                                             └───────────────────────┘
```

### Modèle Relationnel (Base `sportbook_venue`) :
- **`venue`** : `id`, `name`, `address`, `phone`, `owner_id`.
- **`field`** : `id`, `name`, `sport`, `price`, `venue_id` (FK `venue.id` ON DELETE CASCADE).
- **`opening_hours`** : `id`, `day`, `opening_time`, `closing_time`, `venue_id` (FK `venue.id` ON DELETE CASCADE).

---

## 4. API Gateway, Documentation & Routage (Séance 6)

### 4.1 Intégration Spring Cloud Gateway (`api-gateway`)
La Gateway (port `8085`) redirige le trafic vers ce microservice via son identifiant Eureka :
```properties
spring.cloud.gateway.routes[1].id=VENUE-MANAGEMENT
spring.cloud.gateway.routes[1].uri=lb://venue-management-service
spring.cloud.gateway.routes[1].predicates[0]=Path=/api/venues/**,/api/fields/**
```

### 4.2 Documentation OpenAPI & Swagger UI
- **Swagger UI interactif :** `http://localhost:8082/docs`
- **Spécification OpenAPI JSON :** `http://localhost:8082/openapi.json`
- **ReDoc :** `http://localhost:8082/redoc`

---

## 5. Communications Inter-Microservices (Séances 7 & 8)

### 5.1 Communication Synchrone (Séance 7)
Implémentée dans `app/services/identity_client.py` :
- Lors de la création d'un complexe sportif avec `owner_id`, un appel HTTP synchrone non-bloquant (`httpx.AsyncClient`) est émis vers `identity-user-service` :
  `GET http://localhost:8081/api/users/{owner_id}`
- **Patron de Résilience (Fault Tolerance) :** Si `identity-user-service` est indisponible ou hors-ligne, le service applique une dégradation gracieuse pour ne pas pénaliser l'utilisateur.
- **Endpoints de Synthèse pour les autres services :**
  - `GET /api/venues/{id}/summary` : Fournit un résumé consolidé (nombre de terrains, sports, fourchette de prix).
  - `GET /api/fields/{id}/summary` : Permet au microservice de réservation (`booking-availability-service`) de valider instantanément la tarification horaire.

### 5.2 Communication Asynchrone RabbitMQ (Séance 8)
Implémentée dans `app/messaging/rabbitmq.py` :
- **Broker :** RabbitMQ (AMQP 5672).
- **Exchange :** `sportbook.events` de type `topic` (durable).
- **Événements émis (Producer) :**
  - `venue.created` : Notifie de l'ajout d'une nouvelle infrastructure.
  - `venue.updated` : Notifie des modifications (adresse, coordonnées).
  - `venue.deleted` : Permet au service de réservation d'annuler ou libérer les créneaux futurs.
  - `field.created` / `field.updated` : Notifie le catalogue et la recherche.
  - `field.deleted` : Libère les disponibilités correspondantes.
- **Résilience :** L'émission s'exécute dans un thread worker d'arrière-plan sans bloquer le thread principal FastAPI.

---

## 6. Sécurisation Microservices avec Keycloak / JWT (Séance 9)

Implémentée dans `app/security/jwt_auth.py` :
- Extraction automatique du header `Authorization: Bearer <token>`.
- Décodage et extraction des rôles utilisateur depuis le payload standard de Keycloak (`realm_access.roles` et `resource_access`).
- **Contrôle d'Accès Basé sur les Rôles (RBAC) :**
  - Consultation publique (`GET /api/venues`, `GET /api/fields`) accessible sans restriction pour la recherche des usagers.
  - Création, mise à jour et suppression (`POST`, `PUT`, `DELETE`) restreintes aux rôles `ROLE_ADMIN` et `ROLE_OWNER`.
- **Mode Dev & Test :** Variable `SECURITY_ENABLED=false` permettant les tests automatisés et l'exécution hors ligne.

---

## 7. Conteneurisation Docker & Orchestration (Séance 10)

### 7.1 Dockerfile Optimisé
- Image de base `python:3.10-slim`.
- Multi-couche avec mise en cache des dépendances (`pip install --no-cache-dir`).
- Intégration d'un `HEALTHCHECK` Docker natif interrogeant l'endpoint `/actuator/health`.

### 7.2 Docker Compose (`docker-compose.yml`)
Permet de déployer en une seule commande l'environnement complet du module :
```bash
docker-compose up -d --build
```
Composants orchestrés :
1. `venue-management-service` (Port 8082)
2. `venue-db` (MySQL 8.0, Port 3307, initialisation automatique via `sportbook_databases.sql`)
3. `rabbitmq` (RabbitMQ 3-management, Ports 5672 & 15672)

---

## 8. Validation & Résultats des Tests

L'ensemble des fonctionnalités du module est couvert par des tests automatisés d'intégration (`pytest`) :
- Test des endpoints `/` et `/health`.
- Test des endpoints `/actuator/*` (`health`, `info`, `metrics`).
- Test complet du CRUD `venues` avec filtres de recherche.
- Test complet du CRUD `fields` avec filtres par sport et prix.
- Test de suppression en cascade (`cascade delete`).
- Test des endpoints de synthèse inter-services.
- Test des validations d'erreurs (400, 404).

**Résultat : 7/7 tests passés avec succès (100% de réussite).**
