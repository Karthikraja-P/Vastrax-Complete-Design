from app.api.routes.auth import router as auth_router
from app.api.routes.users import router as users_router
from app.api.routes.products import router as products_router
from app.api.routes.categories import router as categories_router
from app.api.routes.orders import router as orders_router
from app.api.routes.payments import router as payments_router
from app.api.routes.tryon import router as tryon_router
from app.api.routes.shipping import router as shipping_router
from app.api.routes.chat import router as chat_router

__all__ = [
    "auth_router",
    "users_router",
    "products_router",
    "categories_router",
    "orders_router",
    "payments_router",
    "tryon_router",
    "shipping_router",
    "chat_router",
]
