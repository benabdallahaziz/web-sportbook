"""
app/routers/recommendations.py – Endpoints FastAPI du service de recommandation
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from app.models import RecommendationResponse, CoachScore, CompatibilityResponse, PopularCoach
from app.coach_client import get_all_coaches, get_sessions_for_coach
from app.recommendation_engine import compute_recommendations, compute_compatibility

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/coaches",
    response_model=RecommendationResponse,
    summary="Recommander les meilleurs coachs pour un sportif",
    description="""
Retourne le **TOP 3 des coachs** les plus compatibles avec le profil du sportif.

L'algorithme utilise la **similarité cosinus** (scikit-learn) sur un vecteur
de 20 dimensions incluant : objectif, niveau, budget, disponibilités, horaires.

**Exemples de goals :** `perte_de_poids`, `musculation`, `endurance`, `yoga`, `football`, `nutrition`

**Exemples de levels :** `debutant`, `intermediaire`, `avance`
    """
)
async def recommend_coaches(
    userId: int = Query(..., description="ID du sportif", example=1),
    goal: str = Query(..., description="Objectif sportif", example="musculation"),
    level: str = Query(..., description="Niveau du sportif", example="debutant"),
    maxBudgetPerSession: Optional[float] = Query(200.0, description="Budget max par session en DT", example=150.0),
    preferredDays: Optional[str] = Query(None, description="Jours préférés séparés par virgule", example="lundi,mercredi"),
    preferredTime: Optional[str] = Query("matin", description="Horaire préféré", example="matin")
):
    """
    Endpoint principal de recommandation.
    Appelle coach-training-service pour récupérer les coachs disponibles,
    puis applique l'algorithme de similarité cosinus.
    """
    logger.info(f"📨 Requête recommandation : userId={userId}, goal={goal}, level={level}")

    # Construire le profil du sportif
    days_list = [d.strip() for d in preferredDays.split(",")] if preferredDays else []

    sportif_profile = {
        "userId": userId,
        "goal": goal,
        "level": level,
        "maxBudgetPerSession": maxBudgetPerSession,
        "preferredDays": days_list,
        "preferredTime": preferredTime
    }

    # Récupérer les coachs depuis coach-training-service
    coaches = await get_all_coaches()

    if not coaches:
        raise HTTPException(status_code=503, detail="Aucun coach disponible pour le moment")

    # Calculer les recommandations (algorithme ML)
    top_coaches = compute_recommendations(sportif_profile, coaches, top_n=3)

    # Construire la réponse
    recommendations = []
    for coach, score, reasons in top_coaches:
        recommendations.append(CoachScore(
            coachId=coach.get("id", 0),
            firstName=coach.get("firstName", ""),
            lastName=coach.get("lastName", ""),
            speciality=coach.get("speciality", ""),
            hourlyRate=float(coach.get("hourlyRate", 0)),
            experienceYears=int(coach.get("experienceYears", 0)),
            compatibilityScore=round(score, 4),
            compatibilityPercent=f"{round(score * 100, 1)}%",
            reasons=reasons
        ))

    return RecommendationResponse(
        userId=userId,
        totalCandidates=len(coaches),
        recommendations=recommendations,
        algorithm="Cosine Similarity (scikit-learn)"
    )


@router.get(
    "/coaches/{coachId}/compatibility",
    response_model=CompatibilityResponse,
    summary="Score de compatibilité entre un sportif et un coach spécifique",
    description="Calcule et retourne le score de compatibilité entre le profil d'un sportif et un coach donné."
)
async def get_compatibility(
    coachId: int,
    userId: int = Query(..., description="ID du sportif", example=1),
    goal: str = Query(..., description="Objectif sportif", example="musculation"),
    level: str = Query("intermediaire", description="Niveau", example="debutant"),
    maxBudgetPerSession: Optional[float] = Query(200.0, description="Budget max en DT")
):
    """Calcule la compatibilité entre un sportif et un coach spécifique"""
    coaches = await get_all_coaches()
    coach = next((c for c in coaches if c.get("id") == coachId), None)

    if not coach:
        raise HTTPException(status_code=404, detail=f"Coach avec l'ID {coachId} introuvable")

    sportif_profile = {
        "userId": userId,
        "goal": goal,
        "level": level,
        "maxBudgetPerSession": maxBudgetPerSession,
        "preferredDays": [],
        "preferredTime": "matin"
    }

    details = compute_compatibility(sportif_profile, coach)

    return CompatibilityResponse(
        userId=userId,
        coachId=coachId,
        coachName=f"{coach.get('firstName', '')} {coach.get('lastName', '')}",
        compatibilityScore=details["overallScore"],
        compatibilityPercent=details["overallPercent"],
        details=details
    )


@router.get(
    "/popular",
    response_model=List[PopularCoach],
    summary="Classement des coachs les plus populaires",
    description="Retourne le classement des coachs basé sur le nombre de sessions enregistrées dans coach-training-service."
)
async def get_popular_coaches(limit: int = Query(5, description="Nombre de coachs à retourner", le=20)):
    """Retourne les coachs les plus populaires basé sur leurs sessions"""
    coaches = await get_all_coaches()

    if not coaches:
        raise HTTPException(status_code=503, detail="Aucun coach disponible")

    # Récupérer le nombre de sessions par coach
    coach_sessions = []
    for coach in coaches:
        coach_id = coach.get("id", 0)
        sessions = await get_sessions_for_coach(coach_id)
        total_sessions = len(sessions)
        # Score de popularité : sessions + expérience normalisée
        experience_bonus = float(coach.get("experienceYears", 0)) / 10.0
        popularity = total_sessions + experience_bonus
        coach_sessions.append((coach, total_sessions, popularity))

    # Tri par popularité décroissante
    coach_sessions.sort(key=lambda x: x[2], reverse=True)

    result = []
    for rank, (coach, total_sessions, popularity) in enumerate(coach_sessions[:limit], start=1):
        result.append(PopularCoach(
            coachId=coach.get("id", 0),
            firstName=coach.get("firstName", ""),
            lastName=coach.get("lastName", ""),
            speciality=coach.get("speciality", ""),
            hourlyRate=float(coach.get("hourlyRate", 0)),
            totalSessions=total_sessions,
            popularityScore=round(popularity, 2),
            rank=rank
        ))

    return result

