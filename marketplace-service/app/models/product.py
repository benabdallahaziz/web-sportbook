from sqlalchemy import Column, Integer, BigInteger, String, Text, Float, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class Product(Base):
    __tablename__ = "product"

    id          = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    name        = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    price       = Column(Float, nullable=False)
    stock       = Column(Integer, nullable=False, default=0)
    category_id = Column(BigInteger, ForeignKey("category.id", ondelete="SET NULL"), nullable=True)

    # Relations
    category    = relationship("Category", back_populates="products")
    cart_items  = relationship("CartItem",  back_populates="product", lazy="select")
    order_items = relationship("OrderItem", back_populates="product", lazy="select")

    # ── méthodes métier ──────────────────────────────────────
    def update_stock(self, quantity: int) -> None:
        """Ajuste le stock (+/-)."""
        if self.stock + quantity < 0:
            raise ValueError(f"Stock insuffisant pour '{self.name}'.")
        self.stock += quantity

    def update_price(self, new_price: float) -> None:
        """Met à jour le prix du produit."""
        if new_price < 0:
            raise ValueError("Le prix ne peut pas être négatif.")
        self.price = new_price
