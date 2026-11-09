from sqlalchemy import Column, BigInteger, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Category(Base):
    __tablename__ = "category"

    id          = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    name        = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)

    # Relation vers les produits
    products = relationship("Product", back_populates="category", lazy="select")

    # ── méthodes métier ──────────────────────────────────────
    def add_product(self, product) -> None:
        """Associe un produit à cette catégorie."""
        product.category_id = self.id
        self.products.append(product)
