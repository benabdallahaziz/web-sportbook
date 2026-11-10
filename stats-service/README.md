# stats-service (PHP)

Microservice Stats. Port 8088.

## Lancer
docker build -t stats-service .
docker run -p 8088:8088 stats-service

## Routes
| Méthode | Route | Description |
|---|---|---|
| POST | /api/stats/events | Créer un événement : {"type":"booking_created","description":"..."} |
| GET | /api/stats/events | Lister les événements |
| GET | /api/stats/events/{id} | Voir un événement |
| PUT | /api/stats/events/{id} | Modifier un événement |
| DELETE | /api/stats/events/{id} | Supprimer un événement |
| GET | /api/stats | Voir tous les compteurs |
| GET | /api/stats/{type} | Voir le compteur d'un type |

Types proposés : user_registered, booking_created, order_created,
tournament_created, session_created.