from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models   import Category, Product
from app.schemas  import (
    CategoryCreate, CategoryUpdate, CategoryOut, CategoryWithProducts,
    ProductCreate,  ProductUpdate,  ProductOut, ProductRecommendationOut,
)
from app.services.recommendation_service import get_product_recommendations

router = APIRouter(prefix="/api/products", tags=["Produits & Catégories"])


# ════════════════════════════════════════════════════════════
#  CATEGORIES
# ════════════════════════════════════════════════════════════

@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED,
             summary="Créer une catégorie")
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    if db.query(Category).filter(Category.name == payload.name).first():
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Catégorie déjà existante.")
    cat = Category(**payload.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.get("/categories", response_model=List[CategoryOut], summary="Lister les catégories")
def list_categories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Category).offset(skip).limit(limit).all()


@router.get("/categories/{category_id}", response_model=CategoryWithProducts,
            summary="Détail d'une catégorie (avec ses produits)")
def get_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.get(Category, category_id)
    if not cat:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Catégorie introuvable.")
    return cat


@router.put("/categories/{category_id}", response_model=CategoryOut, summary="Modifier une catégorie")
def update_category(category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db)):
    cat = db.get(Category, category_id)
    if not cat:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Catégorie introuvable.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cat, field, value)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT,
               summary="Supprimer une catégorie")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.get(Category, category_id)
    if not cat:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Catégorie introuvable.")
    db.delete(cat)
    db.commit()


# ════════════════════════════════════════════════════════════
#  PRODUCTS
# ════════════════════════════════════════════════════════════

@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED,
             summary="Créer un produit")
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    if payload.category_id and not db.get(Category, payload.category_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Catégorie introuvable.")
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("", response_model=List[ProductOut], summary="Lister les produits")
def list_products(
    skip: int = 0,
    limit: int = 100,
    category_id: int = None,
    db: Session = Depends(get_db),
):
    q = db.query(Product)
    if category_id:
        q = q.filter(Product.category_id == category_id)
    return q.offset(skip).limit(limit).all()


@router.get("/{product_id}", response_model=ProductOut, summary="Détail d'un produit")
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Produit introuvable.")
    return product


@router.put("/{product_id}", response_model=ProductOut, summary="Modifier un produit")
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Produit introuvable.")
    data = payload.model_dump(exclude_unset=True)
    if "price" in data:
        product.update_price(data.pop("price"))
    if "stock" in data:
        delta = data.pop("stock") - product.stock
        product.update_stock(delta)
    for field, value in data.items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT,
               summary="Supprimer un produit")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Produit introuvable.")
    try:
        db.delete(product)
        db.commit()
    except IntegrityError:
        # order_item.product_id est en RESTRICT : on garde l'historique des commandes
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Impossible de supprimer ce produit : il figure dans des commandes existantes.",
        )


# ════════════════════════════════════════════════════════════
#  RECOMMENDATIONS (MACHINE LEARNING)
# ════════════════════════════════════════════════════════════

@router.get("/{product_id}/recommendations", response_model=List[ProductRecommendationOut],
            summary="Recommandations IA pour un produit (Machine Learning)")
def get_recommendations(
    product_id: int,
    limit: int = 4,
    db: Session = Depends(get_db)
):
    """
    Retourne les produits les plus similaires et complémentaires en utilisant
    un modèle de Machine Learning basé sur la similarité cosinus textuelle (TF-IDF).
    """
    return get_product_recommendations(product_id=product_id, db=db, limit=limit)

