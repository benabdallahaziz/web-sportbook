from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


# ── Category ────────────────────────────────────────────────

class CategoryBase(BaseModel):
    name:        str
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name:        Optional[str] = None
    description: Optional[str] = None


class CategoryOut(CategoryBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class CategoryWithProducts(CategoryOut):
    products: List["ProductOut"] = []

    model_config = ConfigDict(from_attributes=True)


# ── Product ─────────────────────────────────────────────────

class ProductBase(BaseModel):
    name:        str
    description: Optional[str] = None
    price:       float
    stock:       int = 0
    category_id: Optional[int] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name:        Optional[str]   = None
    description: Optional[str]   = None
    price:       Optional[float] = None
    stock:       Optional[int]   = None
    category_id: Optional[int]   = None


class ProductOut(ProductBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ── Recommandations Machine Learning ────────────────────────

class ProductRecommendationOut(BaseModel):
    product:          ProductOut
    similarity_score: float
    match_percentage: str

    model_config = ConfigDict(from_attributes=True)


# Résolution des forward references
CategoryWithProducts.model_rebuild()
