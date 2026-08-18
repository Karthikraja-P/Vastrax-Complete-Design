from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from app.middleware.auth import require_admin
from app.models.user import User

router = APIRouter(prefix="/settings", tags=["settings"])

class AppSettingsSchema(BaseModel):
    storeName: str = "VASTRAX Luxury Apparel"
    supportEmail: str = "concierge@vastrax.luxury"
    supportPhone: str = "+1 (800) 827-8729"
    currency: str = "USD ($)"
    timezone: str = "UTC-05:00 (Eastern Time)"
    announcementText: str = "Complimentary Global Express Delivery on Orders Over $250"
    enableGuestCheckout: bool = True
    enableLowStockAlerts: bool = True
    lowStockThreshold: int = 5
    autoArchiveOrders: bool = False
    maintenanceMode: bool = False

# In-memory store or DB-backed settings
_current_settings = AppSettingsSchema()

@router.get("/app")
def get_app_settings():
    """Retrieve global store and app configuration (public for storefront flags)."""
    return _current_settings

@router.put("/app")
def update_app_settings(
    body: AppSettingsSchema,
    admin: User = Depends(require_admin)
):
    """Update global store configuration (admin only)."""
    global _current_settings
    _current_settings = body
    return {"success": True, "settings": _current_settings}
