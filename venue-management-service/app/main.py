import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.eureka import start_eureka, stop_eureka
from app.routers import venues, fields, actuator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("venue-management-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup:
    logger.info("Starting up %s on port %d...", settings.APP_NAME, settings.PORT)
    init_db()

    # Start Eureka registration in background
    await start_eureka()

    yield

    # Shutdown:
    logger.info("Shutting down %s...", settings.APP_NAME)
    await stop_eureka()


tags_metadata = [
    {
        "name": "Venues",
        "description": "Opérations sur les complexes sportifs (clubs, salles, horaires d'ouverture).",
    },
    {
        "name": "Fields",
        "description": "Opérations sur les terrains de sport (tarification par heure, discipline, rattachement).",
    },
    {
        "name": "Actuator / Observabilité",
        "description": "Endpoints d'observabilité équivalents à Spring Boot Actuator (/health, /info, /metrics).",
    },
    {
        "name": "Health",
        "description": "Vérification basique de disponibilité.",
    },
]

app = FastAPI(
    title="SportBook – Venue Management Service",
    description="""
### Microservice de Gestion des Complexes & Terrains Sportifs
Ce composant gère l'infrastructure sportive de l'écosystème **SportBook** (Projet fil rouge ESPRIT - Applications Web Distribuées).

**Fonctionnalités & Intégrations :**
* **Service Discovery :** Netflix Eureka Client (`venue-management-service`)
* **API Gateway :** Spring Cloud Gateway routes `/api/venues/**` et `/api/fields/**`
* **Observabilité :** Endpoints `/actuator/health`, `/actuator/info`, `/actuator/metrics`
* **Communication Synchrone :** Validation du gérant via `identity-user-service`
* **Communication Asynchrone :** Publication d'événements RabbitMQ (`venue.*`, `field.*`)
* **Sécurité :** Authentification JWT compatible Keycloak & contrôle d'accès RBAC
""",
    version="1.0.0",
    openapi_tags=tags_metadata,
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(venues.router)
app.include_router(fields.router)
app.include_router(actuator.router)


@app.get("/", tags=["Health"])
def root():
    return {
        "service": settings.APP_NAME,
        "status": "UP",
        "docs": "/docs",
        "actuator": "/actuator",
        "endpoints": {
            "venues": "/api/venues",
            "fields": "/api/fields",
            "actuator_health": "/actuator/health",
            "actuator_info": "/actuator/info",
            "actuator_metrics": "/actuator/metrics"
        }
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "UP", "service": settings.APP_NAME}
