"""Connexion à la base PROPRE à ce microservice (sportbook_stats).

Règle microservices : stats-service ne lit JAMAIS directement la base
sportbook_tournament. Il garde sa propre copie des résultats, alimentée
par les événements RabbitMQ ou par l'API REST du service des tournois.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from . import config


class Base(DeclarativeBase):
    pass


engine = create_engine(config.DATABASE_URL, pool_pre_ping=True, pool_recycle=3600)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def _ensure_database() -> None:
    """Crée la base MySQL si elle n'existe pas encore (pratique avec XAMPP)."""
    url = make_url(config.DATABASE_URL)
    if not url.drivername.startswith("mysql") or not url.database:
        return
    # URL du serveur SANS base (url.set(database=None) ne retire pas la base)
    server_url = URL.create(url.drivername, url.username, url.password, url.host, url.port)
    server = create_engine(server_url)
    try:
        with server.connect() as conn:
            conn.execute(text(
                f"CREATE DATABASE IF NOT EXISTS `{url.database}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            ))
            conn.commit()
    finally:
        server.dispose()


def init_db() -> None:
    _ensure_database()
    from . import models  # noqa: F401  (enregistre les tables dans Base.metadata)
    Base.metadata.create_all(engine)


def is_up() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
