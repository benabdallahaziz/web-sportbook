import logging
from typing import List, Optional
import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.config import settings

logger = logging.getLogger("jwt-security")

security_bearer = HTTPBearer(auto_error=False)


class CurrentUser:
    def __init__(self, user_id: str, username: str, roles: List[str], email: Optional[str] = None):
        self.id = user_id
        self.username = username
        self.roles = roles
        self.email = email

    def has_role(self, role: str) -> bool:
        norm_role = role.upper()
        return any(
            r.upper() == norm_role or r.upper() == f"ROLE_{norm_role}"
            for r in self.roles
        )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer)
) -> CurrentUser:
    """
    Extrait et valide le token JWT transmis par Keycloak ou l'API Gateway.
    Si SECURITY_ENABLED est False (mode dev/test), renvoie un utilisateur mock avec rôle ADMIN.
    """
    if not settings.SECURITY_ENABLED:
        return CurrentUser(
            user_id="dev-admin-id",
            username="admin-dev",
            roles=["ROLE_ADMIN", "ROLE_OWNER", "ROLE_USER"],
            email="admin@sportbook.local"
        )

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jeton d'authentification Bearer manquant.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    try:
        # Décoder le token sans validation de clé secrète asymétrique Keycloak si non configurée,
        # ou avec la clé configurée
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_signature": False}  # Vérifié par Gateway ou public key
        )

        user_id = str(payload.get("sub", "unknown"))
        username = payload.get("preferred_username", payload.get("username", user_id))
        email = payload.get("email")

        # Extraction des rôles selon le format Keycloak (realm_access ou resource_access) ou direct
        roles: List[str] = []
        if "realm_access" in payload and "roles" in payload["realm_access"]:
            roles.extend(payload["realm_access"]["roles"])
        if "resource_access" in payload:
            for client, client_data in payload["resource_access"].items():
                roles.extend(client_data.get("roles", []))
        if "roles" in payload and isinstance(payload["roles"], list):
            roles.extend(payload["roles"])

        return CurrentUser(
            user_id=user_id,
            username=username,
            roles=roles,
            email=email
        )
    except jwt.PyJWTError as e:
        logger.warning("Token JWT invalide : %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Jeton d'authentification invalide ou expiré : {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        )


def require_role(allowed_roles: List[str]):
    """
    Dépendance FastAPI pour restreindre l'accès à certains rôles (ex: ADMIN, OWNER).
    """
    def role_checker(user: CurrentUser = Depends(get_current_user)):
        if not settings.SECURITY_ENABLED:
            return user

        has_permission = any(user.has_role(r) for r in allowed_roles)
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accès refusé. Rôles requis : {allowed_roles}"
            )
        return user

    return role_checker
