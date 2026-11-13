"""Client REST du service tournament-events (équivalent Python d'OpenFeign).

Communication SYNCHRONE : stats-service attend la réponse avant de continuer.
L'adresse du service n'est pas écrite en dur : elle est résolue via Eureka.
"""
import time

import httpx

from . import config, discovery

TEAMS_CACHE_SECONDS = 30
_teams_cache: tuple[float, dict[int, str]] | None = None


class ServiceUnavailable(Exception):
    """Le service distant est arrêté ou en erreur 5xx."""


def _get(path: str):
    base = discovery.resolve(config.TOURNAMENT_SERVICE, config.TOURNAMENT_FALLBACK_URL)
    try:
        response = httpx.get(f"{base}{path}", headers={"Accept": "application/json"}, timeout=5)
    except httpx.HTTPError as exc:
        raise ServiceUnavailable(f"{config.TOURNAMENT_SERVICE} injoignable ({base})") from exc
    if response.status_code >= 500:
        raise ServiceUnavailable(f"{config.TOURNAMENT_SERVICE} a répondu {response.status_code}")
    response.raise_for_status()
    return response.json()


def get_matches() -> list[dict]:
    """GET /api/matches : tous les matchs (avec tournament_id, score, status...)."""
    return _get("/api/matches")


def get_team_names() -> dict[int, str]:
    """GET /api/teams : {id: nom}, gardé 30 s en cache pour limiter les appels."""
    global _teams_cache
    now = time.monotonic()
    if _teams_cache and now - _teams_cache[0] < TEAMS_CACHE_SECONDS:
        return _teams_cache[1]
    names = {int(team["id"]): team["name"] for team in _get("/api/teams")}
    _teams_cache = (now, names)
    return names
