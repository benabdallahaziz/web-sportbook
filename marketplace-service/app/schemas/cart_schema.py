from __future__ import annotations
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict, field_validator


# ── CartItem ────────────────────────────────────────────────

class CartItemOut(BaseModel):
    id:         int
    product_id: int
    quantity:   int
    unit_price: float

    model_config = ConfigDict(from_attributes=True)


# ── Cart ────────────────────────────────────────────────────

class CartOut(BaseModel):
    id:         int
    user_id:    int
    total:      float
    created_at: Optional[Any] = None
    items:      List[CartItemOut] = []

    model_config = ConfigDict(from_attributes=True)

    @field_validator("created_at", mode="before")
    @classmethod
    def sanitize_date(cls, v: Any) -> Any:
        if v == "0000-00-00" or not v:
            return None
        return str(v)


# ── Requêtes ────────────────────────────────────────────────

class AddToCartRequest(BaseModel):
    product_id: int
    quantity:   int = 1


class RemoveFromCartRequest(BaseModel):
    product_id: int
