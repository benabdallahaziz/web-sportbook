"""
Client de communication inter-microservice (Séance 7 - Communication Synchrone).
Interroge l'Identity & User Service (port 8081) pour valider les utilisateurs.
"""
import logging
import os

import httpx

logger = logging.getLogger(__name__)

# Docker : IDENTITY_SERVICE_URL=http://identity-user-service:8081
IDENTITY_SERVICE_URL = os.getenv("IDENTITY_SERVICE_URL", "http://localhost:8081").rstrip("/") + "/api/users"


def verify_user_exists(user_id: int) -> dict:
    """
    Vérifie auprès d'identity-user-service si l'utilisateur existe.
    Applique le principe de résilience (Graceful Degradation) :
    - Si Identity répond 200 : utilisateur confirmé existant.
    - Si Identity répond 404 : utilisateur inexistant (rejet de commande).
    - Si Identity est éteint / injoignable : fallback tolérant pour permettre les tests autonomes.
    """
    try:
        response = httpx.get(f"{IDENTITY_SERVICE_URL}/{user_id}", timeout=2.0)
        if response.status_code == 200:
            logger.info("✅ Utilisateur %s validé par Identity Service.", user_id)
            return {"valid": True, "data": response.json()}
        elif response.status_code == 404:
            logger.warning("❌ Utilisateur %s introuvable dans Identity Service.", user_id)
            return {"valid": False, "data": None}
    except Exception as exc:
        logger.warning(
            "⚠️ Identity Service (port 8081) injoignable (%s). "
            "Mode résilience activé (fallback autonome).",
            exc
        )
        return {"valid": True, "fallback": True}

    return {"valid": True}
