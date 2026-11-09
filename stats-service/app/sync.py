"""Mise à jour de la copie locale des résultats.

Deux sources possibles :
  • handle_event() : un événement RabbitMQ (asynchrone, temps réel)
  • full_sync()    : on recopie tout via l'API REST (synchrone, rattrapage)

Les traitements sont IDEMPOTENTS : recevoir deux fois le même événement
donne le même résultat. C'est indispensable car RabbitMQ garantit
« au moins une » livraison (un message peut arriver deux fois).
"""
import logging
import re
from datetime import date, datetime, timezone

from sqlalchemy import delete

from . import tournament_client
from .db import SessionLocal
from .models import MatchResult

log = logging.getLogger("stats.sync")
SCORE_RE = re.compile(r"^(\d+)-(\d+)$")

status = {"last_full_sync": None, "last_event": None, "events_processed": 0}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def to_result(match: dict) -> MatchResult | None:
    """Convertit un match JSON du service Node en ligne locale, s'il est terminé."""
    score = SCORE_RE.match(str(match.get("score") or ""))
    if match.get("status") != "FINISHED" or not score:
        return None
    return MatchResult(
        match_id=int(match["id"]),
        tournament_id=int(match["tournament_id"]),
        team1_id=int(match["team1_id"]),
        team2_id=int(match["team2_id"]),
        goals1=int(score.group(1)),
        goals2=int(score.group(2)),
        played_on=date.fromisoformat(match["date"][:10]) if match.get("date") else None,
    )


def handle_event(message: dict) -> str:
    event = message.get("event")
    data = message.get("data") or {}

    with SessionLocal() as session, session.begin():
        if event == "match.updated":
            result = to_result(data)
            if result:
                session.merge(result)  # INSERT ou UPDATE selon que match_id existe
                outcome = f"match {result.match_id} enregistré ({result.goals1}-{result.goals2})"
            else:
                # Match pas (ou plus) terminé : il ne compte pas au classement
                session.execute(delete(MatchResult).where(MatchResult.match_id == int(data["id"])))
                outcome = f"match {data.get('id')} non terminé, ignoré"
        elif event == "match.deleted":
            session.execute(delete(MatchResult).where(MatchResult.match_id == int(data["id"])))
            outcome = f"match {data['id']} retiré"
        elif event == "tournament.deleted":
            session.execute(delete(MatchResult).where(MatchResult.tournament_id == int(data["id"])))
            outcome = f"matchs du tournoi {data['id']} retirés"
        else:
            return f"événement inconnu ignoré : {event}"

    status["last_event"] = _now()
    status["events_processed"] += 1
    log.info("📥 %s → %s", event, outcome)
    return outcome


def full_sync() -> dict:
    """Recopie tous les matchs terminés depuis tournament-events-service (REST)."""
    matches = tournament_client.get_matches()
    results = [r for r in (to_result(m) for m in matches) if r]
    with SessionLocal() as session, session.begin():
        session.execute(delete(MatchResult))
        session.add_all(results)
    status["last_full_sync"] = _now()
    log.info("🔄 Synchronisation REST : %d matchs reçus, %d terminés", len(matches), len(results))
    return {"matches_received": len(matches), "finished_matches": len(results), "synced_at": status["last_full_sync"]}
