"""Calcul du classement Elo et des statistiques (Python pur, sans base ni réseau).

Système Elo (utilisé aux échecs et par la FIFA) :
  1. Chaque équipe démarre à 1500 points.
  2. Avant un match, on calcule le score attendu de A contre B :
         E_A = 1 / (1 + 10 ** ((R_B - R_A) / 400))
     (E_A = 0.5 si les équipes sont de même niveau, proche de 1 si A est très forte)
  3. Après le match, S_A = 1 (victoire), 0.5 (nul) ou 0 (défaite) et :
         R_A = R_A + K * G * (S_A - E_A)
     K = 32 fixe l'amplitude, G augmente le gain pour une large victoire.
  4. Ce que A gagne, B le perd : le total des points reste constant.

=> Battre une équipe plus forte rapporte beaucoup, battre une plus faible peu.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

INITIAL_RATING = 1500.0
K_FACTOR = 32
FORM_LENGTH = 5


def expected_score(rating_a: float, rating_b: float) -> float:
    """Score attendu de A contre B, entre 0 et 1."""
    return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400))


def goal_multiplier(goal_difference: int) -> float:
    """Coefficient G (World Football Elo) : 1 but d'écart → 1, 2 → 1.5, n≥3 → (11+n)/8."""
    d = abs(goal_difference)
    if d <= 1:
        return 1.0
    if d == 2:
        return 1.5
    return (11 + d) / 8


@dataclass(frozen=True)
class Result:
    match_id: int
    team1_id: int
    team2_id: int
    goals1: int
    goals2: int
    played_on: date | None = None


@dataclass
class TeamStats:
    team_id: int
    rating: float = INITIAL_RATING
    played: int = 0
    wins: int = 0
    draws: int = 0
    losses: int = 0
    goals_for: int = 0
    goals_against: int = 0
    results: list[str] = field(default_factory=list)   # "V", "N", "D" dans l'ordre
    history: list[dict] = field(default_factory=list)  # évolution du classement Elo

    @property
    def goal_difference(self) -> int:
        return self.goals_for - self.goals_against

    @property
    def points(self) -> int:
        return 3 * self.wins + self.draws

    @property
    def form(self) -> str:
        """Les 5 derniers résultats, du plus ancien au plus récent (ex. "VVNDV")."""
        return "".join(self.results[-FORM_LENGTH:])


def chronological(results: list[Result]) -> list[Result]:
    """Ordre des matchs : par date (matchs sans date à la fin), puis par id."""
    return sorted(results, key=lambda r: (r.played_on is None, r.played_on or date.min, r.match_id))


def _record(team: TeamStats, r: Result, gf: int, ga: int, delta: float, opponent_id: int) -> None:
    before = team.rating
    team.rating += delta
    team.played += 1
    team.goals_for += gf
    team.goals_against += ga
    if gf > ga:
        team.wins += 1
        team.results.append("V")
    elif gf == ga:
        team.draws += 1
        team.results.append("N")
    else:
        team.losses += 1
        team.results.append("D")
    team.history.append({
        "match_id": r.match_id,
        "date": r.played_on.isoformat() if r.played_on else None,
        "opponent_id": opponent_id,
        "score": f"{gf}-{ga}",
        "rating_before": round(before, 1),
        "rating_after": round(team.rating, 1),
    })


def compute(results: list[Result]) -> dict[int, TeamStats]:
    """Rejoue tous les matchs dans l'ordre et renvoie les stats de chaque équipe."""
    teams: dict[int, TeamStats] = {}

    def get(team_id: int) -> TeamStats:
        return teams.setdefault(team_id, TeamStats(team_id))

    for r in chronological(results):
        a, b = get(r.team1_id), get(r.team2_id)
        ea = expected_score(a.rating, b.rating)
        sa = 1.0 if r.goals1 > r.goals2 else 0.5 if r.goals1 == r.goals2 else 0.0
        delta = K_FACTOR * goal_multiplier(r.goals1 - r.goals2) * (sa - ea)
        _record(a, r, r.goals1, r.goals2, delta, b.team_id)
        _record(b, r, r.goals2, r.goals1, -delta, a.team_id)
    return teams


def rank(teams: dict[int, TeamStats], order_by: str = "elo") -> list[TeamStats]:
    """Tri par Elo, ou par points (puis différence de buts, puis buts marqués)."""
    if order_by == "points":
        key = lambda t: (t.points, t.goal_difference, t.goals_for, t.rating)  # noqa: E731
    else:
        key = lambda t: (t.rating, t.points, t.goal_difference)  # noqa: E731
    return sorted(teams.values(), key=key, reverse=True)
