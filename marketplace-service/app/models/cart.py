from datetime import date
from sqlalchemy import Column, Integer, BigInteger, Float, ForeignKey, Date, func
from sqlalchemy.orm import relationship

from app.database import Base


class Cart(Base):
    __tablename__ = "cart"

    id         = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id    = Column(BigInteger, nullable=False, index=True)
    total      = Column(Float, nullable=False, default=0.0)
    created_at = Column(Date, default=date.today, server_default=func.current_date())

    # Relation vers les items
    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan", lazy="select")

    # ── méthodes métier ──────────────────────────────────────
    def calculate_total(self) -> float:
        """Recalcule et met à jour le total du panier."""
        self.total = float(sum(item.unit_price * item.quantity for item in self.items))
        return self.total

    def add_product(self, product, quantity: int = 1) -> "CartItem":
        """Ajoute un produit ou incrémente sa quantité dans le panier."""
        for item in self.items:
            if item.product_id == product.id:
                item.quantity += quantity
                self.calculate_total()
                return item
        new_item = CartItem(
            cart_id=self.id,
            product_id=product.id,
            quantity=quantity,
            unit_price=float(product.price),
        )
        self.items.append(new_item)
        self.calculate_total()
        return new_item

    def remove_product(self, product_id: int) -> None:
        """Retire un produit du panier."""
        self.items = [i for i in self.items if i.product_id != product_id]
        self.calculate_total()


class CartItem(Base):
    __tablename__ = "cart_item"

    id         = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    cart_id    = Column(BigInteger, ForeignKey("cart.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(BigInteger, ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    quantity   = Column(Integer, nullable=False, default=1)
    unit_price = Column(Float, nullable=False)

    # Relations
    cart    = relationship("Cart", back_populates="items")
    product = relationship("Product", back_populates="cart_items")
