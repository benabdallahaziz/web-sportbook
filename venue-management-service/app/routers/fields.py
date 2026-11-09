from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Field, Venue
from app.schemas import FieldCreate, FieldUpdate, FieldResponse
from app.messaging.rabbitmq import publish_event
from app.security.jwt_auth import require_role, CurrentUser

router = APIRouter(prefix="/api/fields", tags=["Fields"])


@router.post("", response_model=FieldResponse, status_code=status.HTTP_201_CREATED)
def create_field(
    field_in: FieldCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role(["ADMIN", "OWNER"]))
):
    """
    Ajouter un nouveau terrain lié à un complexe.
    - Émet un événement RabbitMQ 'field.created'.
    - Sécurité : Réservé aux profils ADMIN ou OWNER.
    """
    venue = db.query(Venue).filter(Venue.id == field_in.venue_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le complexe sportif avec l'ID {field_in.venue_id} n'existe pas."
        )

    field = Field(
        name=field_in.name,
        sport=field_in.sport,
        price=field_in.price,
        venue_id=field_in.venue_id
    )
    db.add(field)
    db.commit()
    db.refresh(field)

    # Événement RabbitMQ
    publish_event("field.created", {
        "id": field.id,
        "name": field.name,
        "sport": field.sport,
        "price": field.price,
        "venue_id": field.venue_id
    })

    return field


@router.get("", response_model=List[FieldResponse])
def get_all_fields(
    venue_id: Optional[int] = Query(None, description="Filtrer par ID du complexe"),
    sport: Optional[str] = Query(None, description="Filtrer par sport (Football, Tennis, Padel...)"),
    min_price: Optional[float] = Query(None, description="Prix horaire minimum"),
    max_price: Optional[float] = Query(None, description="Prix horaire maximum"),
    search: Optional[str] = Query(None, description="Recherche par nom"),
    db: Session = Depends(get_db)
):
    """Récupérer la liste des terrains avec filtres optionnels (Public)."""
    query = db.query(Field)

    if venue_id is not None:
        query = query.filter(Field.venue_id == venue_id)
    if sport:
        query = query.filter(Field.sport.ilike(f"%{sport}%"))
    if min_price is not None:
        query = query.filter(Field.price >= min_price)
    if max_price is not None:
        query = query.filter(Field.price <= max_price)
    if search:
        query = query.filter(Field.name.ilike(f"%{search}%"))

    return query.all()


@router.get("/{field_id}", response_model=FieldResponse)
def get_field(field_id: int, db: Session = Depends(get_db)):
    """Afficher les détails d'un terrain spécifique."""
    field = db.query(Field).filter(Field.id == field_id).first()
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Terrain avec l'ID {field_id} introuvable."
        )
    return field


@router.get("/{field_id}/summary")
def get_field_summary(field_id: int, db: Session = Depends(get_db)):
    """
    Endpoint inter-microservices consommé par booking-availability-service
    pour vérifier la tarification et le complexe d'un terrain avant validation de réservation.
    """
    field = db.query(Field).filter(Field.id == field_id).first()
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Terrain avec l'ID {field_id} introuvable."
        )
    return {
        "id": field.id,
        "name": field.name,
        "sport": field.sport,
        "price_per_hour": field.price,
        "venue_id": field.venue_id,
        "venue_name": field.venue.name if field.venue else None
    }


@router.put("/{field_id}", response_model=FieldResponse)
def update_field(
    field_id: int,
    field_in: FieldUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role(["ADMIN", "OWNER"]))
):
    """Modifier les informations d'un terrain."""
    field = db.query(Field).filter(Field.id == field_id).first()
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Terrain avec l'ID {field_id} introuvable."
        )

    if field_in.venue_id is not None:
        venue = db.query(Venue).filter(Venue.id == field_in.venue_id).first()
        if not venue:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le complexe sportif avec l'ID {field_in.venue_id} n'existe pas."
            )
        field.venue_id = field_in.venue_id

    if field_in.name is not None:
        field.name = field_in.name
    if field_in.sport is not None:
        field.sport = field_in.sport
    if field_in.price is not None:
        field.price = field_in.price

    db.commit()
    db.refresh(field)

    # Événement RabbitMQ
    publish_event("field.updated", {
        "id": field.id,
        "name": field.name,
        "sport": field.sport,
        "price": field.price,
        "venue_id": field.venue_id
    })

    return field


@router.delete("/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_field(
    field_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role(["ADMIN", "OWNER"]))
):
    """
    Supprimer un terrain.
    Émet un événement RabbitMQ 'field.deleted'.
    """
    field = db.query(Field).filter(Field.id == field_id).first()
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Terrain avec l'ID {field_id} introuvable."
        )
    venue_id = field.venue_id
    db.delete(field)
    db.commit()

    # Événement RabbitMQ
    publish_event("field.deleted", {
        "id": field_id,
        "venue_id": venue_id
    })

    return None
