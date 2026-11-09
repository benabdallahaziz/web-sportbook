"""
SportBook – Marketplace Service
Port : 8084  |  Préfixes : /api/products  /api/cart  /api/orders
Enregistrement Eureka : marketplace-service
"""
import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config   import settings
from app.database import engine, Base

# Import des modèles pour que SQLAlchemy les enregistre avant create_all
import app.models  # noqa: F401

from app.routers          import products_router, cart_router, orders_router
from app.eureka_client    import register_with_eureka, send_heartbeat, deregister_from_eureka

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s : %(message)s",
)
logger = logging.getLogger(__name__)

# ── Application FastAPI ───────────────────────────────────────
app = FastAPI(
    title="SportBook – Marketplace Service",
    description=(
        "Boutique sportive de la plateforme SportBook.\n\n"
        "Endpoints disponibles :\n"
        "- **`/api/products`** – Produits & catégories\n"
        "- **`/api/cart`**     – Gestion du panier\n"
        "- **`/api/orders`**   – Commandes\n"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    servers=[
        {"url": "http://localhost:8085", "description": "Via API Gateway (Port 8085 - Recommandé)"},
        {"url": "http://localhost:8084", "description": "Direct Marketplace Service (Port 8084)"},
    ],
)

# ── CORS ─────────────────────────────────────────────────────
# Note: L'API Gateway (port 8085) gère déjà le CORS globalement pour tous les microservices.
# Si la requête n'arrive pas par la Gateway (ex: appel direct inter-domaines), on ajoute le header.
@app.middleware("http")
async def cors_middleware(request, call_next):
    response = await call_next(request)
    # Si la requête ne passe pas par la Gateway (appel direct inter-domaines), on ajoute le header CORS
    if "x-forwarded-for" not in request.headers and "x-forwarded-host" not in request.headers and "forwarded" not in request.headers:
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# ── Routers ───────────────────────────────────────────────────
app.include_router(products_router)
app.include_router(cart_router)
app.include_router(orders_router)


# ── Events de cycle de vie ────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logger.info("🚀  Démarrage du Marketplace Service sur le port %s…", settings.service_port)

    # Créer les tables si elles n'existent pas
    Base.metadata.create_all(bind=engine)
    logger.info("✅  Tables vérifiées / créées.")

    # Enregistrement Eureka
    await register_with_eureka()

    # Lancer le heartbeat en tâche de fond
    asyncio.create_task(send_heartbeat())


@app.on_event("shutdown")
async def shutdown_event():
    await deregister_from_eureka()
    logger.info("🔴  Marketplace Service arrêté.")


# ── Endpoints système ─────────────────────────────────────────
@app.get("/health", tags=["Système"], summary="Health check")
def health():
    return {"status": "UP", "service": settings.service_name}


@app.get("/info", tags=["Système"], summary="Informations du service")
def info():
    return {
        "service": settings.service_name,
        "port":    settings.service_port,
        "version": "1.0.0",
        "endpoints": ["/api/products", "/api/cart", "/api/orders"],
    }


@app.get("/", tags=["Système"], summary="Accueil")
def root():
    return {
        "message": "SportBook Marketplace Service is running 🏪",
        "docs":    "/docs",
    }
