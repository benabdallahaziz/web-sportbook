from typing import List, Optional
from datetime import datetime, time
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Venue, Field, OpeningHours
from app.schemas import (
    VenueCreate,
    VenueUpdate,
    VenueResponse,
    VenueDetailResponse,
    FieldResponse,
    OpeningHoursCreate,
    OpeningHoursResponse
)

router = APIRouter(prefix="/api/venues", tags=["Venues"])


def _parse_time(val):
    if isinstance(val, time):
        return val
    if isinstance(val, str):
        val = val.strip()
        # support HH:MM:SS or HH:MM
        for fmt in ("%H:%M:%S", "%H:%M"):
            try:
                return datetime.strptime(val, fmt).time()
            except ValueError:
                pass
    raise ValueError(f"Invalid time format: {val}. Expected HH:MM:SS or HH:MM")


@router.post("", response_model=VenueResponse, status_code=status.HTTP_201_CREATED)
def create_venue(venue_in: VenueCreate, db: Session = Depends(get_db)):
    """Enregistrer un nouveau complexe sportif."""
    venue = Venue(
        name=venue_in.name,
        address=venue_in.address,
        phone=venue_in.phone,
        owner_id=venue_in.owner_id
    )
    db.add(venue)
    db.flush()

    if venue_in.opening_hours:
        for oh in venue_in.opening_hours:
            try:
                op_t = _parse_time(oh.opening_time)
                cl_t = _parse_time(oh.closing_time)
            except ValueError as e:
                db.rollback()
                raise HTTPException(status_code=400, detail=str(e))
            db.add(OpeningHours(
                day=oh.day,
                opening_time=op_t,
                closing_time=cl_t,
                venue_id=venue.id
            ))

    db.commit()
    db.refresh(venue)
    return venue


@router.get("", response_model=List[VenueResponse])
def get_all_venues(
    city: Optional[str] = Query(None, description="Filtrer par ville ou mot-clé dans l'adresse"),
    search: Optional[str] = Query(None, description="Recherche globale sur le nom ou l'adresse"),
    owner_id: Optional[int] = Query(None, description="Filtrer par ID du gérant"),
    db: Session = Depends(get_db)
):
    """Récupérer la liste des complexes sportifs avec filtres optionnels."""
    query = db.query(Venue)

    if city:
        query = query.filter(Venue.address.ilike(f"%{city}%"))
    if search:
        query = query.filter(
            (Venue.name.ilike(f"%{search}%")) | (Venue.address.ilike(f"%{search}%"))
        )
    if owner_id is not None:
        query = query.filter(Venue.owner_id == owner_id)

    return query.all()


@router.get("/{venue_id}", response_model=VenueDetailResponse)
def get_venue(venue_id: int, db: Session = Depends(get_db)):
    """Afficher les détails d'un complexe spécifique (nom, adresse, téléphone, horaires, terrains)."""
    venue = (
        db.query(Venue)
        .options(joinedload(Venue.opening_hours), joinedload(Venue.fields))
        .filter(Venue.id == venue_id)
        .first()
    )
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complexe sportif avec l'ID {venue_id} introuvable."
        )
    return venue


@router.put("/{venue_id}", response_model=VenueDetailResponse)
def update_venue(venue_id: int, venue_in: VenueUpdate, db: Session = Depends(get_db)):
    """Modifier les informations d'un complexe (ex: adresse, horaires d'ouverture...)."""
    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complexe sportif avec l'ID {venue_id} introuvable."
        )

    if venue_in.name is not None:
        venue.name = venue_in.name
    if venue_in.address is not None:
        venue.address = venue_in.address
    if venue_in.phone is not None:
        venue.phone = venue_in.phone
    if venue_in.owner_id is not None:
        venue.owner_id = venue_in.owner_id

    # Si une nouvelle liste d'horaires est fournie, on remplace
    if venue_in.opening_hours is not None:
        db.query(OpeningHours).filter(OpeningHours.venue_id == venue.id).delete()
        for oh in venue_in.opening_hours:
            try:
                op_t = _parse_time(oh.opening_time)
                cl_t = _parse_time(oh.closing_time)
            except ValueError as e:
                db.rollback()
                raise HTTPException(status_code=400, detail=str(e))
            db.add(OpeningHours(
                day=oh.day,
                opening_time=op_t,
                closing_time=cl_t,
                venue_id=venue.id
            ))

    db.commit()
    db.refresh(venue)
    return venue


@router.delete("/{venue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_venue(venue_id: int, db: Session = Depends(get_db)):
    """Supprimer un complexe (et par cascade tous ses terrains et horaires)."""
    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complexe sportif avec l'ID {venue_id} introuvable."
        )
    db.delete(venue)
    db.commit()
    return None


# --- Endpoints annexes pratiques pour les relations du complexe ---

@router.get("/{venue_id}/fields", response_model=List[FieldResponse])
def get_venue_fields(venue_id: int, db: Session = Depends(get_db)):
    """Récupérer tous les terrains appartenant à ce complexe."""
    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complexe sportif avec l'ID {venue_id} introuvable."
        )
    return venue.fields


@router.get("/{venue_id}/opening-hours", response_model=List[OpeningHoursResponse])
def get_venue_opening_hours(venue_id: int, db: Session = Depends(get_db)):
    """Récupérer les horaires d'un complexe."""
    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complexe sportif avec l'ID {venue_id} introuvable."
        )
    return venue.opening_hours


@router.post("/{venue_id}/opening-hours", response_model=OpeningHoursResponse, status_code=status.HTTP_201_CREATED)
def add_opening_hour(venue_id: int, oh_in: OpeningHoursCreate, db: Session = Depends(get_db)):
    """Ajouter un créneau d'ouverture au complexe."""
    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complexe sportif avec l'ID {venue_id} introuvable."
        )
    try:
        op_t = _parse_time(oh_in.opening_time)
        cl_t = _parse_time(oh_in.closing_time)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    oh = OpeningHours(
        day=oh_in.day,
        opening_time=op_t,
        closing_time=cl_t,
        venue_id=venue_id
    )
    db.add(oh)
    db.commit()
    db.refresh(oh)
    return oh
