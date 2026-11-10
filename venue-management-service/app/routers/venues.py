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
from app.messaging.rabbitmq import publish_event
from app.security.jwt_auth import require_role, CurrentUser
from app.services.identity_client import verify_owner_exists

router = APIRouter(prefix="/api/venues", tags=["Venues"])


def _parse_time(val):
    if isinstance(val, time):
        return val
    if isinstance(val, str):
        val = val.strip()
        parts = val.split(":")
        if len(parts) >= 2:
            val = f"{parts[0].zfill(2)}:{parts[1].zfill(2)}:{parts[2].zfill(2) if len(parts) > 2 else '00'}"
        for fmt in ("%H:%M:%S", "%H:%M"):
            try:
                return datetime.strptime(val, fmt).time()
            except ValueError:
                pass
    raise ValueError(f"Invalid time format: {val}. Expected HH:MM:SS or HH:MM")


@router.post("", response_model=VenueResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=VenueResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_venue(
    venue_in: VenueCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role(["ADMIN", "OWNER", "GERANT"]))
):
    """
    Enregistrer un nouveau complexe sportif.
    - Synchronisation : Vérifie l'existence du owner_id auprès du microservice identity-user-service.
    - Asynchronisme : Publie un événement RabbitMQ 'venue.created'.
    - Sécurité : Réservé aux profils ADMIN ou OWNER.
    """
    # Validation synchrone inter-microservice (Séance 7)
    if venue_in.owner_id is not None:
        try:
            owner_valid = await verify_owner_exists(venue_in.owner_id)
            if not owner_valid:
                logger.warning("Propriétaire ID %s non trouvé dans Identity Service, mode tolérant.", venue_in.owner_id)
        except Exception as e:
            logger.warning("Vérification propriétaire ignorée : %s", e)

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

    # Émission d'événement asynchrone RabbitMQ (Séance 8)
    publish_event("venue.created", {
        "id": venue.id,
        "name": venue.name,
        "address": venue.address,
        "phone": venue.phone,
        "owner_id": venue.owner_id
    })

    return venue


@router.get("", response_model=List[VenueResponse])
@router.get("/", response_model=List[VenueResponse], include_in_schema=False)
def get_all_venues(
    city: Optional[str] = Query(None, description="Filtrer par ville ou mot-clé dans l'adresse"),
    search: Optional[str] = Query(None, description="Recherche globale sur le nom ou l'adresse"),
    owner_id: Optional[int] = Query(None, description="Filtrer par ID du gérant"),
    db: Session = Depends(get_db)
):
    """Récupérer la liste des complexes sportifs avec filtres optionnels (Public)."""
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


@router.get("/{venue_id}/summary")
def get_venue_summary(venue_id: int, db: Session = Depends(get_db)):
    """
    Endpoint synthétique inter-microservices pour booking-availability-service
    ou mobile clients, renvoyant le résumé des capacités et tarifs.
    """
    venue = (
        db.query(Venue)
        .options(joinedload(Venue.fields), joinedload(Venue.opening_hours))
        .filter(Venue.id == venue_id)
        .first()
    )
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complexe sportif {venue_id} introuvable."
        )
    return {
        "id": venue.id,
        "name": venue.name,
        "address": venue.address,
        "total_fields": len(venue.fields),
        "sports_available": list({f.sport for f in venue.fields}),
        "min_price": min([f.price for f in venue.fields], default=0.0),
        "max_price": max([f.price for f in venue.fields], default=0.0)
    }


@router.put("/{venue_id}", response_model=VenueDetailResponse)
def update_venue(
    venue_id: int,
    venue_in: VenueUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role(["ADMIN", "OWNER", "GERANT"]))
):
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

    # Émission d'événement asynchrone RabbitMQ
    publish_event("venue.updated", {
        "id": venue.id,
        "name": venue.name,
        "address": venue.address,
        "phone": venue.phone,
        "owner_id": venue.owner_id
    })

    return venue


@router.delete("/{venue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_venue(
    venue_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role(["ADMIN", "OWNER", "GERANT"]))
):
    """
    Supprimer un complexe (et par cascade tous ses terrains et horaires).
    Émet un événement RabbitMQ 'venue.deleted' pour avertir booking-service.
    """
    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complexe sportif avec l'ID {venue_id} introuvable."
        )
    db.delete(venue)
    db.commit()

    # Émission d'événement asynchrone RabbitMQ
    publish_event("venue.deleted", {"id": venue_id})

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
def add_opening_hour(
    venue_id: int,
    oh_in: OpeningHoursCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role(["ADMIN", "OWNER", "GERANT"]))
):
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

    publish_event("venue.hours_updated", {
        "venue_id": venue_id,
        "day": oh.day,
        "opening_time": str(op_t),
        "closing_time": str(cl_t)
    })

    return oh
