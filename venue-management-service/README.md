# SportBook – Venue Management Service (Python / FastAPI)

Ce microservice gère les **complexes sportifs (salles/clubs)**, leurs **horaires d'ouverture** et les **terrains de sport associés**. Il est intégré dans l'écosystème microservices SportBook via **Spring Cloud Gateway** et **Netflix Eureka**.

---

## 🛠 Spécifications Techniques

* **Langage :** Python (>= 3.10)
* **Framework Web :** FastAPI & Uvicorn
* **ORM & Base de données :** SQLAlchemy 2.0 & PyMySQL (`sportbook_venue` sur MySQL / XAMPP)
* **Découverte de services :** `py-eureka-client` (Eureka Server : port `8761`)
* **Validation & Sérialisation :** Pydantic v2
* **Port HTTP :** `8082`
* **Documentation interactive :** Swagger UI à l'adresse `http://localhost:8082/docs`

---

## 🚀 Démarrage Rapide

### 1. Prérequis
1. Avoir **MySQL** démarré (via XAMPP : Apache & MySQL actifs).
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
```
Le service démarrera sur **http://localhost:8082**.
* Documentation interactive Swagger : **http://localhost:8082/docs**
* Documentation ReDoc : **http://localhost:8082/redoc**
* Enregistrement automatique sur Eureka en tant que `venue-management-service`.

---

## 📡 Routes de l'API REST (CRUD)

### 1. Ressource : Salles & Complexes (`/api/venues`)

| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/api/venues` | Créer un nouveau complexe sportif (avec horaires optionnels) |
| `GET` | `/api/venues` | Lister tous les complexes (filtres : `?city=`, `?search=`, `?owner_id=`) |
| `GET` | `/api/venues/{id}` | Afficher les détails d'un complexe (horaires + liste des terrains) |
| `PUT` | `/api/venues/{id}` | Mettre à jour un complexe (nom, adresse, téléphone, horaires...) |
| `DELETE` | `/api/venues/{id}` | Supprimer un complexe (supprime en cascade terrains et horaires) |
| `GET` | `/api/venues/{id}/fields` | Récupérer tous les terrains rattachés à ce complexe |
| `POST` | `/api/venues/{id}/opening-hours` | Ajouter un horaire d'ouverture pour ce complexe |
| `GET` | `/api/venues/{id}/opening-hours` | Obtenir les horaires d'ouverture d'un complexe |

### 2. Ressource : Terrains de Sport (`/api/fields`)

| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/api/fields` | Créer un nouveau terrain rattaché à un complexe (`venue_id`) |
| `GET` | `/api/fields` | Lister tous les terrains (filtres : `?venue_id=`, `?sport=`, `?min_price=`, `?max_price=`, `?search=`) |
| `GET` | `/api/fields/{id}` | Afficher les détails d'un terrain spécifique |
| `PUT` | `/api/fields/{id}` | Mettre à jour un terrain (nom, sport, prix...) |
| `DELETE` | `/api/fields/{id}` | Supprimer un terrain |

---

## 🧪 Exécution des Tests Automatisés

Des tests d'intégration complets avec une base de données SQLite en mémoire sont inclus :

```powershell
pytest tests/
```
