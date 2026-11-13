"""Modèles de réponse (Pydantic) : ils génèrent aussi les schémas Swagger."""
from pydantic import BaseModel, Field


class TeamRanking(BaseModel):
    position: int = Field(examples=[1])
    team_id: int = Field(examples=[3])
    team_name: str | None = Field(examples=["Team Alpha"])
    elo: float = Field(examples=[1532.4])
    played: int
    wins: int
    draws: int
    losses: int
    goals_for: int
    goals_against: int
    goal_difference: int
    points: int = Field(description="3 par victoire, 1 par nul")
    form: str = Field(description="5 derniers résultats : V/N/D", examples=["VVNDV"])


class RankingResponse(BaseModel):
    tournament_id: int | None
    order_by: str
    matches_counted: int
    team_names_available: bool = Field(description="false si tournament-events-service ne répond pas")
    ranking: list[TeamRanking]


class EloPoint(BaseModel):
    match_id: int
    date: str | None
    opponent_id: int
    opponent_name: str | None
    score: str = Field(examples=["3-1"])
    rating_before: float
    rating_after: float


class TeamDetail(TeamRanking):
    position: int | None = None
    history: list[EloPoint]


class PredictionSide(BaseModel):
    team_id: int
    team_name: str | None
    elo: float
    win_probability: float = Field(description="Score attendu Elo (0 à 1)", examples=[0.64])


class Prediction(BaseModel):
    team1: PredictionSide
    team2: PredictionSide
    favorite_team_id: int | None = Field(description="null si l'écart est négligeable")
    explanation: str


class SyncResult(BaseModel):
    matches_received: int
    finished_matches: int
    synced_at: str


class ErrorResponse(BaseModel):
    status: int = Field(examples=[404])
    message: str = Field(examples=["Équipe 42 introuvable"])
    details: list[str] | None = None
