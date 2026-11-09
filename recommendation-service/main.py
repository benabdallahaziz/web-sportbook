"""
recommendation-service – Python 3.11 / FastAPI
Port: 8090
Microservice de recommandation de coachs par similarité cosinus
Auteur: SportBook – Atelier Avancé
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import json

from app.routers import recommendations
from app.eureka_client import start_eureka, stop_eureka

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Démarrage et arrêt du service (Eureka registration)"""
    logger.info("🚀 Démarrage du service de recommandation sur le port 8090...")
    asyncio.create_task(start_eureka())
    yield
    logger.info("🛑 Arrêt du service de recommandation...")
    await stop_eureka()



# Forcer UTF-8 pour tous les caractères français
class UTF8JSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        return json.dumps(content, ensure_ascii=False, allow_nan=False,
                          indent=None, separators=(",", ":")).encode("utf-8")


app = FastAPI(
    default_response_class=UTF8JSONResponse,
    title="Recommendation Service – SportBook",
    description="""
## 🎯 Service de Recommandation de Coachs

Ce microservice Python/FastAPI utilise un **algorithme de similarité cosinus** (scikit-learn)
pour recommander les meilleurs coachs à un sportif selon son profil.

### Fonctionnalités :
- 🔍 **Recommandation personnalisée** : TOP 3 coachs selon objectif, niveau, et budget
- 📊 **Score de compatibilité** : score de 0 à 100% entre un sportif et un coach
- 🏆 **Coachs populaires** : classement basé sur le nombre de sessions
- 🔗 **Communication avec coach-training-service** : appels REST synchrones

### Architecture :
```
Client → API Gateway (8085) → recommendation-service (8090)
                                    ↓
                          coach-training-service (8087)
```
    """,
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(recommendations.router, prefix="/api/recommendations", tags=["Recommandations"])


@app.get("/actuator/health", tags=["Health"])
async def health():
    """Endpoint de santé pour Eureka"""
    return {"status": "UP", "service": "recommendation-service", "port": 8090}


@app.get("/", tags=["Info"])
async def root():
    return {
        "service": "recommendation-service",
        "language": "Python 3.11 / FastAPI",
        "algorithm": "Cosine Similarity (scikit-learn)",
        "port": 8090,
        "docs": "http://localhost:8090/docs",
        "endpoints": [
            "GET /api/recommendations/coaches",
            "GET /api/recommendations/coaches/{coachId}/compatibility",
            "GET /api/recommendations/popular"
        ]
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8090, reload=True)

