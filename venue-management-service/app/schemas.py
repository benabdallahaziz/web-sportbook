from datetime import time
from typing import List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field as PydanticField, computed_field


# --- Opening Hours Schemas ---
class OpeningHoursBase(BaseModel):
    day: str = PydanticField(..., examples=["Lundi"], description="Jour de la semaine")
    opening_time: Union[time, str] = PydanticField(..., examples=["08:00:00"], description="Heure d'ouverture (HH:MM:SS)")
    closing_time: Union[time, str] = PydanticField(..., examples=["23:00:00"], description="Heure de fermeture (HH:MM:SS)")

    model_config = ConfigDict(populate_by_name=True)


class OpeningHoursCreate(OpeningHoursBase):
    pass


class OpeningHoursResponse(OpeningHoursBase):
    id: int
    venue_id: int = PydanticField(..., alias="venue_id")

    @computed_field
    @property
    def venueId(self) -> int:
        return self.venue_id

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# --- Field Schemas ---
class FieldBase(BaseModel):
    name: str = PydanticField(..., examples=["Terrain A - synthétique"], description="Nom du terrain")
    sport: str = PydanticField(..., examples=["Football"], description="Discipline (Football, Tennis, Padel, Basketball)")
    price: float = PydanticField(..., ge=0.0, examples=[80.0], description="Prix par heure en DT")

    model_config = ConfigDict(populate_by_name=True)


class FieldCreate(FieldBase):
    venue_id: int = PydanticField(..., validation_alias=PydanticField(None).alias or "venueId", description="ID du complexe sportif rattaché")

    # Support either venue_id or venueId
    def __init__(self, **data):
        if "venueId" in data and "venue_id" not in data:
            data["venue_id"] = data["venueId"]
        super().__init__(**data)


class FieldUpdate(BaseModel):
    name: Optional[str] = PydanticField(None, examples=["Terrain A - rénové"])
    sport: Optional[str] = PydanticField(None, examples=["Football"])
    price: Optional[float] = PydanticField(None, ge=0.0, examples=[90.0])
    venue_id: Optional[int] = PydanticField(None, examples=[1])

    def __init__(self, **data):
        if "venueId" in data and "venue_id" not in data:
            data["venue_id"] = data["venueId"]
        super().__init__(**data)

    model_config = ConfigDict(populate_by_name=True)


class FieldResponse(FieldBase):
    id: int
    venue_id: int

    @computed_field
    @property
    def venueId(self) -> int:
        return self.venue_id

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# --- Venue Schemas ---
class VenueBase(BaseModel):
    name: str = PydanticField(..., examples=["Sport Center Tunis"], description="Nom du complexe sportif")
    address: Optional[str] = PydanticField(None, examples=["12 Rue du Sport, Tunis"], description="Adresse / ville")
    phone: Optional[str] = PydanticField(None, examples=["+216 71 123 456"], description="Numéro de téléphone")
    owner_id: Optional[int] = PydanticField(None, examples=[1], description="ID du gérant (microservice Identity)")

    def __init__(self, **data):
        if "ownerId" in data and "owner_id" not in data:
            data["owner_id"] = data["ownerId"]
        super().__init__(**data)

    model_config = ConfigDict(populate_by_name=True)


class VenueCreate(VenueBase):
    opening_hours: Optional[List[OpeningHoursCreate]] = PydanticField(
        default=None,
        description="Horaires d'ouverture optionnels lors de la création"
    )


class VenueUpdate(BaseModel):
    name: Optional[str] = PydanticField(None, examples=["Sport Center Tunis - Pro"])
    address: Optional[str] = PydanticField(None, examples=["14 Rue du Sport, Tunis"])
    phone: Optional[str] = PydanticField(None, examples=["+216 71 999 888"])
    owner_id: Optional[int] = PydanticField(None, examples=[1])
    opening_hours: Optional[List[OpeningHoursCreate]] = PydanticField(
        None,
        description="Remplacement des horaires d'ouverture"
    )

    def __init__(self, **data):
        if "ownerId" in data and "owner_id" not in data:
            data["owner_id"] = data["ownerId"]
        super().__init__(**data)

    model_config = ConfigDict(populate_by_name=True)


class VenueResponse(VenueBase):
    id: int

    @computed_field
    @property
    def ownerId(self) -> Optional[int]:
        return self.owner_id

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class VenueDetailResponse(VenueBase):
    id: int
    opening_hours: List[OpeningHoursResponse] = []
    fields: List[FieldResponse] = []

    @computed_field
    @property
    def ownerId(self) -> Optional[int]:
        return self.owner_id

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
