"""
app/coach_client.py – Client HTTP vers le coach-training-service (.NET 8)
Communication synchrone REST : recommendation-service → coach-training-service
"""

import logging
import httpx
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

COACH_SERVICE_URL = "http://localhost:8087"


async def get_all_coaches() -> List[Dict[str, Any]]:
    """
    Appelle GET http://localhost:8087/api/coaches
    Retourne la liste des coachs depuis le microservice .NET 8
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{COACH_SERVICE_URL}/api/coaches")
            response.raise_for_status()
            coaches = response.json()
            logger.info(f"✅ Récupéré {len(coaches)} coachs depuis coach-training-service")
            return coaches
    except httpx.ConnectError:
        logger.warning("⚠️ coach-training-service inaccessible, utilisation des données de démonstration")
        return get_demo_coaches()
    except Exception as e:
        logger.error(f"❌ Erreur lors de l'appel à coach-training-service: {e}")
        return get_demo_coaches()


async def get_sessions_for_coach(coach_id: int) -> List[Dict[str, Any]]:
    """
    Appelle GET http://localhost:8087/api/sessions?coachId={coach_id}
    Retourne les sessions d'un coach pour calculer sa popularité
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{COACH_SERVICE_URL}/api/sessions")
            response.raise_for_status()
            all_sessions = response.json()
            # Filtrer les sessions du coach
            return [s for s in all_sessions if s.get("coachId") == coach_id or s.get("coach", {}).get("id") == coach_id]
    except Exception as e:
        logger.warning(f"⚠️ Impossible de récupérer les sessions pour coach {coach_id}: {e}")
        return []


def get_demo_coaches() -> List[Dict[str, Any]]:
    """
    Données de démonstration si le coach-training-service est hors ligne.
    Utilisé pour le développement et les tests.
    """
    return [
        {
            "id": 1,
            "firstName": "Karim",
            "lastName": "Benzema",
            "speciality": "football",
            "hourlyRate": 150.0,
            "experienceYears": 10,
            "bio": "Coach football professionnel, spécialiste en technique et tactique",
            "availabilities": [
                {"dayOfWeek": "lundi"},
                {"dayOfWeek": "mercredi"},
                {"dayOfWeek": "vendredi"}
            ]
        },
        {
            "id": 2,
            "firstName": "Fatma",
            "lastName": "Ben Ali",
            "speciality": "yoga",
            "hourlyRate": 80.0,
            "experienceYears": 5,
            "bio": "Instructrice yoga certifiée, méditation et bien-être",
            "availabilities": [
                {"dayOfWeek": "mardi"},
                {"dayOfWeek": "jeudi"},
                {"dayOfWeek": "samedi"}
            ]
        },
        {
            "id": 3,
            "firstName": "Mohamed",
            "lastName": "Salah",
            "speciality": "musculation",
            "hourlyRate": 120.0,
            "experienceYears": 8,
            "bio": "Coach musculation et préparation physique",
            "availabilities": [
                {"dayOfWeek": "lundi"},
                {"dayOfWeek": "mardi"},
                {"dayOfWeek": "jeudi"}
            ]
        },
        {
            "id": 4,
            "firstName": "Leila",
            "lastName": "Trabelsi",
            "speciality": "nutrition",
            "hourlyRate": 100.0,
            "experienceYears": 6,
            "bio": "Nutritionniste sportive et coach bien-être",
            "availabilities": [
                {"dayOfWeek": "mercredi"},
                {"dayOfWeek": "vendredi"}
            ]
        },
        {
            "id": 5,
            "firstName": "Youssef",
            "lastName": "Msakni",
            "speciality": "endurance",
            "hourlyRate": 90.0,
            "experienceYears": 7,
            "bio": "Spécialiste en course à pied, triathlon et endurance",
            "availabilities": [
                {"dayOfWeek": "samedi"},
                {"dayOfWeek": "dimanche"}
            ]
        }
    ]

