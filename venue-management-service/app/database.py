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
            migrate(_engine)
        except Exception as e:
            logger.warning("Erreur lors de la création des tables : %s", e)
    return _engine


# Colonnes ajoutées après la première version : (table, colonne, DDL MySQL, DDL SQLite)
_NEW_COLUMNS = [
    ("venue", "description", "TEXT NULL", "TEXT"),
    ("venue", "city", "VARCHAR(60) NOT NULL DEFAULT ''", "VARCHAR(60) NOT NULL DEFAULT ''"),
    ("venue", "image_url", "VARCHAR(500) NULL", "VARCHAR(500)"),
    ("venue", "amenities", "VARCHAR(255) NULL", "VARCHAR(255)"),
    ("venue", "status", "VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'", "VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'"),
    ("field", "surface", "VARCHAR(50) NULL", "VARCHAR(50)"),
    ("field", "is_indoor", "TINYINT(1) NOT NULL DEFAULT 0", "BOOLEAN NOT NULL DEFAULT 0"),
    ("field", "status", "VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'", "VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'"),
]

KNOWN_CITIES = [
    "Tunis", "Ariana", "Ben Arous", "La Marsa", "Manouba", "Nabeul", "Hammamet", "Bizerte", "Sousse",
    "Monastir", "Mahdia", "Sfax", "Kairouan", "Gabès", "Gafsa", "Djerba", "Médenine", "Tozeur", "Béja", "Jendouba",
]


def migrate(engine):
    """
    Migration au démarrage : ajoute les colonnes manquantes aux tables existantes
    (bases créées avant l'enrichissement du modèle) puis déduit la ville depuis l'adresse.
    """
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    sqlite = engine.dialect.name == "sqlite"
    with engine.begin() as conn:
        for table, column, ddl_mysql, ddl_sqlite in _NEW_COLUMNS:
            existing = {c["name"] for c in insp.get_columns(table)}
            if column not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_sqlite if sqlite else ddl_mysql}"))
                logger.info("Migration : colonne %s.%s ajoutée", table, column)

        # Ville vide : on la retrouve dans l'adresse si possible (ex. "12 rue X, Sousse")
        rows = conn.execute(text("SELECT id, address FROM venue WHERE city = '' OR city IS NULL")).fetchall()
        for venue_id, address in rows:
            addr = (address or "").lower()
            city = next((c for c in KNOWN_CITIES if c.lower() in addr), "")
            if city:
                conn.execute(text("UPDATE venue SET city = :c WHERE id = :i"), {"c": city, "i": venue_id})


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
