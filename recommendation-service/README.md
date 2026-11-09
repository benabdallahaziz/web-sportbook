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

Le vecteur de caractéristiques a **20 dimensions** :
- `goal[6]` : objectif du sportif encodé (perte_de_poids, musculation, endurance, yoga, nutrition, football)
- `level[3]` : niveau (débutant, intermédiaire, avancé)
- `budget[1]` : budget normalisé (0–1)
- `days[7]` : jours disponibles (lundi→dimanche)
- `time[3]` : créneau horaire (matin, après-midi, soir)

```
score = cos(θ) = (sportif_vec · coach_vec) / (|sportif_vec| × |coach_vec|)
```

Score de 0 (aucune compatibilité) à 1 (compatibilité parfaite).

