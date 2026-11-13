# Coach & Training Service – .NET 8

## Contrat d'intégration
| Propriété | Valeur |
|---|---|
| Nom Eureka | `coach-training-service` |
| Port | **8087** |
| Préfixes | `/api/coaches/**`, `/api/programs/**`, `/api/sessions/**` |
| Base de données | `sportbook_coach` (MySQL XAMPP) |

## Prérequis
- .NET 8 SDK
- XAMPP (MySQL lancé sur le port 3306)
- Eureka Server démarré sur `http://localhost:8761`

## 1. Installer les packages NuGet (une seule fois)
```bash
cd coach-training-service
dotnet add package Pomelo.EntityFrameworkCore.MySql --version 8.0.3
dotnet add package Microsoft.EntityFrameworkCore.Design --version 8.0.11
dotnet add package Steeltoe.Discovery.Eureka --version 3.2.8
dotnet add package Swashbuckle.AspNetCore --version 6.9.0
```

## 2. Lancer le service
```bash
dotnet run
```
Le service démarre sur **http://localhost:8087**.

## 3. Interface Swagger (tests)
Ouvrez http://localhost:8087/swagger dans votre navigateur.

## 4. Tester via l'API Gateway (port 8085)
```
GET  http://localhost:8085/api/coaches
POST http://localhost:8085/api/coaches
GET  http://localhost:8085/api/programs
POST http://localhost:8085/api/sessions
```

## Endpoints disponibles

### Coachs (`/api/coaches`)
| Méthode | URL | Description |
|---|---|---|
| GET | `/api/coaches` | Liste tous les coachs (filtre `?speciality=Football`) |
| GET | `/api/coaches/{id}` | Détail d'un coach |
| POST | `/api/coaches` | Créer un coach |
| PUT | `/api/coaches/{id}` | Modifier un coach |
| PATCH | `/api/coaches/{id}/rating` | Mettre à jour la note |
| DELETE | `/api/coaches/{id}` | Supprimer un coach |
| POST | `/api/coaches/{id}/availabilities` | Ajouter une disponibilité |
| POST | `/api/coaches/{id}/certifications` | Ajouter une certification |

### Programmes (`/api/programs`)
| Méthode | URL | Description |
|---|---|---|
| GET | `/api/programs` | Tous les programmes |
| GET | `/api/programs/{id}` | Détail d'un programme |
| GET | `/api/programs/coach/{coachId}` | Programmes d'un coach |
| POST | `/api/programs` | Créer un programme |
| PUT | `/api/programs/{id}` | Modifier un programme |
| DELETE | `/api/programs/{id}` | Supprimer |

### Séances (`/api/sessions`)
| Méthode | URL | Description |
|---|---|---|
| GET | `/api/sessions/{id}` | Détail d'une séance |
| GET | `/api/sessions/program/{programId}` | Planning d'un programme |
| GET | `/api/sessions/user/{userId}` | Séances d'un sportif |
| POST | `/api/sessions` | Planifier une séance |
| POST | `/api/sessions/{id}/register` | Inscrire un sportif |
| PATCH | `/api/sessions/{id}/status` | Changer le statut |
| DELETE | `/api/sessions/{id}` | Supprimer |

