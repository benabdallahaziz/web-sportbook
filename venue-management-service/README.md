# SportBook – Venue Management Service (Python / FastAPI)

Ce microservice gère les **complexes sportifs (salles/clubs)**, leurs **horaires d'ouverture** et les **terrains de sport associés**. Il est intégré dans l'écosystème microservices SportBook conformément au programme du module **Applications Web Distribuées (ESPRIT)**.

---

## 🛠 Spécifications Techniques

* **Langage & Framework :** Python 3.10+ / FastAPI & Uvicorn
* **ORM & Base de données :** SQLAlchemy 2.0 & PyMySQL (`sportbook_venue` sur MySQL / XAMPP)
* **Découverte de services (Séance 4) :** Netflix Eureka Client via `py-eureka-client` (`venue-management-service` sur port `8082`)
* **Observabilité (Séance 4) :** Endpoints conformes Spring Boot Actuator (`/actuator/health`, `/actuator/info`, `/actuator/metrics`)
* **Communication Synchrone (Séance 7) :** Client REST HTTPX vers `identity-user-service`
* **Communication Asynchrone (Séance 8) :** AMQP via RabbitMQ Topic Exchange `sportbook.events`
* **Sécurité & RBAC (Séance 9) :** JWT compatible Keycloak (`ROLE_ADMIN`, `ROLE_OWNER`)
* **Conteneurisation (Séance 10) :** `Dockerfile` optimisé & `docker-compose.yml`
* **Documentation interactive :** Swagger UI à l'adresse `http://localhost:8082/docs`

---

## 🚀 Démarrage Rapide

### 1. Prérequis
1. **MySQL** démarré (via XAMPP : Apache & MySQL actifs).
2. Avoir importé le script `database/sportbook_databases.sql` dans phpMyAdmin (la base `sportbook_venue` doit être créée).
3. Avoir démarré le serveur Eureka (`cd eureka-server && mvn spring-boot:run`).

### 2. Installation de l'environnement virtuel & dépendances

Dans le dossier `venue-management-service` :

```powershell
# Créer l'environnement virtuel (si pas déjà fait)
python -m venv venv

# Activer l'environnement virtuel sous Windows
.\venv\Scripts\Activate.ps1

# Installer les dépendances
pip install -r requirements.txt
```

### 3. Lancer le microservice

```powershell
python run.py
# Ou via le script automatique :
.\run.ps1
```
Le service démarrera sur **http://localhost:8082**.
* Documentation interactive Swagger : **http://localhost:8082/docs**
* Documentation ReDoc : **http://localhost:8082/redoc**
* Tableau de bord Actuator : **http://localhost:8082/actuator**
* Enregistrement automatique sur Eureka en tant que `venue-management-service`.

---

## 📡 Routes de l'API REST

### 1. Ressource : Salles & Complexes (`/api/venues`)

| Méthode | Endpoint | Description | Sécurité (RBAC) |
|---|---|---|---|
| `POST` | `/api/venues` | Créer un nouveau complexe sportif | `ROLE_ADMIN`, `ROLE_OWNER` |
| `GET` | `/api/venues` | Lister tous les complexes (filtres : `?city=`, `?search=`, `?owner_id=`) | Public |
| `GET` | `/api/venues/{id}` | Afficher les détails d'un complexe (horaires + liste des terrains) | Public |
| `GET` | `/api/venues/{id}/summary` | Résumé synthétique pour les autres microservices | Public |
| `PUT` | `/api/venues/{id}` | Mettre à jour un complexe | `ROLE_ADMIN`, `ROLE_OWNER` |
| `DELETE` | `/api/venues/{id}` | Supprimer un complexe (supprime en cascade terrains et horaires) | `ROLE_ADMIN`, `ROLE_OWNER` |
| `GET` | `/api/venues/{id}/fields` | Récupérer tous les terrains rattachés à ce complexe | Public |
| `POST` | `/api/venues/{id}/opening-hours` | Ajouter un horaire d'ouverture pour ce complexe | `ROLE_ADMIN`, `ROLE_OWNER` |
| `GET` | `/api/venues/{id}/opening-hours` | Obtenir les horaires d'ouverture d'un complexe | Public |

### 2. Ressource : Terrains de Sport (`/api/fields`)

| Méthode | Endpoint | Description | Sécurité (RBAC) |
|---|---|---|---|
| `POST` | `/api/fields` | Créer un nouveau terrain rattaché à un complexe (`venue_id`) | `ROLE_ADMIN`, `ROLE_OWNER` |
| `GET` | `/api/fields` | Lister tous les terrains (filtres : `?venue_id=`, `?sport=`, `?min_price=`, `?max_price=`, `?search=`) | Public |
| `GET` | `/api/fields/{id}` | Afficher les détails d'un terrain spécifique | Public |
| `GET` | `/api/fields/{id}/summary` | Synthèse tarifaire consommée par `booking-service` | Public |
| `PUT` | `/api/fields/{id}` | Mettre à jour un terrain | `ROLE_ADMIN`, `ROLE_OWNER` |
| `DELETE` | `/api/fields/{id}` | Supprimer un terrain | `ROLE_ADMIN`, `ROLE_OWNER` |

### 3. Observabilité & Actuator (`/actuator`)

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/actuator` | Index des endpoints de supervision HATEOAS |
| `GET` | `/actuator/health` | État de santé (`UP`/`DOWN`), statut base de données, disque |
| `GET` | `/actuator/info` | Informations statiques sur le microservice et la stack |
| `GET` | `/actuator/metrics` | Liste des métriques disponibles (CPU, RAM, threads, uptime) |
| `GET` | `/actuator/metrics/{name}` | Valeur d'une métrique spécifique (ex: `process.uptime`) |

---

## 🐳 Déploiement Docker (Séance 10)

Pour démarrer le microservice, sa base MySQL dédiée et RabbitMQ en une seule commande :

```bash
docker-compose up -d --build
```

---

## 🧪 Exécution des Tests Automatisés

Des tests d'intégration complets avec base SQLite en mémoire sont inclus :

```powershell
pytest tests/
```
