import logging
import socket
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings

logger = logging.getLogger("database")

Base = declarative_base()

_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        db_url = settings.get_database_url()
        try:
            connect_args = {}
            if db_url.startswith("sqlite"):
                connect_args["check_same_thread"] = False
            else:
                connect_args["connect_timeout"] = 3
            eng = create_engine(
                db_url,
                connect_args=connect_args,
                pool_pre_ping=True
            )
            with eng.connect() as conn:
                pass
            _engine = eng
            logger.info("Connexion réussie à MySQL (%s).", db_url)
        except Exception as e:
            logger.warning("Connexion MySQL indisponible (%s). Activation du fallback SQLite résilient.", e)
            _engine = create_engine(
                "sqlite:///./venue.db",
                connect_args={"check_same_thread": False}
            )
        try:
            import app.models  # Charge les classes ORM dans Base.metadata
            Base.metadata.create_all(bind=_engine)
            logger.info("Tables vérifiées / créées avec succès : %s", list(Base.metadata.tables.keys()))
        except Exception as e:
            logger.warning("Erreur lors de la création des tables : %s", e)
    return _engine


def get_sessionmaker():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _SessionLocal


def is_db_reachable(timeout: float = 0.5) -> bool:
    try:
        get_engine()
        return True
    except Exception:
        return False


def init_db():
    get_engine()


def get_db():
    session_factory = get_sessionmaker()
    db: Session = session_factory()
    try:
        yield db
    finally:
        db.close()
