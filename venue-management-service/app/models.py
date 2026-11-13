from sqlalchemy import BigInteger, Boolean, Column, Float, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import relationship

from app.database import Base

# BIGINT sur MySQL, INTEGER AUTOINCREMENT sur SQLite (fallback résilient)
IdType = BigInteger().with_variant(Integer, "sqlite")

VENUE_STATUSES = ("ACTIVE", "INACTIVE")
FIELD_STATUSES = ("AVAILABLE", "MAINTENANCE")


class Venue(Base):
    """Complexe sportif (club, salle) géré par un GERANT (owner_id = id du service Identity)."""
    __tablename__ = "venue"

    id = Column(IdType, primary_key=True, autoincrement=True, index=True)
    name = Column(String(120), nullable=False, index=True)
    description = Column(Text, nullable=True)
    city = Column(String(60), nullable=False, default="", server_default="", index=True)
    address = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    image_url = Column(String(500), nullable=True)
    # Liste séparée par des virgules : "parking,vestiaires,douches,wifi,eclairage,cafeteria"
    amenities = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE", server_default="ACTIVE")
    owner_id = Column(BigInteger, nullable=True, index=True)

    fields = relationship("Field", back_populates="venue", cascade="all, delete-orphan")
    opening_hours = relationship("OpeningHours", back_populates="venue", cascade="all, delete-orphan")


class Field(Base):
    """Terrain réservable d'un complexe (prix par heure en DT)."""
    __tablename__ = "field"

    id = Column(IdType, primary_key=True, autoincrement=True, index=True)
    name = Column(String(100), nullable=False)
    sport = Column(String(50), nullable=False, index=True)       # Football, Tennis, Padel, Basketball, Handball
    price = Column(Float, nullable=False)                        # Prix par heure (DT)
    surface = Column(String(50), nullable=True)                  # Gazon synthétique, Terre battue, Parquet, Dur
    is_indoor = Column(Boolean, nullable=False, default=False, server_default="0")
    status = Column(String(20), nullable=False, default="AVAILABLE", server_default="AVAILABLE")
    venue_id = Column(IdType, ForeignKey("venue.id", ondelete="CASCADE"), nullable=False, index=True)

    venue = relationship("Venue", back_populates="fields")


class OpeningHours(Base):
    """Horaires d'ouverture d'un complexe, un enregistrement par jour."""
    __tablename__ = "opening_hours"

    id = Column(IdType, primary_key=True, autoincrement=True, index=True)
    day = Column(String(15), nullable=False)                     # Lundi ... Dimanche
    opening_time = Column(Time, nullable=False)
    closing_time = Column(Time, nullable=False)
    venue_id = Column(IdType, ForeignKey("venue.id", ondelete="CASCADE"), nullable=False, index=True)

    venue = relationship("Venue", back_populates="opening_hours")
