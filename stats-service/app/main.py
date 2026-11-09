"""Point d'entrée FastAPI du stats-service."""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import config, db, discovery, messaging, sync, tournament_client
from .routes import router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s : %(message)s")
log = logging.getLogger("stats")

_background: set[asyncio.Task] = set()


def _spawn(coro) -> asyncio.Task:
    task = asyncio.create_task(coro)
    _background.add(task)
    task.add_done_callback(_background.discard)
    return task


async def _initial_sync() -> None:
    """Au démarrage, on rattrape les matchs terminés pendant que le service était arrêté."""
    try:
        await asyncio.to_thread(sync.full_sync)
    except Exception as exc:
        log.warning("Synchronisation initiale impossible (%s) : POST /api/stats/sync plus tard", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await asyncio.to_thread(db.init_db)
        log.info("✅ Base de données prête")
    except Exception as exc:
        log.error("❌ Base de données indisponible : %s", exc)
    await discovery.register()
    consumer = _spawn(messaging.consume_forever())
    _spawn(_initial_sync())
    log.info("📊 stats-service démarré : http://%s:%d/api-docs", config.HOST, config.PORT)
    yield
    consumer.cancel()
    await discovery.unregister()


app = FastAPI(
    title="Stats Service",
    version=config.VERSION,
    description=(
        "Microservice SportBook (Python / FastAPI) : classement Elo, statistiques et pronostics.\n\n"
        "**Port :** 8088 · **Nom Eureka :** stats-service\n\n"
        "Alimenté par les événements RabbitMQ du service tournament-events (asynchrone) "
        "et par son API REST (synchrone, `POST /api/stats/sync`)."
    ),
    docs_url="/api-docs",
    openapi_url="/api-docs.json",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router)


# ─── Format d'erreur identique au service Node : { status, message, details? } ──

@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    return JSONResponse({"status": exc.status_code, "message": str(exc.detail)}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # FastAPI renvoie 422 par défaut ; on garde 400 comme dans le reste du projet
    details = [f"\"{'.'.join(str(p) for p in e['loc'][1:])}\" : {e['msg']}" for e in exc.errors()]
    return JSONResponse({"status": 400, "message": "Paramètres invalides", "details": details}, status_code=400)


@app.exception_handler(tournament_client.ServiceUnavailable)
async def remote_down(request: Request, exc: tournament_client.ServiceUnavailable):
    return JSONResponse({"status": 503, "message": f"Service distant indisponible : {exc}"}, status_code=503)


@app.exception_handler(OperationalError)
async def database_down(request: Request, exc: OperationalError):
    log.error("Base indisponible : %s", exc.orig)
    return JSONResponse({"status": 503, "message": "Base de données indisponible. Réessayez plus tard."}, status_code=503)


# ─── Observabilité (équivalent simplifié de Spring Boot Actuator) ─────────────

@app.get("/health", tags=["Monitoring"], summary="État du service et de ses dépendances")
def health():
    db_up = db.is_up()
    body = {
        "status": "UP" if db_up else "DOWN",
        "service": config.SERVICE_NAME,
        "components": {
            "db": {"status": "UP" if db_up else "DOWN"},
            "rabbitmq": {"status": "UP" if messaging.state["connected"] else "DOWN"},
        },
    }
    return JSONResponse(body, status_code=200 if db_up else 503)


@app.get("/info", tags=["Monitoring"], summary="Informations sur le service")
def info():
    return {
        "app": {"name": config.SERVICE_NAME, "version": config.VERSION, "language": "Python / FastAPI"},
        "sync": sync.status,
    }
