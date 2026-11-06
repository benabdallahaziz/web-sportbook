import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.eureka import start_eureka, stop_eureka
from app.routers import venues, fields

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


app = FastAPI(
    title="SportBook - Venue Management Service",
    description="Microservice pour la gestion des complexes sportifs, terrains et horaires.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(venues.router)
app.include_router(fields.router)


@app.get("/", tags=["Health"])
def root():
    return {
        "service": settings.APP_NAME,
        "status": "UP",
        "docs": "/docs",
        "endpoints": {
            "venues": "/api/venues",
            "fields": "/api/fields"
        }
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "UP", "service": settings.APP_NAME}
