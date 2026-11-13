"""
app/recommendation_engine.py – Recommandation coach / sportif par similarité cosinus (scikit-learn)

Chaque sportif et chaque coach est décrit par un vecteur de même forme :

    [ objectif / spécialité (9) | niveau (3) | budget (1) | jours (7) | créneau (3) ]  = 23 dimensions

  - objectif  : objectif du sportif  ↔  spécialité du coach
  - niveau    : niveau du sportif    ↔  niveaux encadrés (déduits de la note du coach, 0 à 5)
  - budget    : budget du sportif    ↔  tarif du coach (neutre si le coach n'a pas de tarif)
  - jours     : jours préférés       ↔  jours de disponibilité du coach
  - créneau   : matin / après-midi / soir  ↔  heures de début des disponibilités du coach

    score = cos(θ) = (sportif · coach) / (|sportif| × |coach|)     ∈ [0, 1]
"""

import logging
import unicodedata
from typing import Any, Dict, List, Tuple

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

# ── Catégories d'objectifs / spécialités (une dimension chacune) ──────────────
CATEGORIES = [
    "perte_de_poids", "musculation", "endurance", "yoga", "nutrition",
    "football", "tennis", "basketball", "padel",
]

# Mots-clés reconnus dans un objectif ou une spécialité saisis librement
KEYWORDS = {
    "perte_de_poids": ["perte", "poids", "minceur", "remise", "forme", "fitness", "cardio-training"],
    "musculation": ["muscu", "force", "crossfit", "bodybuilding", "renforcement"],
    "endurance": ["endurance", "cardio", "course", "running", "marathon", "natation", "velo", "athle"],
    "yoga": ["yoga", "pilates", "bien-etre", "bien etre", "stretching", "meditation", "mobilite"],
    "nutrition": ["nutrition", "diet", "alimentation"],
    "football": ["foot", "soccer", "futsal", "sport-collectif", "sport collectif"],
    "tennis": ["tennis"],
    "basketball": ["basket"],
    "padel": ["padel", "squash"],
}

LEVELS = ["debutant", "intermediaire", "avance"]
TIMES = ["matin", "apres-midi", "soir"]
DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
DAY_LABELS = {d: d.capitalize() for d in DAYS}
DIMENSIONS = len(CATEGORIES) + len(LEVELS) + 1 + len(DAYS) + len(TIMES)


def norm(text: Any) -> str:
    """Minuscules sans accents : « Après-midi » -> « apres-midi »."""
    t = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode()
    return t.lower().strip().replace("_", " ")


def categories_of(text: str) -> List[str]:
    t = norm(text)
    found = [c for c in CATEGORIES if norm(c) in t or any(k in t for k in KEYWORDS[c])]
    return found


def category_vector(text: str) -> List[float]:
    found = categories_of(text)
    if not found:  # inconnu : profil polyvalent, faible poids partout
        return [0.15] * len(CATEGORIES)
    return [1.0 if c in found else 0.0 for c in CATEGORIES]


def slot_of(start_time: str) -> str:
    """'09:00:00' -> matin, '14:30' -> apres-midi, '19:00' -> soir."""
    try:
        hour = int(str(start_time).split(":")[0])
    except (ValueError, IndexError):
        return ""
    return "matin" if hour < 12 else "apres-midi" if hour < 18 else "soir"


def coach_levels(rating: float) -> List[int]:
    """Plus la note est haute, plus le coach encadre de niveaux."""
    if rating >= 4.5:
        return [1, 1, 1]
    if rating >= 3:
        return [1, 1, 0]
    return [1, 0, 0]


def coach_days(coach: Dict[str, Any]) -> List[str]:
    return [norm(a.get("day")) for a in coach.get("availabilities", []) if norm(a.get("day")) in DAYS]


def coach_slots(coach: Dict[str, Any]) -> List[str]:
    return [s for s in (slot_of(a.get("startTime")) for a in coach.get("availabilities", [])) if s]


def budget_value(profile: Dict[str, Any]) -> float:
    return min(float(profile.get("maxBudgetPerSession") or 200.0) / 300.0, 1.0)


def build_sportif_vector(profile: Dict[str, Any]) -> np.ndarray:
    goal_vec = category_vector(profile.get("goal", ""))
    level = norm(profile.get("level", "intermediaire"))
    level_vec = [1.0 if level == lv else 0.0 for lv in LEVELS]
    days = {norm(d) for d in profile.get("preferredDays", [])}
    days_vec = [1.0 if d in days else 0.0 for d in DAYS]
    time = norm(profile.get("preferredTime", "matin"))
    time_vec = [1.0 if time == t else 0.0 for t in TIMES]
    return np.array(goal_vec + level_vec + [budget_value(profile)] + days_vec + time_vec, dtype=float)


def build_coach_vector(coach: Dict[str, Any], profile: Dict[str, Any]) -> np.ndarray:
    spec_vec = category_vector(coach.get("speciality", ""))
    level_vec = coach_levels(float(coach.get("rating") or 0))
    rate = coach.get("hourlyRate")
    # Pas de tarif côté coach : même valeur que le sportif (le critère ne pénalise personne)
    rate_value = min(float(rate) / 300.0, 1.0) if rate is not None else budget_value(profile)
    days = set(coach_days(coach))
    # Coach sans disponibilité saisie : supposé disponible toute la semaine, en journée
    days_vec = [1.0 if (d in days or not days) else 0.0 for d in DAYS]
    slots = set(coach_slots(coach)) or {"matin", "apres-midi"}
    time_vec = [1.0 if t in slots else 0.0 for t in TIMES]
    return np.array(spec_vec + level_vec + [rate_value] + days_vec + time_vec, dtype=float)


def score_coach(profile: Dict[str, Any], coach: Dict[str, Any]) -> float:
    a = build_sportif_vector(profile).reshape(1, -1)
    b = build_coach_vector(coach, profile).reshape(1, -1)
    return float(cosine_similarity(a, b)[0][0])


def compute_recommendations(
    sportif_profile: Dict[str, Any], coaches: List[Dict[str, Any]], top_n: int = 3
) -> List[Tuple[Dict[str, Any], float, List[str]]]:
    """Top N des coachs par similarité cosinus, avec les raisons lisibles."""
    scored = []
    for coach in coaches:
        try:
            s = score_coach(sportif_profile, coach)
            scored.append((coach, s, build_reasons(sportif_profile, coach)))
        except Exception as e:
            logger.warning(f"⚠️ Score impossible pour le coach {coach.get('id')} : {e}")
    scored.sort(key=lambda x: (x[1], x[0].get("rating", 0)), reverse=True)
    logger.info(f"📊 userId={sportif_profile.get('userId')} : {[(c.get('id'), round(s, 3)) for c, s, _ in scored[:top_n]]}")
    return scored[:top_n]


def build_reasons(profile: Dict[str, Any], coach: Dict[str, Any]) -> List[str]:
    reasons = []
    goal = profile.get("goal", "")
    speciality = coach.get("speciality") or "polyvalent"
    if set(categories_of(goal)) & set(categories_of(speciality)):
        reasons.append(f"✅ Spécialité « {speciality} » adaptée à votre objectif « {goal} »")
    else:
        reasons.append(f"🔄 Coach « {speciality} », complémentaire à votre objectif « {goal} »")

    rating = float(coach.get("rating") or 0)
    level = norm(profile.get("level", ""))
    if level in LEVELS and coach_levels(rating)[LEVELS.index(level)]:
        reasons.append(f"⭐ Note {rating:.1f}/5 : encadre le niveau « {profile.get('level')} »")
    else:
        reasons.append(f"⭐ Note {rating:.1f}/5")

    rate = coach.get("hourlyRate")
    if rate is not None:
        budget = float(profile.get("maxBudgetPerSession") or 200)
        reasons.append(f"💰 Tarif {rate} DT/h " + ("dans votre budget" if float(rate) <= budget else "au-dessus de votre budget"))

    common = sorted(set(norm(d) for d in profile.get("preferredDays", [])) & set(coach_days(coach)), key=DAYS.index)
    if common:
        reasons.append("📆 Disponible : " + ", ".join(DAY_LABELS[d] for d in common))
    if norm(profile.get("preferredTime", "")) in coach_slots(coach):
        reasons.append(f"🕒 Créneaux le {profile.get('preferredTime')}")
    return reasons


def compute_compatibility(sportif_profile: Dict[str, Any], coach: Dict[str, Any]) -> Dict[str, Any]:
    s = score_coach(sportif_profile, coach)
    return {
        "overallScore": round(s, 4),
        "overallPercent": f"{round(s * 100, 1)}%",
        "specialityMatch": bool(set(categories_of(sportif_profile.get("goal", ""))) & set(categories_of(coach.get("speciality", "")))),
        "rating": coach.get("rating", 0),
        "availableDays": [DAY_LABELS[d] for d in coach_days(coach)],
        "reasons": build_reasons(sportif_profile, coach),
        "dimensions": DIMENSIONS,
        "algorithm": "Cosine Similarity (scikit-learn)",
    }
