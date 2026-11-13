"""
app/models.py – Modèles Pydantic du service de recommandation
"""

from typing import List, Optional

from pydantic import BaseModel


class SportifProfile(BaseModel):
    """Profil d'un sportif pour la recommandation"""
    userId: int
    goal: str                                      # ex: "musculation", "football", "yoga"
    level: str                                     # "debutant", "intermediaire", "avance"
    maxBudgetPerSession: Optional[float] = 200.0   # en DT
    preferredDays: Optional[List[str]] = []        # ex: ["lundi", "mercredi"]
    preferredTime: Optional[str] = "matin"         # "matin", "apres-midi", "soir"


class SessionSlot(BaseModel):
    """Séance planifiée encore libre (réservable via POST /api/sessions/{id}/register)"""
    id: int
    date: str
    startTime: str


class ProgramSuggestion(BaseModel):
    """Programme d'entraînement proposé par un coach recommandé"""
    id: int
    name: str
    description: Optional[str] = None
    durationWeeks: Optional[int] = None
    coachId: int
    coachName: Optional[str] = None
    availableSessions: List[SessionSlot] = []


class CoachScore(BaseModel):
    """Coach recommandé avec son score et ses programmes"""
    coachId: int
    name: str
    firstName: str
    lastName: str
    speciality: str
    rating: float
    hourlyRate: Optional[float] = None
    compatibilityScore: float     # 0.0 à 1.0
    compatibilityPercent: str     # ex: "87.5%"
    reasons: List[str]
    programs: List[ProgramSuggestion] = []


class RecommendationResponse(BaseModel):
    """Réponse complète : coachs recommandés + entraînement idéal"""
    userId: int
    totalCandidates: int
    recommendations: List[CoachScore]
    recommendedProgram: Optional[ProgramSuggestion] = None
    message: Optional[str] = None
    algorithm: str = "Cosine Similarity (scikit-learn)"


class CompatibilityResponse(BaseModel):
    """Compatibilité entre un sportif et un coach donné"""
    userId: int
    coachId: int
    coachName: str
    compatibilityScore: float
    compatibilityPercent: str
    details: dict


class PopularCoach(BaseModel):
    """Coach classé par popularité (séances réservées)"""
    coachId: int
    name: str
    firstName: str
    lastName: str
    speciality: str
    rating: float
    totalSessions: int
    bookedSessions: int
    popularityScore: float
    rank: int
