from __future__ import annotations
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict, field_validator


# ── OrderItem ───────────────────────────────────────────────

class OrderItemOut(BaseModel):
    id:         int
    product_id: int
    quantity:   int
    unit_price: float
    subtotal:   float = 0.0

    model_config = ConfigDict(from_attributes=True)


# ── Order ───────────────────────────────────────────────────

class OrderOut(BaseModel):
    id:         int
    user_id:    int
    status:     str
    total:      float
    date:       Optional[Any] = None
    cart_id:    Optional[int] = None
    items:      List[OrderItemOut] = []

    model_config = ConfigDict(from_attributes=True)

    @field_validator("date", mode="before")
    @classmethod
    def sanitize_date(cls, v: Any) -> Any:
        if v == "0000-00-00" or not v:
            return None
        return str(v)


# ── Requête de création ─────────────────────────────────────

class CreateOrderRequest(BaseModel):
    """Crée une commande depuis le panier d'un utilisateur."""
    user_id: int


# ── Statistiques & Analytics Gérant ─────────────────────────

class TopProductStats(BaseModel):
    product_id:          int
    product_name:        str
    total_quantity_sold: int
    total_revenue:       float

    model_config = ConfigDict(from_attributes=True)


class OrdersAnalyticsOut(BaseModel):
    total_revenue:        float
    total_orders:         int
    confirmed_orders:     int
    pending_orders:       int
    cancelled_orders:     int
    average_order_value:  float
    top_selling_products: List[TopProductStats] = []

    model_config = ConfigDict(from_attributes=True)
