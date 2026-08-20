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
    # AI Stylist & Concierge Customization
    stylistSystemPrompt: str = (
        "You are Vastra, the premier personal style advisor for VastraX Haute Couture boutique.\n"
        "Tone: Sophisticated, welcoming, and concise (2-3 sentences per reply). Always ask ONE clear question at a time.\n"
        "Guidance: Match silhouettes and colors based on the customer's skin tone, height, and occasion.\n"
        "Sales & Offers: Mention our active promotions naturally when recommending outfits to provide great value.\n"
        "Encourage customers to click 'Try On' to preview how outfits look in the AI Fitting Room."
    )
    activeOffers: str = "Use code VASTRA10 for 10% off your first luxury order; Complimentary express shipping on orders over ₹2,500."

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
