from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models   import Cart, Order, OrderItem, Product
from app.models.order import OrderStatus
from app.schemas  import OrderOut, CreateOrderRequest, OrdersAnalyticsOut, TopProductStats
from app.services.identity_client import verify_user_exists

router = APIRouter(prefix="/api/orders", tags=["Commandes"])


def _build_order_out(order: Order) -> OrderOut:
    """Convertit un Order ORM en schéma de sortie avec les sous-totaux."""
    items_out = []
    for item in order.items:
        items_out.append({
            "id":         item.id,
            "product_id": item.product_id,
            "quantity":   item.quantity,
            "unit_price": float(item.unit_price),
            "subtotal":   item.calculate_subtotal(),
        })
    return OrderOut(
        id=order.id,
        user_id=order.user_id,
        status=order.status,
        total=float(order.total),
        date=order.date,
        cart_id=order.cart_id,
        items=items_out,
    )


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED,
             summary="Créer une commande depuis le panier")
def create_order(payload: CreateOrderRequest, db: Session = Depends(get_db)):
    # ── Séance 7 : Communication synchrone inter-microservices ──
    user_check = verify_user_exists(payload.user_id)
    if not user_check.get("valid", True):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail=f"Utilisateur {payload.user_id} introuvable dans le service Identity."
        )

    cart = db.query(Cart).filter(Cart.user_id == payload.user_id).first()
    if not cart or not cart.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Le panier est vide ou introuvable.")

    # Vérifier le stock pour chaque article
    for item in cart.items:
        product = db.get(Product, item.product_id)
        if not product:
            raise HTTPException(status.HTTP_404_NOT_FOUND,
                                detail=f"Produit {item.product_id} introuvable.")
        if product.stock < item.quantity:
            raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                detail=f"Stock insuffisant pour '{product.name}'.")

    # Créer la commande
    order = Order(
        user_id=payload.user_id,
        status=OrderStatus.PENDING.value,
        total=float(cart.total),
        cart_id=cart.id,
    )
    db.add(order)
    db.flush()  # pour obtenir l'id

    # Créer les OrderItems et décrémenter le stock
    for item in cart.items:
        product = db.get(Product, item.product_id)
        order_item = OrderItem(
            order_id=order.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=float(item.unit_price),
        )
        db.add(order_item)
        product.update_stock(-item.quantity)  # décrémenter le stock

    # Vider le panier
    for item in list(cart.items):
        db.delete(item)
    cart.total = 0.0

    db.commit()
    db.refresh(order)
    return _build_order_out(order)


@router.get("", response_model=List[OrderOut], summary="Lister les commandes")
def list_orders(user_id: int = None, skip: int = 0, limit: int = 100,
                db: Session = Depends(get_db)):
    q = db.query(Order)
    if user_id:
        q = q.filter(Order.user_id == user_id)
    orders = q.order_by(Order.date.desc()).offset(skip).limit(limit).all()
    return [_build_order_out(o) for o in orders]


@router.get("/analytics", response_model=OrdersAnalyticsOut,
            summary="Statistiques & Revenus pour le Gérant (Sujet SportBook)")
def get_orders_analytics(db: Session = Depends(get_db)):
    """
    Fournit un tableau de bord des revenus et ventes pour le Gérant de la plateforme :
    - Chiffre d'affaires total généré (commandes confirmées)
    - Répartition des commandes (confirmées, en attente, annulées)
    - Panier moyen d'une commande
    - Top des articles les plus vendus
    """
    all_orders = db.query(Order).all()
    total_orders = len(all_orders)

    confirmed_orders = [o for o in all_orders if o.status == OrderStatus.CONFIRMED.value]
    pending_orders   = [o for o in all_orders if o.status == OrderStatus.PENDING.value]
    cancelled_orders = [o for o in all_orders if o.status == OrderStatus.CANCELLED.value]

    total_revenue = float(sum(float(o.total) for o in confirmed_orders))
    average_order_value = round(total_revenue / len(confirmed_orders), 2) if confirmed_orders else 0.0

    # Top produits vendus
    product_sales = {}
    for o in confirmed_orders:
        for item in o.items:
            pid = item.product_id
            pname = item.product.name if item.product else f"Produit #{pid}"
            if pid not in product_sales:
                product_sales[pid] = {
                    "product_id": pid,
                    "product_name": pname,
                    "total_quantity_sold": 0,
                    "total_revenue": 0.0,
                }
            product_sales[pid]["total_quantity_sold"] += item.quantity
            product_sales[pid]["total_revenue"] += float(item.unit_price) * item.quantity

    top_products = sorted(
        product_sales.values(),
        key=lambda x: x["total_quantity_sold"],
        reverse=True
    )[:5]

    return OrdersAnalyticsOut(
        total_revenue=round(total_revenue, 2),
        total_orders=total_orders,
        confirmed_orders=len(confirmed_orders),
        pending_orders=len(pending_orders),
        cancelled_orders=len(cancelled_orders),
        average_order_value=average_order_value,
        top_selling_products=[TopProductStats(**p) for p in top_products],
    )


@router.get("/{order_id}", response_model=OrderOut, summary="Détail d'une commande")
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Commande introuvable.")
    return _build_order_out(order)


@router.put("/{order_id}/confirm", response_model=OrderOut, summary="Confirmer une commande")
def confirm_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Commande introuvable.")
    try:
        order.confirm()
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))
    db.commit()
    db.refresh(order)
    return _build_order_out(order)


@router.put("/{order_id}/cancel", response_model=OrderOut, summary="Annuler une commande")
def cancel_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Commande introuvable.")
    try:
        order.cancel()
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Restituer le stock
    for item in order.items:
        product = db.get(Product, item.product_id)
        if product:
            product.update_stock(item.quantity)

    db.commit()
    db.refresh(order)
    return _build_order_out(order)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT,
               summary="Supprimer une commande (admin)")
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Commande introuvable.")
    if order.status == OrderStatus.CONFIRMED.value:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Impossible de supprimer une commande confirmée.")
    db.delete(order)
    db.commit()
