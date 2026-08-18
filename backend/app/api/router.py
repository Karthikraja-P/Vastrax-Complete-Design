"""Top-level API router — assembles all versioned sub-routers."""
from fastapi import APIRouter

from app.api.routes.health import router as health_router
from app.api.routes.auth import router as auth_router
from app.api.routes.users import router as users_router
from app.api.routes.products import router as products_router
from app.api.routes.categories import router as categories_router
from app.api.routes.orders import router as orders_router
from app.api.routes.payments import router as payments_router
from app.api.routes.tryon import router as tryon_router
from app.api.routes.shipping import router as shipping_router
from app.api.routes.chat import router as chat_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.settings import router as settings_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(auth_router, prefix="/api/v1")
api_router.include_router(users_router, prefix="/api/v1")
api_router.include_router(products_router, prefix="/api/v1")
api_router.include_router(categories_router, prefix="/api/v1")
api_router.include_router(orders_router, prefix="/api/v1")
api_router.include_router(payments_router, prefix="/api/v1")
api_router.include_router(tryon_router, prefix="/api/v1")
api_router.include_router(shipping_router, prefix="/api/v1")
api_router.include_router(analytics_router, prefix="/api/v1")
api_router.include_router(settings_router, prefix="/api/v1")
api_router.include_router(chat_router, prefix="/api")

