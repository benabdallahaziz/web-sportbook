"""
Identification de l'utilisateur et contrôle d'appartenance (ownership).

Deux sources d'identité :
  1. SECURITY_ENABLED = True  : jeton JWT Bearer (Keycloak, Atelier 9) -> sub + rôles du realm.
  2. SECURITY_ENABLED = False : en-têtes transmis par le frontend via la Gateway
         X-User-Id: 12
         X-User-Roles: GERANT,SPORTIF
     (même convention que tournament-events-service et identity-user-service).

Règles :
  - lecture (GET) publique ;
  - écriture réservée à ADMIN / GERANT ;
  - un GERANT ne modifie que les complexes dont il est propriétaire (venue.owner_id == user.id),
    et les terrains de ces complexes. ADMIN peut tout faire.
"""
import logging
from typing import List, Optional

import jwt
from fastapi import Depends, Header, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

logger = logging.getLogger("venue-security")

security_bearer = HTTPBearer(auto_error=False)

ROLE_ALIASES = {"OWNER": "GERANT", "MANAGER": "GERANT", "USER": "SPORTIF"}


def _norm_role(role: str) -> str:
    r = str(role).strip().upper()
    if r.startswith("ROLE_"):
        r = r[5:]
    return ROLE_ALIASES.get(r, r)


class CurrentUser:
    def __init__(self, user_id: Optional[int], roles: List[str], username: Optional[str] = None, email: Optional[str] = None):
        self.id = user_id
        self.roles = sorted({_norm_role(r) for r in roles if str(r).strip()})
        self.username = username
        self.email = email

    @property
    def is_authenticated(self) -> bool:
        return self.id is not None

    @property
    def is_admin(self) -> bool:
        return "ADMIN" in self.roles

    def has_role(self, role: str) -> bool:
        return _norm_role(role) in self.roles

    def __repr__(self) -> str:
        return f"CurrentUser(id={self.id}, roles={self.roles})"


def _to_int(value) -> Optional[int]:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_roles: Optional[str] = Header(None, alias="X-User-Roles"),
) -> CurrentUser:
    """Utilisateur courant ; anonyme (id None, aucun rôle) si rien n'est transmis."""
    if settings.SECURITY_ENABLED and credentials:
        try:
            payload = jwt.decode(
                credentials.credentials,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
                options={"verify_signature": False},  # signature vérifiée par la Gateway / Keycloak
            )
        except jwt.PyJWTError as e:
            logger.warning("Jeton JWT invalide : %s", e)
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Jeton invalide ou expiré : {e}",
                                headers={"WWW-Authenticate": "Bearer"})
        roles: List[str] = list(payload.get("realm_access", {}).get("roles", []))
        for client_data in payload.get("resource_access", {}).values():
            roles.extend(client_data.get("roles", []))
        if isinstance(payload.get("roles"), list):
            roles.extend(payload["roles"])
        user_id = _to_int(payload.get("user_id", payload.get("sub")))
        return CurrentUser(user_id, roles, payload.get("preferred_username"), payload.get("email"))

    if settings.SECURITY_ENABLED and not credentials:
        return CurrentUser(None, [])

    return CurrentUser(_to_int(x_user_id), (x_user_roles or "").split(","))


def require_role(allowed_roles: List[str]):
    """Dépendance FastAPI : 401 si anonyme, 403 si aucun des rôles requis."""
    wanted = {_norm_role(r) for r in allowed_roles}

    def role_checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not user.is_authenticated:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Connexion requise pour cette action.")
        if not (set(user.roles) & wanted):
            raise HTTPException(status.HTTP_403_FORBIDDEN,
                                f"Accès refusé : rôle requis {' ou '.join(sorted(wanted))}.")
        return user

    return role_checker


def ensure_venue_owner(user: CurrentUser, venue) -> None:
    """403 si l'utilisateur n'est ni ADMIN ni propriétaire du complexe."""
    if user.is_admin:
        return
    if venue.owner_id is None or venue.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Vous n'êtes pas le propriétaire de ce complexe.")
