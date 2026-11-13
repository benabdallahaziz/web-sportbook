# recommendation-service – Microservice de Recommandation de Coachs

## 🎯 Description

Microservice **Python 3.11 / FastAPI** qui utilise un **algorithme de similarité cosinus** (scikit-learn) pour recommander les meilleurs coachs à un sportif selon son profil.

## 🏗️ Architecture

```
Client → API Gateway :8085 → recommendation-service :8090
                                     ↓ (REST synchrone)
                            coach-training-service :8087 (.NET 8)
```

## 🚀 Lancement

```powershell
cd recommendation-service

# 1. Installer les dépendances
C:\Users\marye\AppData\Local\Programs\Python\Python311\python.exe -m pip install -r requirements.txt

# 2. Lancer le service
C:\Users\marye\AppData\Local\Programs\Python\Python311\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8090 --reload
```

## 📋 Endpoints

| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/recommendations/coaches` | TOP 3 coachs recommandés |
| GET | `/api/recommendations/coaches/{id}/compatibility` | Score de compatibilité |
| GET | `/api/recommendations/popular` | Coachs les plus populaires |
| GET | `/actuator/health` | Statut (Eureka health check) |
| GET | `/docs` | Swagger UI |

## 🧪 Test

```powershell
# Recommandation pour un débutant en musculation
Invoke-RestMethod -Uri "http://localhost:8090/api/recommendations/coaches?userId=1&goal=musculation&level=debutant&maxBudgetPerSession=150" -Method Get

# Via la Gateway
Invoke-RestMethod -Uri "http://localhost:8085/api/recommendations/coaches?userId=1&goal=yoga&level=intermediaire" -Method Get

# Compatibilité avec un coach spécifique
Invoke-RestMethod -Uri "http://localhost:8090/api/recommendations/coaches/1/compatibility?userId=1&goal=football&level=avance" -Method Get

# Coachs populaires
Invoke-RestMethod -Uri "http://localhost:8090/api/recommendations/popular" -Method Get
```

## 🔬 Algorithme

### Similarité Cosinus

Le vecteur de caractéristiques a **23 dimensions** (sportif et coach ont la même forme) :
- `goal[9]` : objectif du sportif ↔ spécialité du coach (perte_de_poids, musculation, endurance, yoga, nutrition, football, tennis, basketball, padel), reconnus par mots-clés
- `level[3]` : niveau du sportif ↔ niveaux encadrés, déduits de la note du coach (0 à 5)
- `budget[1]` : budget normalisé (0–1) ↔ tarif du coach (neutre tant que le service Coach n'a pas de tarif)
- `days[7]` : jours préférés ↔ jours de disponibilité du coach (`availabilities.day`)
- `time[3]` : créneau (matin, après-midi, soir) ↔ heures de début des disponibilités du coach

Chaque coach recommandé est renvoyé avec **ses programmes et ses prochaines séances libres** ;
`recommendedProgram` donne **l'entraînement idéal** (premier programme réservable du meilleur coach).
La réservation se fait via `POST /api/sessions/{id}/register` (coach-training-service).

```
score = cos(θ) = (sportif_vec · coach_vec) / (|sportif_vec| × |coach_vec|)
```

Score de 0 (aucune compatibilité) à 1 (compatibilité parfaite).

