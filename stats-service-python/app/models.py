"""Table locale : copie des matchs TERMINÉS (on parle de « read model »).

On ne stocke que les faits (qui a joué, le score, la date). Les classements
sont recalculés à la demande : si un score est corrigé, tout reste cohérent.
"""
from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class MatchResult(Base):
    __tablename__ = "match_result"

    match_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    tournament_id: Mapped[int] = mapped_column(BigInteger, index=True)
    team1_id: Mapped[int] = mapped_column(BigInteger)
    team2_id: Mapped[int] = mapped_column(BigInteger)
    goals1: Mapped[int] = mapped_column(Integer)
    goals2: Mapped[int] = mapped_column(Integer)
    played_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
