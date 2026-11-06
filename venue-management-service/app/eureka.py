import asyncio
import logging
import socket
from urllib.parse import urlparse
import py_eureka_client.eureka_client as eureka_client
from app.config import settings

logger = logging.getLogger("eureka-client")

_eureka_task: asyncio.Task | None = None
_registered = False


def _is_server_reachable(eureka_url: str, timeout: float = 1.0) -> bool:
    try:
        parsed = urlparse(eureka_url)
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or 8761
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


async def _register_loop():
    global _registered
    while not _registered:
        if _is_server_reachable(settings.EUREKA_SERVER, timeout=1.0):
            try:
                logger.info("Eureka Server detected at %s. Registering...", settings.EUREKA_SERVER)
                await eureka_client.init_async(
                    eureka_server=settings.EUREKA_SERVER,
                    app_name=settings.APP_NAME,
                    instance_port=settings.PORT,
                    instance_host=settings.INSTANCE_HOST,
                    renewal_interval_in_secs=10,
                    duration_in_secs=30
                )
                _registered = True
                logger.info("Successfully registered on Eureka as '%s' on port %d!", settings.APP_NAME, settings.PORT)
                break
            except Exception as e:
                logger.warning("Error during Eureka registration: %s. Will retry...", e)
        else:
            logger.info("Eureka Server (%s) is offline. Microservice is running locally. Will retry connection in 10s...", settings.EUREKA_SERVER)

        await asyncio.sleep(10)


async def start_eureka():
    global _eureka_task
    if not settings.EUREKA_ENABLED:
        logger.info("Eureka registration disabled.")
        return

    _eureka_task = asyncio.create_task(_register_loop())


async def stop_eureka():
    global _eureka_task, _registered
    if _eureka_task and not _eureka_task.done():
        _eureka_task.cancel()
        try:
            await _eureka_task
        except asyncio.CancelledError:
            pass
    if _registered:
        try:
            logger.info("Unregistering from Eureka Server...")
            await eureka_client.stop_async()
            logger.info("Unregistered from Eureka.")
        except Exception as e:
            logger.warning("Error while unregistering from Eureka: %s", e)
        finally:
            _registered = False
