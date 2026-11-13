"""
/api/fields : terrains des complexes.

  GET    /api/fields                           public  filtres : complexe, sport, prix, couvert, statut, ville
  GET    /api/fields/{id}                      public
  GET    /api/fields/{id}/summary              public  (booking-availability-service)
  POST   /api/fields                           ADMIN | propriétaire du complexe ciblé
  PUT    /api/fields/{id}                      ADMIN | propriétaire du complexe du terrain
  PATCH  /api/fields/{id}/toggle-maintenance   ADMIN | propriétaire  AVAILABLE <-> MAINTENANCE
  DELETE /api/fields/{id}                      ADMIN | propriétaire
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.messaging.rabbitmq import publish_event
from app.models import Field, Venue
from app.schemas import FieldCreate, FieldResponse, FieldUpdate
from app.security.jwt_auth import CurrentUser, ensure_venue_owner, require_role

router = APIRouter(prefix="/api/fields", tags=["Fields"])

WRITE_ROLES = ["ADMIN", "GERANT"]


def _out(f: Field) -> FieldResponse:
    out = FieldResponse.model_validate(f)
    out.venue_name = f.venue.name if f.venue else None
    out.venue_city = f.venue.city if f.venue else None
    return out


def _event(f: Field) -> dict:
    return {"id": f.id, "name": f.name, "sport": f.sport, "price": f.price, "surface": f.surface,
            "is_indoor": f.is_indoor, "status": f.status, "venue_id": f.venue_id}


def _get_field(db: Session, field_id: int) -> Field:
    field = db.query(Field).options(joinedload(Field.venue)).filter(Field.id == field_id).first()
    if not field:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Terrain {field_id} introuvable.")
    return field


def _get_venue(db: Session, venue_id: int) -> Venue:
    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Le complexe sportif {venue_id} n'existe pas.")
    return venue


# ─────────────────────────────── Lecture ───────────────────────────────
@router.get("", response_model=List[FieldResponse])
@router.get("/", response_model=List[FieldResponse], include_in_schema=False)
def list_fields(
    venue_id: Optional[int] = Query(None, description="Terrains d'un complexe"),
    sport: Optional[str] = Query(None, description="Football, Tennis, Padel…"),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    indoor: Optional[bool] = Query(None, description="true : couverts, false : plein air"),
    status_filter: Optional[str] = Query(None, alias="status", description="AVAILABLE ou MAINTENANCE"),
    city: Optional[str] = Query(None, description="Ville du complexe"),
    search: Optional[str] = Query(None, description="Recherche sur le nom du terrain"),
    db: Session = Depends(get_db),
):
    q = db.query(Field).options(joinedload(Field.venue))
    if venue_id is not None:
        q = q.filter(Field.venue_id == venue_id)
    if sport:
        q = q.filter(Field.sport.ilike(f"%{sport.strip()}%"))
    if min_price is not None:
        q = q.filter(Field.price >= min_price)
    if max_price is not None:
        q = q.filter(Field.price <= max_price)
    if indoor is not None:
        q = q.filter(Field.is_indoor.is_(indoor))
    if status_filter:
        q = q.filter(Field.status == status_filter.upper())
    if city:
        q = q.join(Venue).filter(Venue.city.ilike(city.strip()))
    if search:
        q = q.filter(Field.name.ilike(f"%{search.strip()}%"))
    return [_out(f) for f in q.order_by(Field.venue_id, Field.sport, Field.name).all()]


@router.get("/{field_id}", response_model=FieldResponse)
def get_field(field_id: int, db: Session = Depends(get_db)):
    return _out(_get_field(db, field_id))


@router.get("/{field_id}/summary")
def get_field_summary(field_id: int, db: Session = Depends(get_db)):
    """Consommé par booking-availability-service avant de valider une réservation."""
    f = _get_field(db, field_id)
    return {
        "id": f.id, "name": f.name, "sport": f.sport, "price_per_hour": f.price, "surface": f.surface,
        "is_indoor": f.is_indoor, "status": f.status, "bookable": f.status == "AVAILABLE",
        "venue_id": f.venue_id, "venue_name": f.venue.name if f.venue else None,
    }


# ─────────────────────────────── Écriture ───────────────────────────────
@router.post("", response_model=FieldResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=FieldResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_field(field_in: FieldCreate, db: Session = Depends(get_db), user: CurrentUser = Depends(require_role(WRITE_ROLES))):
    """Ajouter un terrain à un complexe dont on est propriétaire. Publie 'field.created'."""
    venue = _get_venue(db, field_in.venue_id)
    ensure_venue_owner(user, venue)
    field = Field(**field_in.model_dump())
    db.add(field)
    db.commit()
    field = _get_field(db, field.id)
    publish_event("field.created", _event(field))
    return _out(field)


@router.put("/{field_id}", response_model=FieldResponse)
def update_field(field_id: int, field_in: FieldUpdate, db: Session = Depends(get_db),
                 user: CurrentUser = Depends(require_role(WRITE_ROLES))):
    """Modifier un terrain. Le déplacer vers un autre complexe exige d'en être aussi propriétaire."""
    field = _get_field(db, field_id)
    ensure_venue_owner(user, field.venue)
    data = field_in.model_dump(exclude_unset=True)
    if data.get("venue_id") is not None and data["venue_id"] != field.venue_id:
        ensure_venue_owner(user, _get_venue(db, data["venue_id"]))
    for key, value in data.items():
        if value is not None or key == "surface":
            setattr(field, key, value)
    db.commit()
    field = _get_field(db, field_id)
    publish_event("field.updated", _event(field))
    return _out(field)


@router.patch("/{field_id}/toggle-maintenance", response_model=FieldResponse)
def toggle_maintenance(field_id: int, db: Session = Depends(get_db), user: CurrentUser = Depends(require_role(WRITE_ROLES))):
    """Bascule le terrain entre AVAILABLE (réservable) et MAINTENANCE (fermé). Publie 'field.updated'."""
    field = _get_field(db, field_id)
    ensure_venue_owner(user, field.venue)
    field.status = "AVAILABLE" if field.status == "MAINTENANCE" else "MAINTENANCE"
    db.commit()
    field = _get_field(db, field_id)
    publish_event("field.updated", _event(field))
    return _out(field)


@router.delete("/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_field(field_id: int, db: Session = Depends(get_db), user: CurrentUser = Depends(require_role(WRITE_ROLES))):
    """Supprimer un terrain. Publie 'field.deleted'."""
    field = _get_field(db, field_id)
    ensure_venue_owner(user, field.venue)
    venue_id = field.venue_id
    db.delete(field)
    db.commit()
    publish_event("field.deleted", {"id": field_id, "venue_id": venue_id})
    return None
