# SportBook Web (Angular 19)

Interface web reliée aux microservices via l'API Gateway (`http://localhost:8085`).

## Lancer
```bash
npm install
npm start          # http://localhost:4200
```
Démarrer avant : MySQL (XAMPP), `eureka-server`, `api-gateway`, puis les microservices.

## Configuration
L'URL de la Gateway est dans `src/app/core/config.ts`.

## Structure
```
src/app/
├── core/        api.service (HTTP générique), auth.service, guards, error.interceptor,
│                notify.service (notifications), models
├── layout/      shell (menu latéral + zone de contenu), toast-host (notifications)
├── shared/      crud-page : page liste / ajout / modification / suppression pilotée par une config
└── features/
    ├── auth/         login, inscription          → /api/auth
    ├── users/        profil, administration      → /api/users
    ├── dashboard/    état des modules
    ├── venues/       complexes, terrains         → /api/venues, /api/fields
    ├── bookings/     réservations, créneaux      → /api/bookings, /api/timeslots
    ├── marketplace/  produits, panier, commandes → /api/products, /api/cart, /api/orders
    ├── tournaments/  pages dédiées (voir ci-dessous)
    ├── coaches/      coachs, programmes, séances → /api/coaches, /api/programs, /api/sessions
    ├── modules.ts          menu + tableau de bord (source unique)
    └── module-configs.ts   champs de chaque ressource CRUD générique
```
Chaque module est chargé à la demande (lazy loading).

## Module Tournois & Statistiques

Contrairement aux autres modules (CRUD générique), ce module a ses propres pages,
car il exploite des sous-ressources, des noms joints et un second microservice.

| Route | Page | Microservice / endpoints |
|---|---|---|
| `/tournaments/list` | Tournois : chiffres clés, filtres par statut, cartes, changement de statut rapide (PATCH) | tournament-events (Node.js) · `/api/tournaments` |
| `/tournaments/list/:id` | Fiche tournoi : équipes inscrites, tours & calendrier avec saisie des scores, classement du tournoi | `/api/tournaments/:id/teams`, `/api/tournaments/:id/rounds`, `/api/matches`, `/api/stats/ranking` |
| `/tournaments/teams` | Équipes + fiche statistique (courbe Elo, historique) | `/api/teams`, `/api/stats/teams/:id` |
| `/tournaments/matches` | Tableau des scores, filtres, programmation d'un match (tournoi → tour → équipes) | `/api/matches`, `/api/matches/:id/score` |
| `/tournaments/ranking` | Podium, classement Elo / points, pronostic entre deux équipes, resynchronisation | stats-service (Python) · `/api/stats/**` |

Fichiers :
```
features/tournaments/
├── tournament.models.ts         types alignés sur les réponses JSON (snake_case)
├── tournament-api.service.ts    tous les appels du module (via la Gateway)
├── tournament-ui.ts             pastille de statut, forme V/N/D, avatar d'équipe, dates FR
├── ranking-table.component.ts   tableau de classement réutilisable
├── tournaments-list / tournament-detail / teams / matches / ranking  (.ts + .html)
└── tournaments.routes.ts
```

Les erreurs de validation renvoyées par l'API (`{ status, message, details[] }`) sont
affichées dans le formulaire concerné ; les autres erreurs et les succès apparaissent
en notification.

## Ajouter une ressource (CRUD générique)
1. Ajouter une `CrudConfig` dans `module-configs.ts`.
2. L'ajouter dans les routes du module (`*.routes.ts`) et dans `modules.ts`.

## Points à connaître
- `identity-user-service` ne renvoie pas de jeton JWT : la session est l'objet utilisateur stocké dans `localStorage`, et les guards ne protègent que l'interface. Les endpoints restent ouverts côté API tant que Spring Security n'est pas configuré avec JWT.
- Les noms de champs JSON des modules génériques sont déduits du schéma SQL (camelCase). Si un microservice utilise d'autres noms, modifier `key` dans `module-configs.ts`.
- La Gateway doit autoriser `PATCH` en CORS et dédoublonner les en-têtes CORS des microservices
  (voir `api-gateway/src/main/resources/application.properties` du dépôt backend :
  `allowedMethods` avec PATCH et le filtre `DedupeResponseHeader`).
