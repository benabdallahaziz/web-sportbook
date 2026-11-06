from sqlalchemy import Column, BigInteger, Integer, String, Float, Time, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

# IdType enables standard BIGINT on MySQL and INTEGER AUTOINCREMENT on SQLite
IdType = BigInteger().with_variant(Integer, "sqlite")


class Venue(Base):
    __tablename__ = "venue"

    id = Column(IdType, primary_key=True, autoincrement=True, index=True)
    name = Column(String(120), nullable=False, index=True)
    address = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    owner_id = Column(BigInteger, nullable=True)

    fields = relationship(
        "Field",
        back_populates="venue",
        cascade="all, delete-orphan"
    )
    opening_hours = relationship(
        "OpeningHours",
        back_populates="venue",
        cascade="all, delete-orphan"
    )


class Field(Base):
    __tablename__ = "field"

    id = Column(IdType, primary_key=True, autoincrement=True, index=True)
    name = Column(String(100), nullable=False)
    sport = Column(String(50), nullable=False, index=True)  # Football, Tennis, Padel, Basketball
    price = Column(Float, nullable=False)                   # Prix par heure (DT)
    venue_id = Column(IdType, ForeignKey("venue.id", ondelete="CASCADE"), nullable=False, index=True)

    venue = relationship("Venue", back_populates="fields")


class OpeningHours(Base):
    __tablename__ = "opening_hours"

    id = Column(IdType, primary_key=True, autoincrement=True, index=True)
    day = Column(String(15), nullable=False)                # Ex: Lundi, Mardi... or Monday
    opening_time = Column(Time, nullable=False)
    closing_time = Column(Time, nullable=False)
    venue_id = Column(IdType, ForeignKey("venue.id", ondelete="CASCADE"), nullable=False, index=True)

    venue = relationship("Venue", back_populates="opening_hours")
