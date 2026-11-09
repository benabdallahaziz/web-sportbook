import time
import os
import sys
import psutil
from fastapi import APIRouter, status
from app.config import settings
from app.database import is_db_reachable

router = APIRouter(prefix="/actuator", tags=["Actuator / Observabilité"])

_START_TIME = time.time()


@router.get("", summary="Actuator Root Index")
def actuator_index():
    """Point d'entrée Spring Boot Actuator exposant les liens HATEOAS."""
    base = f"http://localhost:{settings.PORT}/actuator"
    return {
        "_links": {
            "self": {"href": f"{base}"},
            "health": {"href": f"{base}/health"},
            "info": {"href": f"{base}/info"},
            "metrics": {"href": f"{base}/metrics"}
        }
    }


@router.get("/health", summary="Actuator Health Indicator")
def actuator_health():
    """
    Supervision de l'état de santé du microservice (équivalent Spring Boot Actuator /health).
    Vérifie la disponibilité de la base de données MySQL et les ressources disque.
    """
    db_ok = is_db_reachable(0.5)
    overall_status = "UP" if db_ok else "DEGRADED"

    disk = psutil.disk_usage(os.path.abspath(os.sep))
    free_disk_mb = disk.free // (1024 * 1024)

    return {
        "status": overall_status,
        "components": {
            "db": {
                "status": "UP" if db_ok else "DOWN",
                "details": {
                    "database": settings.DB_NAME,
                    "host": settings.DB_HOST,
                    "reachable": db_ok
                }
            },
            "diskSpace": {
                "status": "UP" if free_disk_mb > 100 else "LOW",
                "details": {
                    "total": disk.total,
                    "free": disk.free,
                    "threshold": 100 * 1024 * 1024
                }
            },
            "discoveryComposite": {
                "status": "UP" if settings.EUREKA_ENABLED else "DISABLED",
                "details": {
                    "eurekaServer": settings.EUREKA_SERVER,
                    "serviceName": settings.APP_NAME
                }
            }
        }
    }


@router.get("/info", summary="Actuator Application Info")
def actuator_info():
    """
    Informations statiques et métadonnées sur le microservice (équivalent /actuator/info).
    """
    return {
        "app": {
            "name": settings.APP_NAME,
            "description": "Microservice de gestion des complexes sportifs et terrains",
            "version": "1.0.0",
            "framework": "FastAPI",
            "port": settings.PORT
        },
        "python": {
            "version": sys.version.split()[0],
            "executable": sys.executable
        },
        "architecture": {
            "module": "venue-management-service",
            "pattern": "Microservices Cloud Native",
            "database": "MySQL / MariaDB (sportbook_venue)",
            "discovery": "Netflix Eureka",
            "messaging": "RabbitMQ",
            "security": "Keycloak / JWT"
        }
    }


@router.get("/metrics", summary="Actuator Metrics List")
def actuator_metrics():
    """
    Liste des noms de métriques disponibles (équivalent /actuator/metrics de Spring Boot).
    """
    return {
        "names": [
            "process.uptime",
            "process.cpu.usage",
            "system.cpu.count",
            "system.memory.used",
            "system.memory.total",
            "process.threads.count"
        ]
    }


@router.get("/metrics/{metric_name}", summary="Actuator Specific Metric")
def actuator_metric_detail(metric_name: str):
    """
    Valeur détaillée d'une métrique système spécifique.
    """
    proc = psutil.Process()
    now = time.time()

    metrics_map = {
        "process.uptime": {
            "name": "process.uptime",
            "description": "Temps de fonctionnement du processus en secondes",
            "baseUnit": "seconds",
            "measurements": [{"statistic": "VALUE", "value": round(now - _START_TIME, 2)}]
        },
        "process.cpu.usage": {
            "name": "process.cpu.usage",
            "description": "Utilisation processeur du microservice",
            "baseUnit": "percent",
            "measurements": [{"statistic": "VALUE", "value": proc.cpu_percent(interval=None)}]
        },
        "system.cpu.count": {
            "name": "system.cpu.count",
            "description": "Nombre de cœurs processeur",
            "baseUnit": None,
            "measurements": [{"statistic": "VALUE", "value": psutil.cpu_count()}]
        },
        "system.memory.used": {
            "name": "system.memory.used",
            "description": "Mémoire RAM utilisée",
            "baseUnit": "bytes",
            "measurements": [{"statistic": "VALUE", "value": proc.memory_info().rss}]
        },
        "system.memory.total": {
            "name": "system.memory.total",
            "description": "Mémoire RAM totale disponible",
            "baseUnit": "bytes",
            "measurements": [{"statistic": "VALUE", "value": psutil.virtual_memory().total}]
        },
        "process.threads.count": {
            "name": "process.threads.count",
            "description": "Nombre de threads actifs dans le processus",
            "baseUnit": "threads",
            "measurements": [{"statistic": "VALUE", "value": proc.num_threads()}]
        }
    }

    if metric_name not in metrics_map:
        return {"error": f"Metric '{metric_name}' not found", "available": list(metrics_map.keys())}

    return metrics_map[metric_name]
