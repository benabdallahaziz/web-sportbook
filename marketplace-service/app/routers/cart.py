from datetime import date
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models   import Cart, CartItem, Product
from app.schemas  import CartOut, AddToCartRequest, RemoveFromCartRequest, ProductRecommendationOut
from app.services.recommendation_service import get_cart_recommendations

router = APIRouter(prefix="/api/cart", tags=["Panier"])


def _get_or_create_cart(user_id: int, db: Session) -> Cart:
    """Récupère le panier actif de l'utilisateur ou en crée un nouveau."""
    cart = db.query(Cart).filter(Cart.user_id == user_id).first()
    if not cart:
        cart = Cart(user_id=user_id, total=0.0, created_at=date.today())
        db.add(cart)
        db.commit()
        db.refresh(cart)
    elif not cart.created_at:
        cart.created_at = date.today()
        db.commit()
        db.refresh(cart)
    return cart


@router.get("/{user_id}", response_model=CartOut, summary="Voir le panier d'un utilisateur")
def get_cart(user_id: int, db: Session = Depends(get_db)):
    cart = _get_or_create_cart(user_id, db)
    return cart


@router.post("/{user_id}/items", response_model=CartOut,
             summary="Ajouter un produit au panier")
def add_to_cart(user_id: int, payload: AddToCartRequest, db: Session = Depends(get_db)):
    product = db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Produit introuvable.")
    if product.stock < payload.quantity:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail=f"Stock insuffisant (disponible : {product.stock}).")

    cart = _get_or_create_cart(user_id, db)

    # Vérifier si l'article est déjà dans le panier
    existing = next((i for i in cart.items if i.product_id == payload.product_id), None)
    if existing:
        existing.quantity += payload.quantity
    else:
        new_item = CartItem(
            cart_id=cart.id,
            product_id=product.id,
            quantity=payload.quantity,
            unit_price=float(product.price),
        )
        db.add(new_item)
        cart.items.append(new_item)

    # Recalculer le total
    db.flush()
    db.refresh(cart)
    cart.total = sum(float(i.unit_price) * i.quantity for i in cart.items)
    db.commit()
    db.refresh(cart)
    return cart


@router.delete("/{user_id}/items/{product_id}", response_model=CartOut,
               summary="Retirer un produit du panier")
def remove_from_cart(user_id: int, product_id: int, db: Session = Depends(get_db)):
    cart = db.query(Cart).filter(Cart.user_id == user_id).first()
    if not cart:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Panier introuvable.")

    item = next((i for i in cart.items if i.product_id == product_id), None)
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND,
                            detail="Produit absent du panier.")

    db.delete(item)
    db.flush()
    db.refresh(cart)
    cart.total = sum(float(i.unit_price) * i.quantity for i in cart.items)
    db.commit()
    db.refresh(cart)
    return cart


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT,
               summary="Vider le panier")
def clear_cart(user_id: int, db: Session = Depends(get_db)):
    cart = db.query(Cart).filter(Cart.user_id == user_id).first()
    if not cart:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Panier introuvable.")
    for item in list(cart.items):
        db.delete(item)
    cart.total = 0
    db.commit()


@router.get("/{user_id}/recommendations", response_model=List[ProductRecommendationOut],
            summary="Recommandations IA pour compléter le panier (Machine Learning)")
def get_cart_recs(
    user_id: int,
    limit: int = 4,
    db: Session = Depends(get_db)
):
    """
    Suggère des produits complémentaires personnalisés selon les articles actuellement dans le panier.
    """
    return get_cart_recommendations(user_id=user_id, db=db, limit=limit)

