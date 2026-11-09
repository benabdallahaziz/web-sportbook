"""Endpoints REST du service : /api/stats/..."""
from typing import Literal

from fastapi import APIRouter, Header, HTTPException, Path, Query
from sqlalchemy import select

from . import elo, sync, tournament_client
from .db import SessionLocal
from .models import MatchResult
from .schemas import ErrorResponse, Prediction, RankingResponse, SyncResult, TeamDetail

router = APIRouter(prefix="/api/stats", tags=["Stats"])

ERRORS = {
    400: {"model": ErrorResponse, "description": "Paramètre invalide"},
    503: {"model": ErrorResponse, "description": "Base de données ou service distant indisponible"},
}
TournamentFilter = Query(None, ge=1, description="Limiter le calcul aux matchs d'un tournoi")


def _load_results(tournament_id: int | None) -> list[elo.Result]:
    query = select(MatchResult)
    if tournament_id is not None:
        query = query.where(MatchResult.tournament_id == tournament_id)
    with SessionLocal() as session:
        rows = session.scalars(query).all()
    return [
        elo.Result(r.match_id, r.team1_id, r.team2_id, r.goals1, r.goals2, r.played_on)
        for r in rows
    ]


def _team_names() -> tuple[dict[int, str], bool]:
    """Noms des équipes via REST. Si le service est arrêté, on continue sans les noms."""
    try:
        return tournament_client.get_team_names(), True
    except tournament_client.ServiceUnavailable:
        return {}, False


def _ranking_row(position: int | None, t: elo.TeamStats, names: dict[int, str]) -> dict:
    return {
        "position": position,
        "team_id": t.team_id,
        "team_name": names.get(t.team_id),
        "elo": round(t.rating, 1),
        "played": t.played,
        "wins": t.wins,
        "draws": t.draws,
        "losses": t.losses,
        "goals_for": t.goals_for,
        "goals_against": t.goals_against,
        "goal_difference": t.goal_difference,
        "points": t.points,
        "form": t.form,
    }


@router.get("/ranking", response_model=RankingResponse, responses=ERRORS,
            summary="Classement des équipes (Elo ou points)")
def ranking(tournament_id: int | None = TournamentFilter,
            order_by: Literal["elo", "points"] = Query("elo", description="Critère de tri")):
    results = _load_results(tournament_id)
    teams = elo.compute(results)
    names, names_ok = _team_names()
    ordered = elo.rank(teams, order_by)
    return {
        "tournament_id": tournament_id,
        "order_by": order_by,
        "matches_counted": len(results),
        "team_names_available": names_ok,
        "ranking": [_ranking_row(i, t, names) for i, t in enumerate(ordered, start=1)],
    }


@router.get("/teams/{team_id}", response_model=TeamDetail,
            responses={**ERRORS, 404: {"model": ErrorResponse, "description": "Équipe inconnue"}},
            summary="Statistiques et évolution Elo d'une équipe")
def team_stats(team_id: int = Path(ge=1), tournament_id: int | None = TournamentFilter):
    teams = elo.compute(_load_results(tournament_id))
    names, names_ok = _team_names()
    if team_id not in teams and names_ok and team_id not in names:
        raise HTTPException(404, f"Équipe {team_id} introuvable")
    stats = teams.get(team_id, elo.TeamStats(team_id))  # équipe sans match : 1500, 0 match
    position = next((i for i, t in enumerate(elo.rank(teams), 1) if t.team_id == team_id), None)
    row = _ranking_row(position, stats, names)
    row["history"] = [{**h, "opponent_name": names.get(h["opponent_id"])} for h in stats.history]
    return row


@router.get("/predict", response_model=Prediction,
            responses={**ERRORS, 404: {"model": ErrorResponse, "description": "Équipe inconnue"}},
            summary="Pronostic d'un match entre deux équipes")
def predict(team1: int = Query(ge=1), team2: int = Query(ge=1),
            tournament_id: int | None = TournamentFilter):
    if team1 == team2:
        raise HTTPException(400, "team1 et team2 doivent être différentes")
    names, names_ok = _team_names()
    if names_ok:
        missing = [str(t) for t in (team1, team2) if t not in names]
        if missing:
            raise HTTPException(404, f"Équipe(s) introuvable(s) : {', '.join(missing)}")

    teams = elo.compute(_load_results(tournament_id))
    r1 = teams[team1].rating if team1 in teams else elo.INITIAL_RATING
    r2 = teams[team2].rating if team2 in teams else elo.INITIAL_RATING
    p1 = elo.expected_score(r1, r2)
    favorite = None if abs(p1 - 0.5) < 0.02 else (team1 if p1 > 0.5 else team2)
    return {
        "team1": {"team_id": team1, "team_name": names.get(team1), "elo": round(r1, 1), "win_probability": round(p1, 3)},
        "team2": {"team_id": team2, "team_name": names.get(team2), "elo": round(r2, 1), "win_probability": round(1 - p1, 3)},
        "favorite_team_id": favorite,
        "explanation": (
            f"Écart Elo de {abs(r1 - r2):.0f} points. Formule : 1 / (1 + 10^((Elo2 - Elo1) / 400)). "
            "Un nul compte pour une demi-victoire."
        ),
    }


@router.post("/sync", response_model=SyncResult,
             responses={**ERRORS, 403: {"model": ErrorResponse, "description": "Réservé à un administrateur"}},
             summary="(Admin) Resynchroniser tous les résultats via l'API REST du service des tournois")
def sync_now(x_user_roles: str | None = Header(None, alias="X-User-Roles",
                                                description="Rôles de l'utilisateur connecté (ADMIN requis)")):
    roles = {r.strip().upper() for r in (x_user_roles or "").split(",")}
    if "ADMIN" not in roles:
        raise HTTPException(403, "Action réservée à un administrateur")
    return sync.full_sync()
