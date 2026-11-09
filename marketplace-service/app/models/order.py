from datetime import date
from sqlalchemy import Column, Integer, BigInteger, Float, String, ForeignKey, Date, func
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class OrderStatus(str, enum.Enum):
    PENDING   = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class Order(Base):
    __tablename__ = "orders"

    id      = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, nullable=False, index=True)
    status  = Column(String(30), nullable=False, default=OrderStatus.PENDING.value)
    total   = Column(Float, nullable=False, default=0.0)
    date    = Column(Date, default=date.today, server_default=func.current_date())
    cart_id = Column(BigInteger, ForeignKey("cart.id", ondelete="SET NULL"), nullable=True)

    # Relations
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan", lazy="select")
    cart  = relationship("Cart", lazy="select")

    # ── méthodes métier ──────────────────────────────────────
    def confirm(self) -> None:
        """Confirme la commande (uniquement si elle est en attente)."""
        if self.status != OrderStatus.PENDING.value:
            raise ValueError(f"Impossible de confirmer une commande au statut '{self.status}'.")
        self.status = OrderStatus.CONFIRMED.value

    def cancel(self) -> None:
        """Annule la commande (uniquement si elle n'est pas déjà annulée)."""
        if self.status == OrderStatus.CANCELLED.value:
            raise ValueError("La commande est déjà annulée.")
        self.status = OrderStatus.CANCELLED.value


class OrderItem(Base):
    __tablename__ = "order_item"

    id         = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    order_id   = Column(BigInteger, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(BigInteger, ForeignKey("product.id", ondelete="RESTRICT"), nullable=False)
    quantity   = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)

    # Relations
    order   = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")

    # ── méthodes métier ──────────────────────────────────────
    def calculate_subtotal(self) -> float:
        """Retourne le sous-total de cet item (quantité × prix unitaire)."""
        return float(self.quantity * self.unit_price)
