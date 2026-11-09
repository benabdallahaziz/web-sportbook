"""
app/models.py – Modèles Pydantic pour le service de recommandation
"""

from pydantic import BaseModel
from typing import Optional, List


class SportifProfile(BaseModel):
    """Profil d'un sportif pour la recommandation"""
    userId: int
    goal: str           # ex: "perte_de_poids", "musculation", "endurance", "yoga"
    level: str          # ex: "debutant", "intermediaire", "avance"
    maxBudgetPerSession: Optional[float] = 200.0  # en DT
    preferredDays: Optional[List[str]] = []       # ex: ["lundi", "mercredi"]
    preferredTime: Optional[str] = "matin"        # "matin", "apres-midi", "soir"


class CoachScore(BaseModel):
    """Résultat de recommandation pour un coach"""
    coachId: int
    firstName: str
    lastName: str
    speciality: str
    hourlyRate: float
    experienceYears: int
    compatibilityScore: float   # 0.0 à 1.0
    compatibilityPercent: str   # ex: "87%"
    reasons: List[str]          # Pourquoi ce coach est recommandé


class RecommendationResponse(BaseModel):
    """Réponse complète de recommandation"""
    userId: int
    totalCandidates: int
    recommendations: List[CoachScore]
    algorithm: str = "Cosine Similarity (scikit-learn)"


class CompatibilityResponse(BaseModel):
    """Réponse de compatibilité entre un sportif et un coach"""
    userId: int
    coachId: int
    coachName: str
    compatibilityScore: float
    compatibilityPercent: str
    details: dict


class PopularCoach(BaseModel):
    """Coach populaire avec statistiques"""
    coachId: int
    firstName: str
    lastName: str
    speciality: str
    hourlyRate: float
    totalSessions: int
    popularityScore: float
    rank: int

