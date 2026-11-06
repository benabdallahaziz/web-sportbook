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
        connect_args = {}
        if db_url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        else:
            connect_args["connect_timeout"] = 2
        _engine = create_engine(
            db_url,
            connect_args=connect_args,
            pool_pre_ping=True
        )
    return _engine


def get_sessionmaker():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _SessionLocal


def is_db_reachable(timeout: float = 0.5) -> bool:
    db_url = settings.get_database_url()
    if db_url.startswith("sqlite"):
        return True
    try:
        with socket.create_connection((settings.DB_HOST, settings.DB_PORT), timeout=timeout):
            return True
    except OSError:
        return False


def init_db():
    if not is_db_reachable(0.5):
        logger.info("Database (%s:%s) is offline. Microservice started with database pending.", settings.DB_HOST, settings.DB_PORT)
        return
    try:
        Base.metadata.create_all(bind=get_engine())
        logger.info("Database tables verified / created.")
    except Exception as e:
        logger.warning("Could not create tables on startup: %s", e)


def get_db():
    session_factory = get_sessionmaker()
    db: Session = session_factory()
    try:
        yield db
    finally:
        db.close()
