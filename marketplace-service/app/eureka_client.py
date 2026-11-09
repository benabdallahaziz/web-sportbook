"""
Enregistrement / désenregistrement auprès d'Eureka (Netflix OSS).
Le service s'enregistre au démarrage et envoie un heartbeat toutes les 30 s.
"""
import asyncio
import logging
import socket

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

EUREKA_APP_URL = f"{settings.eureka_url}/apps/{settings.service_name.upper()}"

_REGISTRATION_PAYLOAD = {
    "instance": {
        "instanceId":    f"{settings.service_host}:{settings.service_name}:{settings.service_port}",
        "hostName":      settings.service_host,
        "app":           settings.service_name.upper(),
        "ipAddr":        socket.gethostbyname(socket.gethostname()),
        "status":        "UP",
        "port":          {"$": settings.service_port, "@enabled": "true"},
        "securePort":    {"$": 443,                   "@enabled": "false"},
        "vipAddress":    settings.service_name,
        "homePageUrl":   f"http://{settings.service_host}:{settings.service_port}/",
        "statusPageUrl": f"http://{settings.service_host}:{settings.service_port}/info",
        "healthCheckUrl":f"http://{settings.service_host}:{settings.service_port}/health",
        "dataCenterInfo": {
            "@class": "com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo",
            "name":   "MyOwn",
        },
        "leaseInfo": {
            "renewalIntervalInSecs": 30,
            "durationInSecs":        90,
        },
        "metadata": {"management.port": str(settings.service_port)},
    }
}


async def register_with_eureka() -> None:
    """Envoie la requête POST d'enregistrement à Eureka."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                EUREKA_APP_URL,
                json=_REGISTRATION_PAYLOAD,
                headers={"Content-Type": "application/json"},
            )
        if resp.status_code in (200, 204):
            logger.info("✅  Enregistré sur Eureka : %s", EUREKA_APP_URL)
        else:
            logger.warning("⚠️  Eureka a répondu %s : %s", resp.status_code, resp.text)
    except Exception as exc:
        logger.warning("⚠️  Impossible de joindre Eureka : %s", exc)


async def send_heartbeat() -> None:
    """Renouvelle le bail Eureka (PUT) toutes les 30 secondes."""
    instance_id = _REGISTRATION_PAYLOAD["instance"]["instanceId"]
    url = f"{EUREKA_APP_URL}/{instance_id}"
    while True:
        await asyncio.sleep(30)
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.put(url)
        except Exception as exc:
            logger.debug("Heartbeat Eureka échoué : %s", exc)


async def deregister_from_eureka() -> None:
    """Supprime l'instance d'Eureka à l'arrêt du service."""
    instance_id = _REGISTRATION_PAYLOAD["instance"]["instanceId"]
    url = f"{EUREKA_APP_URL}/{instance_id}"
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.delete(url)
        logger.info("🔴  Désenregistré d'Eureka.")
    except Exception as exc:
        logger.debug("Désenregistrement Eureka échoué : %s", exc)
