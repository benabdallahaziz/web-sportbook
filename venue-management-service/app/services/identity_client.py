import logging
import httpx
from app.config import settings

logger = logging.getLogger("identity-client")


async def verify_owner_exists(owner_id: int) -> bool:
    """
    Appel REST synchrone (équivalent OpenFeign) vers le microservice identity-user-service
    pour vérifier la validité du propriétaire avant d'assigner un complexe sportif.

    En cas de panne d'identity-user-service, applique un principe de résilience
    (dégradation gracieuse) pour ne pas bloquer les opérations métiers.
    """
    url = f"{settings.IDENTITY_SERVICE_URL}/api/users/{owner_id}"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(url)
            if response.status_code == 200:
                logger.info("Owner ID %d validé avec succès via identity-user-service.", owner_id)
                return True
            elif response.status_code == 404:
                logger.warning("Owner ID %d introuvable dans identity-user-service.", owner_id)
                return False
            else:
                logger.warning("Statut inattendu de identity-user-service (%d).", response.status_code)
                return True
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        logger.info(
            "identity-user-service (%s) inaccessible (%s). Mode résilience actif : validation permissive.",
            settings.IDENTITY_SERVICE_URL,
            exc
        )
        return True
    except Exception as e:
        logger.error("Erreur lors de l'appel synchrone vers identity-user-service: %s", e)
        return True
