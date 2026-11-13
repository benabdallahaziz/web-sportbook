"""
/api/venues : complexes sportifs.

  GET    /api/venues                     public  catalogue filtrable (ville, recherche, sport, prix max, couvert)
  GET    /api/venues/my-venues           GERANT  mes complexes (ADMIN : tous)
  GET    /api/venues/{id}                public  détail + terrains + horaires
  GET    /api/venues/{id}/summary        public  résumé inter-services (booking-service)
  POST   /api/venues                     ADMIN | GERANT   (GERANT : owner_id forcé à son id)
  PUT    /api/venues/{id}                ADMIN | propriétaire
  DELETE /api/venues/{id}                ADMIN | propriétaire
  GET    /api/venues/{id}/fields         public
  GET    /api/venues/{id}/opening-hours  public
  PUT    /api/venues/{id}/opening-hours  ADMIN | propriétaire  (remplace la semaine)
  POST   /api/venues/{id}/opening-hours  ADMIN | propriétaire  (ajoute un jour)
  DELETE /api/venues/{id}/opening-hours/{ohId}  ADMIN | propriétaire
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.messaging.rabbitmq import publish_event
from app.models import Field, OpeningHours, Venue
from app.schemas import (
    DAYS, FieldResponse, OpeningHoursCreate, OpeningHoursResponse, VenueCreate, VenueDetailResponse,
    VenueResponse, VenueUpdate,
)
from app.security.jwt_auth import CurrentUser, ensure_venue_owner, get_current_user, require_role
from app.services.identity_client import verify_owner_exists

logger = logging.getLogger("venues-router")
router = APIRouter(prefix="/api/venues", tags=["Venues"])

WRITE_ROLES = ["ADMIN", "GERANT"]


# ─────────────────────────────── Helpers ───────────────────────────────
def _field_out(f: Field) -> FieldResponse:
    out = FieldResponse.model_validate(f)
    out.venue_name = f.venue.name if f.venue else None
    out.venue_city = f.venue.city if f.venue else None
    return out


def _venue_out(v: Venue, detail: bool = False):
    fields = list(v.fields or [])
    bookable = [f for f in fields if f.status == "AVAILABLE"]
    data = {
        "id": v.id, "name": v.name, "description": v.description, "city": v.city or "",
        "address": v.address, "phone": v.phone, "image_url": v.image_url, "amenities": v.amenities,
        "status": v.status or "ACTIVE", "owner_id": v.owner_id,
        "sports": sorted({f.sport for f in fields}),
        "fields_count": len(fields),
        "available_fields": len(bookable),
        "min_price": min((f.price for f in bookable), default=None),
        "has_indoor": any(f.is_indoor for f in fields),
    }
    if not detail:
        return VenueResponse(**data)
    order = {d: i for i, d in enumerate(DAYS)}
    hours = sorted(v.opening_hours or [], key=lambda h: order.get(h.day, 99))
    return VenueDetailResponse(
        **data,
        opening_hours=[OpeningHoursResponse.model_validate(h) for h in hours],
        fields=[_field_out(f) for f in sorted(fields, key=lambda f: (f.sport, f.name))],
    )


def _get_venue(db: Session, venue_id: int) -> Venue:
    venue = (
        db.query(Venue)
        .options(selectinload(Venue.fields), selectinload(Venue.opening_hours))
        .filter(Venue.id == venue_id)
        .first()
    )
    if not venue:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Complexe sportif {venue_id} introuvable.")
    return venue


def _replace_hours(db: Session, venue: Venue, hours: List[OpeningHoursCreate]) -> None:
    days = [h.day for h in hours]
    if len(days) != len(set(days)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Chaque jour ne peut apparaître qu'une fois dans les horaires.")
    db.query(OpeningHours).filter(OpeningHours.venue_id == venue.id).delete()
    for h in hours:
        db.add(OpeningHours(day=h.day, opening_time=h.opening_time, closing_time=h.closing_time, venue_id=venue.id))


def _event(v: Venue) -> dict:
    return {"id": v.id, "name": v.name, "city": v.city, "address": v.address, "phone": v.phone,
            "status": v.status, "owner_id": v.owner_id}


# ─────────────────────────────── Lecture ───────────────────────────────
@router.get("", response_model=List[VenueResponse])
@router.get("/", response_model=List[VenueResponse], include_in_schema=False)
def list_venues(
    city: Optional[str] = Query(None, description="Ville exacte (Tunis, Sousse…)"),
    search: Optional[str] = Query(None, description="Recherche sur le nom, la ville ou l'adresse"),
    sport: Optional[str] = Query(None, description="Complexes ayant au moins un terrain de ce sport"),
    max_price: Optional[float] = Query(None, ge=0, description="Au moins un terrain disponible à ce prix max (DT/h)"),
    indoor: Optional[bool] = Query(None, description="true : au moins un terrain couvert"),
    owner_id: Optional[int] = Query(None, description="Complexes d'un gérant"),
    include_inactive: bool = Query(False, description="Inclure les complexes INACTIVE (masqués du catalogue)"),
    db: Session = Depends(get_db),
):
    """Catalogue public des complexes, avec résumé des terrains (sports, prix de départ, couvert)."""
    q = db.query(Venue).options(selectinload(Venue.fields))
    if not include_inactive:
        q = q.filter(Venue.status == "ACTIVE")
    if city:
        q = q.filter(Venue.city.ilike(city.strip()))
    if search:
        like = f"%{search.strip()}%"
        q = q.filter(Venue.name.ilike(like) | Venue.city.ilike(like) | Venue.address.ilike(like))
    if owner_id is not None:
        q = q.filter(Venue.owner_id == owner_id)
    if sport:
        q = q.filter(Venue.fields.any(Field.sport.ilike(sport.strip())))
    if max_price is not None:
        q = q.filter(Venue.fields.any((Field.price <= max_price) & (Field.status == "AVAILABLE")))
    if indoor:
        q = q.filter(Venue.fields.any(Field.is_indoor.is_(True)))
    return [_venue_out(v) for v in q.order_by(Venue.city, Venue.name).all()]


@router.get("/my-venues", response_model=List[VenueDetailResponse])
def my_venues(db: Session = Depends(get_db), user: CurrentUser = Depends(require_role(WRITE_ROLES))):
    """Complexes du gérant connecté (tous statuts) ; ADMIN : tous les complexes."""
    q = db.query(Venue).options(selectinload(Venue.fields), selectinload(Venue.opening_hours))
    if not user.is_admin:
        q = q.filter(Venue.owner_id == user.id)
    return [_venue_out(v, detail=True) for v in q.order_by(Venue.name).all()]


@router.get("/{venue_id}", response_model=VenueDetailResponse)
def get_venue(venue_id: int, db: Session = Depends(get_db)):
    """Détail d'un complexe : description, horaires de la semaine et terrains."""
    return _venue_out(_get_venue(db, venue_id), detail=True)


@router.get("/{venue_id}/summary")
def get_venue_summary(venue_id: int, db: Session = Depends(get_db)):
    """Résumé inter-microservices (booking-availability-service, mobile)."""
    v = _get_venue(db, venue_id)
    return {
        "id": v.id, "name": v.name, "city": v.city, "address": v.address, "status": v.status,
        "total_fields": len(v.fields),
        "available_fields": sum(1 for f in v.fields if f.status == "AVAILABLE"),
        "sports_available": sorted({f.sport for f in v.fields}),
        "min_price": min((f.price for f in v.fields), default=0.0),
        "max_price": max((f.price for f in v.fields), default=0.0),
    }


@router.get("/{venue_id}/fields", response_model=List[FieldResponse])
def get_venue_fields(venue_id: int, db: Session = Depends(get_db)):
    return [_field_out(f) for f in _get_venue(db, venue_id).fields]


@router.get("/{venue_id}/opening-hours", response_model=List[OpeningHoursResponse])
def get_venue_opening_hours(venue_id: int, db: Session = Depends(get_db)):
    return _venue_out(_get_venue(db, venue_id), detail=True).opening_hours


# ─────────────────────────────── Écriture ───────────────────────────────
@router.post("", response_model=VenueDetailResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=VenueDetailResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_venue(
    venue_in: VenueCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role(WRITE_ROLES)),
):
    """
    Créer un complexe. Un GERANT en devient automatiquement propriétaire ;
    un ADMIN peut l'attribuer à un gérant (owner_id vérifié auprès d'identity-user-service).
    Publie 'venue.created' sur RabbitMQ.
    """
    owner_id = venue_in.owner_id if user.is_admin else user.id
    if user.is_admin and owner_id is not None and not await verify_owner_exists(owner_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Le gérant {owner_id} n'existe pas dans identity-user-service.")

    venue = Venue(
        name=venue_in.name, description=venue_in.description, city=venue_in.city, address=venue_in.address,
        phone=venue_in.phone, image_url=venue_in.image_url, amenities=venue_in.amenities,
        status=venue_in.status, owner_id=owner_id,
    )
    db.add(venue)
    db.flush()
    if venue_in.opening_hours:
        _replace_hours(db, venue, venue_in.opening_hours)
    db.commit()

    venue = _get_venue(db, venue.id)
    publish_event("venue.created", _event(venue))
    return _venue_out(venue, detail=True)


@router.put("/{venue_id}", response_model=VenueDetailResponse)
async def update_venue(
    venue_id: int,
    venue_in: VenueUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role(WRITE_ROLES)),
):
    """Modifier un complexe (propriétaire ou ADMIN). Seul un ADMIN peut changer le propriétaire."""
    venue = _get_venue(db, venue_id)
    ensure_venue_owner(user, venue)

    data = venue_in.model_dump(exclude_unset=True, exclude={"opening_hours", "owner_id"})
    for key, value in data.items():
        setattr(venue, key, value)
    if "owner_id" in venue_in.model_fields_set and venue_in.owner_id != venue.owner_id:
        if not user.is_admin:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Seul un administrateur peut changer le propriétaire d'un complexe.")
        if venue_in.owner_id is not None and not await verify_owner_exists(venue_in.owner_id):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Le gérant {venue_in.owner_id} n'existe pas.")
        venue.owner_id = venue_in.owner_id
    if venue_in.opening_hours is not None:
        _replace_hours(db, venue, venue_in.opening_hours)
    db.commit()

    venue = _get_venue(db, venue_id)
    publish_event("venue.updated", _event(venue))
    return _venue_out(venue, detail=True)


@router.delete("/{venue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_venue(venue_id: int, db: Session = Depends(get_db), user: CurrentUser = Depends(require_role(WRITE_ROLES))):
    """Supprimer un complexe et, en cascade, ses terrains et horaires. Publie 'venue.deleted'."""
    venue = _get_venue(db, venue_id)
    ensure_venue_owner(user, venue)
    field_ids = [f.id for f in venue.fields]
    db.delete(venue)
    db.commit()
    publish_event("venue.deleted", {"id": venue_id, "field_ids": field_ids})
    return None


@router.put("/{venue_id}/opening-hours", response_model=List[OpeningHoursResponse])
def replace_opening_hours(
    venue_id: int,
    hours: List[OpeningHoursCreate],
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role(WRITE_ROLES)),
):
    """Remplace les horaires de la semaine (une ligne par jour ouvert ; jour absent = fermé)."""
    venue = _get_venue(db, venue_id)
    ensure_venue_owner(user, venue)
    _replace_hours(db, venue, hours)
    db.commit()
    publish_event("venue.hours_updated", {"venue_id": venue_id, "days": [h.day for h in hours]})
    return _venue_out(_get_venue(db, venue_id), detail=True).opening_hours


@router.post("/{venue_id}/opening-hours", response_model=OpeningHoursResponse, status_code=status.HTTP_201_CREATED)
def add_opening_hour(
    venue_id: int,
    oh_in: OpeningHoursCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role(WRITE_ROLES)),
):
    venue = _get_venue(db, venue_id)
    ensure_venue_owner(user, venue)
    if any(h.day == oh_in.day for h in venue.opening_hours):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Un horaire existe déjà pour {oh_in.day}.")
    oh = OpeningHours(day=oh_in.day, opening_time=oh_in.opening_time, closing_time=oh_in.closing_time, venue_id=venue_id)
    db.add(oh)
    db.commit()
    db.refresh(oh)
    publish_event("venue.hours_updated", {"venue_id": venue_id, "day": oh.day,
                                          "opening_time": str(oh.opening_time), "closing_time": str(oh.closing_time)})
    return oh


@router.delete("/{venue_id}/opening-hours/{oh_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_opening_hour(
    venue_id: int, oh_id: int, db: Session = Depends(get_db), user: CurrentUser = Depends(require_role(WRITE_ROLES)),
):
    venue = _get_venue(db, venue_id)
    ensure_venue_owner(user, venue)
    oh = db.query(OpeningHours).filter(OpeningHours.id == oh_id, OpeningHours.venue_id == venue_id).first()
    if not oh:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Horaire {oh_id} introuvable pour ce complexe.")
    db.delete(oh)
    db.commit()
    publish_event("venue.hours_updated", {"venue_id": venue_id, "removed_day": oh.day})
    return None


# get_current_user est réexporté pour les tests / autres routeurs
__all__ = ["router", "get_current_user"]
