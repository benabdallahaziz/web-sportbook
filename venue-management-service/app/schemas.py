"""
Schémas Pydantic v2 du service Venue.

Les réponses gardent aussi les alias camelCase historiques (venueId, ownerId) pour ne pas
casser les clients existants (booking-service, ancien frontend).
"""
from datetime import datetime, time
from typing import List, Literal, Optional, Union

from pydantic import (
    AliasChoices, BaseModel, ConfigDict, Field as PydanticField, computed_field, field_validator, model_validator,
)

DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
SPORTS = ["Football", "Tennis", "Padel", "Basketball", "Handball", "Volleyball"]
AMENITIES = ["parking", "vestiaires", "douches", "wifi", "eclairage", "cafeteria"]
VenueStatus = Literal["ACTIVE", "INACTIVE"]
FieldStatus = Literal["AVAILABLE", "MAINTENANCE"]


def parse_time(value: Union[time, str]) -> time:
    """Accepte 08:00, 8:00, 08:00:00 ou un objet time."""
    if isinstance(value, time):
        return value
    text = str(value).strip()
    parts = text.split(":")
    if len(parts) >= 2:
        text = f"{parts[0].zfill(2)}:{parts[1].zfill(2)}:{parts[2].zfill(2) if len(parts) > 2 else '00'}"
    try:
        return datetime.strptime(text, "%H:%M:%S").time()
    except ValueError:
        raise ValueError(f"Heure invalide : '{value}' (format attendu HH:MM)")


def clean_amenities(value: Optional[Union[str, List[str]]]) -> Optional[str]:
    """Liste ou texte "a,b" -> "a,b" normalisé (minuscules, sans doublons, sans vide)."""
    if value is None:
        return None
    items = value if isinstance(value, list) else str(value).split(",")
    seen: List[str] = []
    for item in items:
        key = str(item).strip().lower()
        if key and key not in seen:
            seen.append(key)
    return ",".join(seen)


# ─────────────────────────────── Horaires ───────────────────────────────
class OpeningHoursCreate(BaseModel):
    day: str = PydanticField(..., examples=["Lundi"], description="Jour : Lundi … Dimanche")
    opening_time: Union[time, str] = PydanticField(..., examples=["08:00"])
    closing_time: Union[time, str] = PydanticField(..., examples=["23:00"])

    @field_validator("day")
    @classmethod
    def check_day(cls, v: str) -> str:
        day = v.strip().capitalize()
        if day not in DAYS:
            raise ValueError(f"Jour invalide : '{v}' (attendu : {', '.join(DAYS)})")
        return day

    @model_validator(mode="after")
    def check_times(self):
        self.opening_time = parse_time(self.opening_time)
        self.closing_time = parse_time(self.closing_time)
        if self.closing_time <= self.opening_time:
            raise ValueError(f"{self.day} : l'heure de fermeture doit être après l'heure d'ouverture")
        return self


class OpeningHoursResponse(BaseModel):
    id: int
    day: str
    opening_time: time
    closing_time: time
    venue_id: int

    @computed_field
    @property
    def venueId(self) -> int:
        return self.venue_id

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────── Terrains ───────────────────────────────
class FieldBase(BaseModel):
    name: str = PydanticField(..., min_length=1, max_length=100, examples=["Court Central"])
    sport: str = PydanticField(..., min_length=1, max_length=50, examples=["Padel"])
    price: float = PydanticField(..., ge=0.0, examples=[60.0], description="Prix par heure (DT)")
    surface: Optional[str] = PydanticField(None, max_length=50, examples=["Gazon synthétique"])
    is_indoor: bool = PydanticField(False, validation_alias=AliasChoices("is_indoor", "isIndoor"))
    status: FieldStatus = "AVAILABLE"

    model_config = ConfigDict(populate_by_name=True)


class FieldCreate(FieldBase):
    venue_id: int = PydanticField(..., validation_alias=AliasChoices("venue_id", "venueId"))


class FieldUpdate(BaseModel):
    name: Optional[str] = PydanticField(None, min_length=1, max_length=100)
    sport: Optional[str] = PydanticField(None, min_length=1, max_length=50)
    price: Optional[float] = PydanticField(None, ge=0.0)
    surface: Optional[str] = PydanticField(None, max_length=50)
    is_indoor: Optional[bool] = PydanticField(None, validation_alias=AliasChoices("is_indoor", "isIndoor"))
    status: Optional[FieldStatus] = None
    venue_id: Optional[int] = PydanticField(None, validation_alias=AliasChoices("venue_id", "venueId"))

    model_config = ConfigDict(populate_by_name=True)


class FieldResponse(BaseModel):
    id: int
    name: str
    sport: str
    price: float
    surface: Optional[str] = None
    is_indoor: bool = False
    status: str = "AVAILABLE"
    venue_id: int
    venue_name: Optional[str] = None
    venue_city: Optional[str] = None

    @computed_field
    @property
    def venueId(self) -> int:
        return self.venue_id

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────── Complexes ───────────────────────────────
class VenueBase(BaseModel):
    name: str = PydanticField(..., min_length=1, max_length=120, examples=["Padel Club Lac"])
    description: Optional[str] = PydanticField(None, examples=["4 courts de padel couverts, club house"])
    city: str = PydanticField(..., min_length=1, max_length=60, examples=["Tunis"])
    address: Optional[str] = PydanticField(None, max_length=255, examples=["Rue du Lac Léman, Les Berges du Lac"])
    phone: Optional[str] = PydanticField(None, max_length=30, examples=["+216 71 123 456"])
    image_url: Optional[str] = PydanticField(None, max_length=500, validation_alias=AliasChoices("image_url", "imageUrl"))
    amenities: Optional[Union[str, List[str]]] = PydanticField(None, examples=["parking,vestiaires,douches"])
    status: VenueStatus = "ACTIVE"
    owner_id: Optional[int] = PydanticField(None, validation_alias=AliasChoices("owner_id", "ownerId"))

    @field_validator("amenities", mode="before")
    @classmethod
    def norm_amenities(cls, v):
        return clean_amenities(v)

    @field_validator("city")
    @classmethod
    def norm_city(cls, v: str) -> str:
        return v.strip()

    model_config = ConfigDict(populate_by_name=True)


class VenueCreate(VenueBase):
    opening_hours: Optional[List[OpeningHoursCreate]] = None


class VenueUpdate(BaseModel):
    name: Optional[str] = PydanticField(None, min_length=1, max_length=120)
    description: Optional[str] = None
    city: Optional[str] = PydanticField(None, min_length=1, max_length=60)
    address: Optional[str] = PydanticField(None, max_length=255)
    phone: Optional[str] = PydanticField(None, max_length=30)
    image_url: Optional[str] = PydanticField(None, max_length=500, validation_alias=AliasChoices("image_url", "imageUrl"))
    amenities: Optional[Union[str, List[str]]] = None
    status: Optional[VenueStatus] = None
    owner_id: Optional[int] = PydanticField(None, validation_alias=AliasChoices("owner_id", "ownerId"))
    opening_hours: Optional[List[OpeningHoursCreate]] = PydanticField(None, description="Remplace tous les horaires")

    @field_validator("amenities", mode="before")
    @classmethod
    def norm_amenities(cls, v):
        return clean_amenities(v)

    model_config = ConfigDict(populate_by_name=True)


class VenueResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    city: str = ""
    address: Optional[str] = None
    phone: Optional[str] = None
    image_url: Optional[str] = None
    amenities: Optional[str] = None
    status: str = "ACTIVE"
    owner_id: Optional[int] = None
    # Résumé calculé (catalogue)
    sports: List[str] = []
    fields_count: int = 0
    available_fields: int = 0
    min_price: Optional[float] = None
    has_indoor: bool = False

    @computed_field
    @property
    def ownerId(self) -> Optional[int]:
        return self.owner_id

    @computed_field
    @property
    def amenities_list(self) -> List[str]:
        return [a for a in (self.amenities or "").split(",") if a]

    model_config = ConfigDict(from_attributes=True)


class VenueDetailResponse(VenueResponse):
    opening_hours: List[OpeningHoursResponse] = []
    fields: List[FieldResponse] = []
