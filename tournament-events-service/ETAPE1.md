# Étape 1 : API REST + client JavaScript natif

Service : **tournament-events-service** (Node.js / Express / MySQL, port 8086)

## 1. Audit REST : ce qui a été corrigé

| Principe | Avant | Après |
|---|---|---|
| URLs = ressources (noms, pas de verbes) | `POST /api/tournaments/:id/register` | `POST /api/tournaments/:id/teams` (l'ancienne URL reste disponible, marquée *deprecated*) |
| PATCH = modification partielle | seulement `/matches/:id/score` | `PATCH` sur `/tournaments/:id`, `/teams/:id`, `/matches/:id` |
| PUT = remplacement complet validé | aucun contrôle → erreur SQL **500** si `name` manquait | validation → **400** avec la liste des champs invalides |
| Réponse de PUT/PATCH | `{ message: "mis à jour" }` | la ressource mise à jour (le client n'a pas besoin de refaire un GET) |
| POST | ressource reconstruite à la main | **201** + en-tête `Location: /api/teams/7` + ressource relue en base |
| DELETE | **200** + message | **204 No Content** (rien à renvoyer) |
| Erreurs | `{error}` ou `{message}`, messages SQL exposés au client | format unique `{ status, message, details? }`, SQL jamais exposé |
| JSON mal formé | **500** | **400** |
| `/api/teams/abc` | requête SQL inutile | **400** (id non numérique) |
| Référence inexistante (`team1_id: 999`) | **500** (erreur de clé étrangère) | **400** `"team1_id" fait référence à une ressource inexistante` |
| Supprimer une équipe qui joue un match | **500** | **409 Conflict** |
| Base de données arrêtée | **500** | **503 Service Unavailable** |
| Dates | `2027-03-31T23:00:00.000Z` (décalage de fuseau) | `2027-04-01` (`dateStrings: true`) |

### Codes de réponse utilisés

| Code | Quand |
|---|---|
| 200 OK | GET, PUT, PATCH réussis |
| 201 Created | POST réussi (+ `Location`) |
| 204 No Content | DELETE réussi |
| 400 Bad Request | données invalides, JSON mal formé, id non numérique |
| 404 Not Found | ressource ou route inexistante |
| 409 Conflict | doublon (équipe déjà inscrite), suppression d'une ressource utilisée |
| 500 Internal Server Error | bug imprévu (détail uniquement dans les logs serveur) |
| 503 Service Unavailable | MySQL injoignable |

### Endpoints

| Méthode | URL | Rôle |
|---|---|---|
| GET / POST | `/api/tournaments` | lister / créer |
| GET / PUT / PATCH / DELETE | `/api/tournaments/:id` | lire / remplacer / modifier / supprimer |
| GET / POST | `/api/tournaments/:id/teams` | équipes inscrites / inscrire une équipe |
| DELETE | `/api/tournaments/:id/teams/:teamId` | désinscrire |
| GET / POST | `/api/tournaments/:id/rounds` | tours du tournoi (nécessaires pour créer un match) |
| GET / POST | `/api/teams` | lister / créer |
| GET / PUT / PATCH / DELETE | `/api/teams/:id` | |
| GET / POST | `/api/matches` (`?tournament_id=`) | lister (filtre) / créer |
| GET / PUT / PATCH / DELETE | `/api/matches/:id` | |
| PATCH | `/api/matches/:id/score` | saisir le score |
| GET | `/health` | santé (Eureka) |

## 2. Organisation du code

```
src/
  app.js                       middlewares, CORS, front statique, routes, erreurs
  config/db.js                 pool MySQL
  config/swagger.js            OpenAPI : schémas, paramètres, réponses communes
  routes/*.routes.js           URL → contrôleur + commentaires @swagger
  controllers/*.controller.js  logique métier (valide → SQL → réponse)
  validators/schemas.js        règles de chaque ressource
  utils/validate.js            moteur de validation (sans dépendance)
  utils/http.js                ApiError, asyncHandler, parseId
  middlewares/error.middleware.js  404 + traduction des erreurs → JSON
public/                        front HTML + CSS + JS natif
postman/                       collection de tests
```

**Pourquoi un middleware d'erreurs unique ?** Les contrôleurs se contentent de `throw new ApiError(404, '...')`.
Un seul endroit décide du format JSON et du code HTTP, ce qui garantit des réponses cohérentes.

## 3. Front-end (`public/`)

- Servi par Express sur **http://localhost:8086/**.
- Toute la communication passe par la fonction `api(method, path, body)` dans `public/app.js` :
  - `fetch()` + `JSON.stringify` / `res.json()`
  - **serveur arrêté** : `fetch` rejette (TypeError), message « Impossible de joindre le serveur… »
  - **délai dépassé** : `AbortController` (8 s)
  - **4xx / 5xx** : `fetch` ne rejette PAS, on teste `res.ok` et on affiche le `message` + les `details` renvoyés par l'API
  - **204** : pas de corps à lire
- Les formulaires ont `novalidate` : la validation de référence est **côté serveur**, et le front affiche les erreurs 400 qu'il reçoit (pratique pour la démonstration).
- Toutes les données affichées passent par `esc()` (protection XSS).

| Action dans l'interface | Requête |
|---|---|
| Ouverture de la page | `GET /api/tournaments`, `GET /api/teams`, `GET /api/matches` |
| Ajouter | `POST` |
| Modifier (formulaire) | `PUT` |
| Changer le statut d'un tournoi (liste déroulante) | `PATCH /api/tournaments/:id` |
| Saisir un score | `PATCH /api/matches/:id/score` |
| Supprimer | `DELETE` |
| Gérer (tournoi) | `GET/POST/DELETE /api/tournaments/:id/teams`, `GET/POST …/rounds` |

## 4. CORS

Le navigateur bloque un `fetch()` vers une **autre origine** (protocole + domaine + port) si le serveur ne l'autorise pas.

- Front servi par Express (`localhost:8086` → `localhost:8086`) : même origine, CORS inutile.
- Front ouvert avec Live Server (`127.0.0.1:5500` → `localhost:8086`) : origine différente, CORS nécessaire.

Le middleware de `app.js` ajoute `Access-Control-Allow-Origin` et répond **204** au *preflight* `OPTIONS`.
Le navigateur envoie ce preflight avant tout PUT/PATCH/DELETE ou tout body JSON.
En production, on remplace `*` par l'origine exacte via la variable `CORS_ORIGIN`.

## 5. Lancer et tester

```bash
# 1. XAMPP : démarrer MySQL, puis importer database/sportbook_databases.sql (phpMyAdmin)
#    ou : node scripts/import-db.js
cd tournament-events-service
npm install
npm start
```

| URL | Contenu |
|---|---|
| http://localhost:8086/ | interface web |
| http://localhost:8086/api-docs | Swagger UI (bouton *Try it out*) |
| http://localhost:8086/api-docs.json | spécification OpenAPI (importable dans Postman) |

**Tests automatiques :**
```bash
node scripts/test-crud.js            # 65 vérifications
```

**Postman / Thunder Client :** *Import* → `postman/tournament-events.postman_collection.json`,
puis *Run collection* (les ids sont chaînés automatiquement). Pour régénérer : `node scripts/build-postman.js`.

**Démonstration des erreurs dans le front :**

| Scénario | Résultat attendu |
|---|---|
| Arrêter `npm start` puis cliquer « Actualiser » | « Impossible de joindre le serveur » + badge *Hors ligne* |
| Tournoi sans nom, ou date de fin avant début | 400 + liste des champs |
| Score `abc` | 400 |
| Inscrire deux fois la même équipe (via Postman) | 409 |
| Supprimer une équipe qui joue un match | 409 |
| Arrêter MySQL dans XAMPP | 503 « Base de données indisponible » |
