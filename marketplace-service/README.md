# Marketplace Service – SportBook 🏪

Microservice Python/FastAPI dédié au catalogue e-commerce d'équipements sportifs, à la gestion des paniers, au traitement des commandes, aux statistiques gérant et au moteur d'intelligence artificielle de recommandation pour la plateforme **SportBook** (*Find. Book. Play.*).

Ce microservice s'intègre au sein d'une architecture distribuée moderne répondant aux exigences du module **Applications Web Distribuées (MT-41 - ESPRIT)**.

---

## 📋 Informations Techniques Générales

| Propriété | Valeur |
|---|---|
| **Port Service Direct** | `8084` |
| **Port via Spring Cloud API Gateway** | `8085` (`http://localhost:8085/api/...`) |
| **Nom d'enregistrement Eureka** | `MARKETPLACE-SERVICE` |
| **Serveur Eureka** | `http://localhost:8761` |
| **Base de Données** | MySQL / MariaDB (`sportbook_marketplace`) |
| **Framework Web** | FastAPI 0.115+ (Python 3.11+) |
| **ORM** | SQLAlchemy 2.0+ & PyMySQL |
| **Intelligence Artificielle / ML** | scikit-learn (TF-IDF Vectorizer + Cosine Similarity) |
| **Documentation Interactive (Swagger)** | `http://localhost:8084/docs` |
| **Endpoints d'Observabilité** | `/health`, `/info` |

---

## 🎯 Conformité avec la Fiche Module (MT-41 - ESPRIT)

Ce service intègre l'ensemble des concepts fondamentaux et avancés du cursus :

1. **Architecture Microservices & API RESTful (Séances 1 à 4)** :
   - Endpoints normalisés, codes HTTP stricts (200, 201, 204, 400, 404, 422).
   - Validation stricte des données d'entrée/sortie via Pydantic V2.
   - Isolation des données avec sa propre base de données (`sportbook_marketplace`).

2. **Découverte de Services & Enregistrement Dynamique - Netflix Eureka (Séance 5)** :
   - Enregistrement automatique au démarrage sous le nom `MARKETPLACE-SERVICE`.
   - Émission périodique de battements de cœur (*heartbeats*) toutes les 30s.
   - Désenregistrement propre (*graceful shutdown*) lors de l'arrêt du service.

3. **Routage Centralisé & Filtrage - Spring Cloud API Gateway (Séance 6)** :
   - Accessible via le point d'entrée unique `http://localhost:8085/api/products`, `http://localhost:8085/api/cart`, `http://localhost:8085/api/orders`.
   - Gestion avancée et non-redondante des en-têtes CORS (aucun conflit de headers lors du passage par la Gateway).

4. **Communication Synchrone Inter-Microservices (Séance 7)** :
   - Intégration d'un client HTTP asynchrone/synchrone (`identity_client.py`).
   - Lors de la création d'une commande (`POST /api/orders`), le service interroge `identity-user-service` (`http://localhost:8081/api/users/{user_id}`) pour valider l'existence de l'utilisateur.
   - Résilience & Tolérance aux pannes : en cas d'indisponibilité temporaire de l'Identity Service (fallback gracieux avec log d'avertissement), la continuité de service est assurée.

5. **Observabilité & Métriques de Santé (Séance 8 - Type Actuator)** :
   - `GET /health` : Vérification en temps réel de l'état de la base de données MySQL et du statut global du service.
   - `GET /info` : Métadonnées du service, version, nom d'application et pile technologique.

6. **Conteneurisation & Déploiement Docker (Séance 9)** :
   - `Dockerfile` multi-stage basé sur `python:3.11-slim`.
   - `docker-compose.yml` orchestrant MySQL et le microservice avec healthchecks et persistance de volume.

7. **Intelligence Artificielle & Machine Learning Intégrée (Fonctionnalité Avancée)** :
   - Moteur de recommandation de produits basé sur le contenu (*Content-Based Filtering*).
   - Analyse vectorielle TF-IDF des caractéristiques des produits (nom, catégorie, description) et calcul de similarité cosinus (`scikit-learn`).
   - Recommandation intelligente d'articles complémentaires pour le panier de l'utilisateur.

8. **Métriques Métier & Dashboard Analytique pour le Gérant** :
   - Endpoint `GET /api/orders/analytics` : Calcul en temps réel du chiffre d'affaires total, panier moyen, répartition des commandes par statut et top 5 des articles les plus vendus.

---

## 📂 Architecture des Dossiers

```
marketplace-service/
├── Dockerfile                  # Configuration image Docker
├── docker-compose.yml          # Déploiement multi-conteneurs (MySQL + Service)
├── .dockerignore               # Exclusion fichiers Docker
├── .gitignore                  # Exclusion fichiers Git (venv, .env, cache)
├── .env.example                # Exemple de configuration d'environnement
├── requirements.txt            # Dépendances Python (FastAPI, scikit-learn, etc.)
├── start.bat                   # Script de lancement en un clic (Windows)
├── main.py                     # Initialisation FastAPI, Eureka & CORS
├── database/
│   └── sportbook_databases.sql # Script SQL d'initialisation des tables
└── app/
    ├── config.py               # Paramètres de configuration (Pydantic Settings)
    ├── database.py             # Session SQLAlchemy et connexion MySQL
    ├── eureka_client.py        # Client d'enregistrement Eureka REST & Heartbeats
    ├── models/                 # Modèles SQLAlchemy (conformes BDD officielle)
    │   ├── category.py         # Table `category`
    │   ├── product.py          # Table `product`
    │   ├── cart.py             # Tables `cart` et `cart_item`
    │   └── order.py            # Tables `orders` et `order_item`
    ├── schemas/                # Schémas de validation Pydantic V2
    │   ├── product_schema.py   # Schémas Category et Product
    │   ├── cart_schema.py      # Schémas Cart et CartItem
    │   └── order_schema.py     # Schémas Order et Analytics
    ├── services/               # Logique métier et intégration
    │   ├── identity_client.py  # Client de communication inter-service (Identity)
    │   └── recommendation_service.py # Moteur ML TF-IDF + Cosine Similarity
    └── routers/                # Contrôleurs API REST
        ├── products.py         # CRUD Produits/Catégories + Recommandation ML
        ├── cart.py             # Gestion Panier + Recommandations du panier
        └── orders.py           # Commandes, Workflow Statuts + Analytics Gérant
```

---

## 🚀 Installation & Démarrage

### Option 1 : Démarrage Local Standard (avec XAMPP)

1. **Prérequis** :
   - Python 3.11+
   - XAMPP avec MySQL démarré sur le port `3306`
   - Eureka Server démarré sur le port `8761`
   - API Gateway démarré sur le port `8085`

2. **Base de données** :
   - Ouvrir phpMyAdmin (`http://localhost/phpmyadmin`).
   - Créer la base de données `sportbook_marketplace` (si non existante).
   - Importer le fichier `database/sportbook_databases.sql`.

3. **Lancement automatique (Windows)** :
   Double-cliquer sur `start.bat` ou exécuter :
   ```cmd
   start.bat
   ```
   *Ce script crée l'environnement virtuel `.venv`, installe les dépendances et démarre Uvicorn.*

4. **Lancement manuel** :
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8084 --reload
   ```

---

### Option 2 : Déploiement Conteneurisé avec Docker Compose

Pour exécuter le microservice de façon complètement isolée :

```bash
docker compose up -d --build
```

- Le conteneur MySQL `sportbook-mysql` sera instancié sur le port 3306 avec initialisation automatique du schéma.
- Le conteneur `marketplace-service` démarrera sur le port 8084 après vérification de la disponibilité de MySQL.

---

## 📡 Documentation des Endpoints

Tous les endpoints sont accessibles soit directement sur le port `8084`, soit via la **Spring Cloud API Gateway** sur le port `8085`.

### 1. Produits & Catégories (`/api/products`)

| Méthode | URL via Gateway (`:8085`) | Description |
|---|---|---|
| `GET` | `/api/products` | Lister tous les produits (avec filtre optionnel `?category_id=X`) |
| `POST` | `/api/products` | Créer un nouveau produit |
| `GET` | `/api/products/{id}` | Consulter les détails d'un produit |
| `PUT` | `/api/products/{id}` | Modifier les informations d'un produit |
| `DELETE` | `/api/products/{id}` | Supprimer un produit |
| `GET` | `/api/products/{id}/recommendations?limit=4` | **Moteur ML** : Obtenir les produits similaires recommandés |
| `GET` | `/api/products/categories` | Lister toutes les catégories |
| `POST` | `/api/products/categories` | Ajouter une catégorie |
| `GET` | `/api/products/categories/{id}` | Détails d'une catégorie et ses produits |
| `PUT` | `/api/products/categories/{id}` | Modifier une catégorie |
| `DELETE` | `/api/products/categories/{id}` | Supprimer une catégorie |

---

### 2. Panier (`/api/cart`)

| Méthode | URL via Gateway (`:8085`) | Description |
|---|---|---|
| `GET` | `/api/cart/{user_id}` | Consulter le panier actif de l'utilisateur avec sous-totaux |
| `POST` | `/api/cart/{user_id}/items` | Ajouter ou incrémenter un produit dans le panier |
| `DELETE` | `/api/cart/{user_id}/items/{product_id}` | Retirer un article du panier |
| `DELETE` | `/api/cart/{user_id}` | Vider intégralement le panier |
| `GET` | `/api/cart/{user_id}/recommendations?limit=4` | **Moteur ML** : Suggestions personnalisées basées sur le contenu du panier |

---

### 3. Commandes & Tableau de Bord Gérant (`/api/orders`)

| Méthode | URL via Gateway (`:8085`) | Description |
|---|---|---|
| `POST` | `/api/orders` | Valider le panier et créer une commande (vérifie l'utilisateur via `identity-service`) |
| `GET` | `/api/orders` | Lister les commandes (filtre optionnel `?user_id=X`) |
| `GET` | `/api/orders/{id}` | Consulter le détail complet d'une commande |
| `PUT` | `/api/orders/{id}/confirm` | Confirmer la commande (statut `CONFIRMED`) |
| `PUT` | `/api/orders/{id}/cancel` | Annuler la commande et réintégrer le stock des articles |
| `DELETE` | `/api/orders/{id}` | Supprimer une commande en attente |
| `GET` | `/api/orders/analytics` | **Dashboard Gérant** : Chiffre d'affaires total, panier moyen et top ventes |

---

### 4. Observabilité & Santé (`/health`, `/info`)

| Méthode | URL | Description |
|---|---|---|
| `GET` | `/health` | Statut du service et connectivité active à la BDD MySQL |
| `GET` | `/info` | Métadonnées de l'application (version, description, port) |

---

## 🧪 Exemples d'Appels via la Gateway (cURL)

### Recommandation IA pour un produit :
```bash
curl -X GET "http://localhost:8085/api/products/1/recommendations?limit=3" \
  -H "Accept: application/json"
```

### Statistiques & Chiffre d'Affaires du Gérant :
```bash
curl -X GET "http://localhost:8085/api/orders/analytics" \
  -H "Accept: application/json"
```

### Ajout d'un article au panier :
```bash
curl -X POST "http://localhost:8085/api/cart/1/items" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 1, "quantity": 2}'
```

### Validation de commande (Communication Inter-Service avec Identity) :
```bash
curl -X POST "http://localhost:8085/api/orders" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1}'
```

---

## 👥 Intégration dans le Projet SportBook

Ce microservice fait partie intégrante du dépôt partagé `web-sportbook` :
- **Branche de travail** : `feature/marketplace-service`
- **Isolation stricte** : Aucun fichier racine partagé (`api-gateway`, `eureka-server`, `identity-user-service`) n'est altéré.
- **Portée Git** : L'ensemble des développements est confiné dans le sous-dossier `marketplace-service/`.
