"""Service Discovery avec Eureka.

1. register()  : inscrit stats-service dans Eureka (py-eureka-client envoie
                 ensuite un heartbeat toutes les 30 s).
2. resolve()   : équivalent de « lb://tournament-events-service » en Spring :
                 on demande à Eureka les instances UP du service et on en
                 choisit une à tour de rôle (round-robin = load balancing).
"""
import itertools
import logging

import httpx
import py_eureka_client.eureka_client as eureka_client

from . import config

log = logging.getLogger("stats.discovery")
_round_robin = itertools.count()


async def register() -> None:
    base = f"http://{config.HOST}:{config.PORT}"
    try:
        await eureka_client.init_async(
            eureka_server=config.EUREKA_SERVER,
            app_name=config.SERVICE_NAME,
            instance_host=config.HOST,
            instance_port=config.PORT,
            health_check_url=f"{base}/health",
            status_page_url=f"{base}/info",
        )
        log.info("Enregistré dans Eureka sous le nom %s", config.SERVICE_NAME)
    except Exception as exc:  # Eureka arrêté : le service fonctionne quand même
        log.warning("Enregistrement Eureka impossible (%s) : le service tourne sans Eureka", exc)


async def unregister() -> None:
    try:
        await eureka_client.stop_async()
    except Exception:
        pass


def resolve(app_name: str, fallback_url: str) -> str:
    """Renvoie l'URL d'une instance UP de app_name, ou fallback_url si Eureka ne répond pas."""
    try:
        response = httpx.get(
            f"{config.EUREKA_SERVER}/apps/{app_name.upper()}",
            headers={"Accept": "application/json"},
            timeout=3,
        )
        response.raise_for_status()
        instances = response.json()["application"]["instance"]
        if isinstance(instances, dict):  # Eureka renvoie un objet s'il n'y a qu'une instance
            instances = [instances]
        up = [i for i in instances if i.get("status") == "UP"]
        if up:
            instance = up[next(_round_robin) % len(up)]
            host = instance.get("ipAddr") or instance["hostName"]
            return f"http://{host}:{instance['port']['$']}"
        log.warning("Aucune instance UP de %s dans Eureka, URL de secours utilisée", app_name)
    except Exception as exc:
        log.warning("Eureka injoignable pour résoudre %s (%s), URL de secours utilisée", app_name, exc)
    return fallback_url
