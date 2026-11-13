"""
app/eureka_client.py – Enregistrement du service sur Eureka
Utilise py-eureka-client pour s'enregistrer comme microservice Python
"""

import asyncio
import logging
import os
import py_eureka_client.eureka_client as eureka_client

logger = logging.getLogger(__name__)

# Docker : EUREKA_SERVER=http://eureka-server:8761/eureka et INSTANCE_HOST=recommendation-service
EUREKA_SERVER = os.getenv("EUREKA_SERVER", "http://localhost:8761/eureka")
APP_NAME = "recommendation-service"
INSTANCE_HOST = os.getenv("INSTANCE_HOST", "localhost")
INSTANCE_PORT = int(os.getenv("PORT", "8090"))


async def start_eureka():
    """Démarre l'enregistrement sur Eureka en arrière-plan"""
    try:
        await asyncio.sleep(5)  # Attendre que FastAPI soit prêt
        await eureka_client.init_async(
            eureka_server=EUREKA_SERVER,
            app_name=APP_NAME,
            instance_host=INSTANCE_HOST,
            instance_port=INSTANCE_PORT,
            health_check_url=f"http://{INSTANCE_HOST}:{INSTANCE_PORT}/actuator/health",
            status_page_url=f"http://{INSTANCE_HOST}:{INSTANCE_PORT}/docs",
        )
        logger.info(f"✅ Enregistré sur Eureka : {APP_NAME} @ {INSTANCE_HOST}:{INSTANCE_PORT}")
    except Exception as e:
        logger.warning(f"⚠️ Eureka non disponible (service continuera sans discovery) : {e}")


async def stop_eureka():
    """Désenregistre le service de Eureka à l'arrêt"""
    try:
        await eureka_client.stop_async()
        logger.info("👋 Désenregistré d'Eureka")
    except Exception as e:
        logger.warning(f"⚠️ Erreur lors du désenregistrement Eureka : {e}")

