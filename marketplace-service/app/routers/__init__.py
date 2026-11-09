from app.routers.products import router as products_router
from app.routers.cart     import router as cart_router
from app.routers.orders   import router as orders_router

__all__ = ["products_router", "cart_router", "orders_router"]
