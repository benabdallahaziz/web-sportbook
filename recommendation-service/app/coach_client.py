"""
app/coach_client.py – Client REST du microservice coach-training-service (.NET 8)

Appels synchrones :
  GET /api/coaches   -> coachs (nom, spécialité, note, disponibilités)
  GET /api/programs  -> programmes d'entraînement (rattachés à un coach)
  GET /api/sessions  -> séances planifiées (rattachées à un programme)

Les données sont normalisées ici pour que l'algorithme ne dépende pas du format .NET.
"""

import logging
import os
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

COACH_SERVICE_URL = os.getenv("COACH_SERVICE_URL", "http://localhost:8087").rstrip("/")


async def _get(path: str) -> Optional[List[Dict[str, Any]]]:
    """GET sur coach-training-service ; None si le service est injoignable."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{COACH_SERVICE_URL}{path}")
            response.raise_for_status()
            data = response.json()
            return data if isinstance(data, list) else []
    except Exception as e:  # service arrêté, timeout, réponse invalide
        logger.warning(f"⚠️ coach-training-service indisponible pour {path} : {e}")
        return None


def _normalize_coach(c: Dict[str, Any]) -> Dict[str, Any]:
    name = (c.get("name") or "").strip()
    parts = name.split(" ", 1)
    return {
        "id": c.get("id"),
        "name": name,
        "firstName": parts[0] if parts else "",
        "lastName": parts[1] if len(parts) > 1 else "",
        "speciality": c.get("speciality") or "",
        "rating": float(c.get("rating") or 0),
        # Le service .NET ne gère pas (encore) de tarif : None = critère budget neutre
        "hourlyRate": c.get("hourlyRate"),
        "availabilities": [
            {"day": a.get("day", ""), "startTime": a.get("startTime", ""), "endTime": a.get("endTime", "")}
            for a in (c.get("availabilities") or [])
        ],
    }


async def get_all_coaches() -> Optional[List[Dict[str, Any]]]:
    """Liste normalisée des coachs, ou None si le service est injoignable."""
    coaches = await _get("/api/coaches")
    if coaches is None:
        return None
    logger.info(f"✅ {len(coaches)} coach(s) récupéré(s) depuis coach-training-service")
    return [_normalize_coach(c) for c in coaches]


async def get_programs() -> List[Dict[str, Any]]:
    return await _get("/api/programs") or []


async def get_sessions() -> List[Dict[str, Any]]:
    return await _get("/api/sessions") or []


def programs_by_coach(programs: List[Dict[str, Any]]) -> Dict[int, List[Dict[str, Any]]]:
    result: Dict[int, List[Dict[str, Any]]] = {}
    for p in programs:
        result.setdefault(p.get("coachId"), []).append(p)
    return result


def coach_of_session(programs: List[Dict[str, Any]]) -> Dict[int, int]:
    """programId -> coachId (une séance appartient à un programme, qui appartient à un coach)."""
    return {p.get("id"): p.get("coachId") for p in programs}
