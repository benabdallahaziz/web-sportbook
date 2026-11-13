"""
app/routers/recommendations.py – Endpoints du service de recommandation

  GET /api/recommendations/coaches                       TOP 3 coachs + programmes + entraînement idéal
  GET /api/recommendations/coaches/{coachId}/compatibility   score détaillé pour un coach
  GET /api/recommendations/popular                       coachs les plus réservés
"""

import logging
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.coach_client import coach_of_session, get_all_coaches, get_programs, get_sessions, programs_by_coach
from app.models import (
    CoachScore, CompatibilityResponse, PopularCoach, ProgramSuggestion, RecommendationResponse, SessionSlot,
)
from app.recommendation_engine import compute_compatibility, compute_recommendations, norm, slot_of

logger = logging.getLogger(__name__)
router = APIRouter()


def _profile(userId, goal, level, maxBudgetPerSession, preferredDays, preferredTime) -> Dict[str, Any]:
    return {
        "userId": userId,
        "goal": goal,
        "level": level,
        "maxBudgetPerSession": maxBudgetPerSession,
        "preferredDays": [d.strip() for d in preferredDays.split(",") if d.strip()] if preferredDays else [],
        "preferredTime": preferredTime or "matin",
    }


async def _coaches_or_503() -> List[Dict[str, Any]]:
    coaches = await get_all_coaches()
    if coaches is None:
        raise HTTPException(status_code=503, detail="coach-training-service est indisponible")
    return coaches


def _free_sessions(sessions: List[Dict[str, Any]], program_id: int, profile: Dict[str, Any]) -> List[SessionSlot]:
    """Séances futures, planifiées et sans sportif ; celles du créneau préféré d'abord."""
    today = date.today().isoformat()
    free = [
        s for s in sessions
        if s.get("programId") == program_id and s.get("status") == "SCHEDULED"
        and not s.get("userId") and str(s.get("date", "")) >= today
    ]
    pref = norm(profile.get("preferredTime", ""))
    free.sort(key=lambda s: (slot_of(s.get("startTime")) != pref, str(s.get("date")), str(s.get("startTime"))))
    return [SessionSlot(id=s["id"], date=str(s["date"]), startTime=str(s["startTime"])[:5]) for s in free[:3]]


def _programs_for(coach, programs, sessions, profile) -> List[ProgramSuggestion]:
    result = []
    for p in programs:
        result.append(ProgramSuggestion(
            id=p["id"], name=p.get("name", ""), description=p.get("description"),
            durationWeeks=p.get("durationWeeks"), coachId=coach["id"], coachName=coach["name"],
            availableSessions=_free_sessions(sessions, p["id"], profile),
        ))
    # Programmes avec des séances libres d'abord
    result.sort(key=lambda p: len(p.availableSessions) == 0)
    return result


@router.get(
    "/coaches",
    response_model=RecommendationResponse,
    summary="Recommander les meilleurs coachs et l'entraînement idéal",
    description="""
Retourne le **TOP 3 des coachs** les plus compatibles avec le profil du sportif (similarité cosinus,
scikit-learn), avec pour chacun ses **programmes** et ses **prochaines séances libres**,
ainsi que le **programme recommandé** (meilleur coach ayant une séance réservable).

**goal** (texte libre) : `musculation`, `perte_de_poids`, `endurance`, `yoga`, `nutrition`,
`football`, `tennis`, `basketball`, `padel`…  ·  **level** : `debutant`, `intermediaire`, `avance`
""",
)
async def recommend_coaches(
    userId: int = Query(..., description="ID du sportif (service Identity)", examples=[1]),
    goal: str = Query(..., description="Objectif sportif", examples=["football"]),
    level: str = Query("intermediaire", description="Niveau du sportif", examples=["debutant"]),
    maxBudgetPerSession: Optional[float] = Query(200.0, description="Budget max par séance (DT)"),
    preferredDays: Optional[str] = Query(None, description="Jours préférés, séparés par des virgules", examples=["lundi,mercredi"]),
    preferredTime: Optional[str] = Query("matin", description="matin, apres-midi ou soir"),
    top: int = Query(3, ge=1, le=10, description="Nombre de coachs à retourner"),
):
    profile = _profile(userId, goal, level, maxBudgetPerSession, preferredDays, preferredTime)
    logger.info(f"📨 Recommandation demandée : {profile}")

    coaches = await _coaches_or_503()
    if not coaches:
        return RecommendationResponse(userId=userId, totalCandidates=0, recommendations=[],
                                      message="Aucun coach n'est encore inscrit sur la plateforme.")

    programs, sessions = await get_programs(), await get_sessions()
    by_coach = programs_by_coach(programs)

    recommendations = []
    for coach, score, reasons in compute_recommendations(profile, coaches, top_n=top):
        recommendations.append(CoachScore(
            coachId=coach["id"], name=coach["name"], firstName=coach["firstName"], lastName=coach["lastName"],
            speciality=coach["speciality"], rating=coach["rating"], hourlyRate=coach["hourlyRate"],
            compatibilityScore=round(score, 4), compatibilityPercent=f"{round(score * 100, 1)}%",
            reasons=reasons, programs=_programs_for(coach, by_coach.get(coach["id"], []), sessions, profile),
        ))

    # Entraînement idéal : premier programme réservable du coach le mieux classé
    best = next((p for r in recommendations for p in r.programs if p.availableSessions), None)
    best = best or next((p for r in recommendations for p in r.programs), None)
    message = None if best else "Les coachs recommandés n'ont pas encore publié de programme."

    return RecommendationResponse(userId=userId, totalCandidates=len(coaches), recommendations=recommendations,
                                  recommendedProgram=best, message=message)


@router.get(
    "/coaches/{coachId}/compatibility",
    response_model=CompatibilityResponse,
    summary="Score de compatibilité entre un sportif et un coach",
)
async def get_compatibility(
    coachId: int,
    userId: int = Query(..., description="ID du sportif"),
    goal: str = Query(..., description="Objectif sportif"),
    level: str = Query("intermediaire", description="Niveau"),
    maxBudgetPerSession: Optional[float] = Query(200.0, description="Budget max (DT)"),
    preferredDays: Optional[str] = Query(None, description="Jours préférés"),
    preferredTime: Optional[str] = Query("matin", description="Créneau préféré"),
):
    coaches = await _coaches_or_503()
    coach = next((c for c in coaches if c.get("id") == coachId), None)
    if not coach:
        raise HTTPException(status_code=404, detail=f"Coach {coachId} introuvable")
    profile = _profile(userId, goal, level, maxBudgetPerSession, preferredDays, preferredTime)
    d = compute_compatibility(profile, coach)
    return CompatibilityResponse(userId=userId, coachId=coachId, coachName=coach["name"],
                                 compatibilityScore=d["overallScore"], compatibilityPercent=d["overallPercent"], details=d)


@router.get(
    "/popular",
    response_model=List[PopularCoach],
    summary="Coachs les plus populaires",
    description="Classement par séances réservées (séance → programme → coach), puis par note.",
)
async def get_popular_coaches(limit: int = Query(5, ge=1, le=20, description="Nombre de coachs")):
    coaches = await _coaches_or_503()
    programs, sessions = await get_programs(), await get_sessions()
    coach_by_program = coach_of_session(programs)

    total: Dict[int, int] = {}
    booked: Dict[int, int] = {}
    for s in sessions:
        cid = coach_by_program.get(s.get("programId"))
        if cid is None:
            continue
        total[cid] = total.get(cid, 0) + 1
        if s.get("userId"):
            booked[cid] = booked.get(cid, 0) + 1

    ranked = []
    for c in coaches:
        b, t = booked.get(c["id"], 0), total.get(c["id"], 0)
        popularity = b * 2 + t * 0.5 + c["rating"]  # réservations > séances proposées > note
        ranked.append((c, t, b, popularity))
    ranked.sort(key=lambda x: x[3], reverse=True)

    return [
        PopularCoach(coachId=c["id"], name=c["name"], firstName=c["firstName"], lastName=c["lastName"],
                     speciality=c["speciality"], rating=c["rating"], totalSessions=t, bookedSessions=b,
                     popularityScore=round(p, 2), rank=i)
        for i, (c, t, b, p) in enumerate(ranked[:limit], start=1)
    ]
