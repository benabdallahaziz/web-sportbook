"""
app/recommendation_engine.py – Algorithme de recommandation par similarité cosinus
Utilise scikit-learn pour calculer la compatibilité coach/sportif
"""

import logging
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

# ============================================================
# Mapping des valeurs texte → vecteurs numériques
# ============================================================

GOAL_MAP = {
    "perte_de_poids":    [1, 0, 0, 0, 0, 0],
    "musculation":       [0, 1, 0, 0, 0, 0],
    "endurance":         [0, 0, 1, 0, 0, 0],
    "yoga":              [0, 0, 0, 1, 0, 0],
    "nutrition":         [0, 0, 0, 0, 1, 0],
    "football":          [0, 0, 0, 0, 0, 1],
    # Alias acceptés
    "bien-etre":         [0, 0, 0, 1, 0, 0],
    "sport-collectif":   [0, 0, 0, 0, 0, 1],
    "cardio":            [0, 0, 1, 0, 0, 0],
    "remise-en-forme":   [1, 0, 0, 0, 0, 0],
}

SPECIALITY_MAP = {
    "football":          [0, 0, 0, 0, 0, 1],
    "yoga":              [0, 0, 0, 1, 0, 0],
    "musculation":       [0, 1, 0, 0, 0, 0],
    "nutrition":         [0, 0, 0, 0, 1, 0],
    "endurance":         [0, 0, 1, 0, 0, 0],
    "perte_de_poids":    [1, 0, 0, 0, 0, 0],
}

LEVEL_MAP = {
    "debutant":          [1, 0, 0],
    "intermediaire":     [0, 1, 0],
    "avance":            [0, 0, 1],
}

TIME_MAP = {
    "matin":             [1, 0, 0],
    "apres-midi":        [0, 1, 0],
    "soir":              [0, 0, 1],
}

DAY_MAP = {
    "lundi":     0,
    "mardi":     1,
    "mercredi":  2,
    "jeudi":     3,
    "vendredi":  4,
    "samedi":    5,
    "dimanche":  6,
}


def build_sportif_vector(profile: Dict[str, Any]) -> np.ndarray:
    """
    Construit le vecteur de caractéristiques d'un sportif.
    Format : [goal(6), level(3), budget_normalized(1), days(7), time(3)] = 20 dimensions
    """
    goal_key = profile.get("goal", "remise-en-forme").lower().replace(" ", "_")
    goal_vec = GOAL_MAP.get(goal_key, [0.2, 0.2, 0.2, 0.2, 0.1, 0.1])  # défaut : polyvalent

    level_key = profile.get("level", "intermediaire").lower()
    level_vec = LEVEL_MAP.get(level_key, [0, 1, 0])

    budget = float(profile.get("maxBudgetPerSession", 200.0))
    budget_normalized = min(budget / 300.0, 1.0)  # normalisé entre 0 et 1

    # Vecteur des jours préférés (7 dimensions)
    preferred_days = [d.lower() for d in profile.get("preferredDays", [])]
    days_vec = [0] * 7
    for day in preferred_days:
        if day in DAY_MAP:
            days_vec[DAY_MAP[day]] = 1

    time_key = profile.get("preferredTime", "matin").lower()
    time_vec = TIME_MAP.get(time_key, [1, 0, 0])

    vector = goal_vec + level_vec + [budget_normalized] + days_vec + time_vec
    return np.array(vector, dtype=float)


def build_coach_vector(coach: Dict[str, Any]) -> np.ndarray:
    """
    Construit le vecteur de caractéristiques d'un coach.
    Format identique au sportif pour permettre la similarité cosinus.
    """
    speciality = coach.get("speciality", "").lower().replace(" ", "_")
    spec_vec = SPECIALITY_MAP.get(speciality, [0.1, 0.1, 0.2, 0.1, 0.2, 0.3])

    # Expérience → niveau adapté
    exp = int(coach.get("experienceYears", 3))
    if exp <= 2:
        level_vec = [1, 0, 0]       # débutant à accompagner
    elif exp <= 6:
        level_vec = [1, 1, 0]       # débutant + intermédiaire
    else:
        level_vec = [1, 1, 1]       # tous niveaux

    hourly_rate = float(coach.get("hourlyRate", 100.0))
    rate_normalized = min(hourly_rate / 300.0, 1.0)

    # Jours de disponibilité du coach
    availabilities = coach.get("availabilities", [])
    days_vec = [0] * 7
    for avail in availabilities:
        day = avail.get("dayOfWeek", "").lower() if isinstance(avail, dict) else str(avail).lower()
        if day in DAY_MAP:
            days_vec[DAY_MAP[day]] = 1

    # Horaire disponible (inféré depuis spécialité / defaults)
    time_vec = [1, 1, 0]  # matin + après-midi par défaut

    vector = spec_vec + level_vec + [rate_normalized] + days_vec + time_vec
    return np.array(vector, dtype=float)


def compute_recommendations(
    sportif_profile: Dict[str, Any],
    coaches: List[Dict[str, Any]],
    top_n: int = 3
) -> List[Tuple[Dict[str, Any], float, List[str]]]:
    """
    Calcule les recommandations de coachs pour un profil sportif.
    Retourne les top_n coachs avec leur score de similarité cosinus.
    """
    if not coaches:
        return []

    sportif_vec = build_sportif_vector(sportif_profile).reshape(1, -1)

    scored = []
    for coach in coaches:
        try:
            coach_vec = build_coach_vector(coach).reshape(1, -1)
            score = cosine_similarity(sportif_vec, coach_vec)[0][0]

            # Calcul des raisons de recommandation
            reasons = build_reasons(sportif_profile, coach, score)

            scored.append((coach, float(score), reasons))
        except Exception as e:
            logger.warning(f"⚠️ Erreur calcul score pour coach {coach.get('id')}: {e}")
            continue

    # Tri par score décroissant
    scored.sort(key=lambda x: x[1], reverse=True)

    logger.info(f"📊 Recommandations calculées pour userId={sportif_profile.get('userId')} : "
                f"{[(c.get('id'), round(s, 3)) for c, s, _ in scored[:top_n]]}")

    return scored[:top_n]


def build_reasons(profile: Dict[str, Any], coach: Dict[str, Any], score: float) -> List[str]:
    """Génère des raisons lisibles pour la recommandation"""
    reasons = []

    goal = profile.get("goal", "").lower()
    speciality = coach.get("speciality", "").lower()

    # Spécialité correspondante
    if goal in speciality or speciality in goal:
        reasons.append(f"✅ Spécialité '{speciality}' correspond à votre objectif '{goal}'")
    else:
        reasons.append(f"🔄 Coach polyvalent adapté à votre objectif '{goal}'")

    # Budget compatible
    budget = float(profile.get("maxBudgetPerSession", 200))
    rate = float(coach.get("hourlyRate", 100))
    if rate <= budget:
        reasons.append(f"💰 Tarif {rate} DT/h dans votre budget ({budget} DT max)")
    else:
        reasons.append(f"⚠️ Tarif légèrement supérieur à votre budget ({rate} DT/h)")

    # Expérience
    exp = int(coach.get("experienceYears", 0))
    level = profile.get("level", "").lower()
    if level == "debutant" and exp >= 3:
        reasons.append(f"🎓 {exp} ans d'expérience, idéal pour accompagner les débutants")
    elif level == "avance" and exp >= 7:
        reasons.append(f"🏆 {exp} ans d'expérience, niveau expert pour sportifs avancés")
    else:
        reasons.append(f"📅 {exp} ans d'expérience professionnelle")

    # Disponibilités
    preferred_days = [d.lower() for d in profile.get("preferredDays", [])]
    avail_days = [a.get("dayOfWeek", "").lower() for a in coach.get("availabilities", []) if isinstance(a, dict)]
    common_days = set(preferred_days) & set(avail_days)
    if common_days:
        reasons.append(f"📆 Disponible : {', '.join(common_days)}")

    return reasons


def compute_compatibility(
    sportif_profile: Dict[str, Any],
    coach: Dict[str, Any]
) -> Dict[str, Any]:
    """Calcule le détail de compatibilité entre un sportif et un coach spécifique"""
    sportif_vec = build_sportif_vector(sportif_profile).reshape(1, -1)
    coach_vec = build_coach_vector(coach).reshape(1, -1)
    score = float(cosine_similarity(sportif_vec, coach_vec)[0][0])

    return {
        "overallScore": round(score, 4),
        "overallPercent": f"{round(score * 100, 1)}%",
        "specialityMatch": coach.get("speciality", "").lower() in sportif_profile.get("goal", "").lower(),
        "budgetCompatible": float(coach.get("hourlyRate", 0)) <= float(sportif_profile.get("maxBudgetPerSession", 200)),
        "experienceYears": coach.get("experienceYears", 0),
        "hourlyRate": coach.get("hourlyRate", 0),
        "algorithm": "Cosine Similarity (scikit-learn 1.x)"
    }

