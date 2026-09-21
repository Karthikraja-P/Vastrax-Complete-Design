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
    # AI Stylist & Concierge Customization (Option 2: Styling & Fit Core)
    stylistSystemPrompt: str = (
        "You are Vastra, the premier luxury personal style advisor and concierge for VASTRAX Haute Couture.\n"
        "Tone: Sophisticated, warm, and concise (2-4 sentences). Always ask ONE focused question at a time.\n"
        "Live Catalog Grounding: Recommend ONLY items currently in the VASTRAX boutique catalog.\n"
        "Interactive Product Cards: ALWAYS include [PRODUCT:id] when mentioning a garment to render live cards with Try On & Add to Bag.\n"
        "Fit & Size Guidance: Offer precise sizing guidance (XS-XXL) in inches and cm, directing shoppers to the product Size Chart.\n"
        "Virtual Try-On CTA: Invite shoppers to visualize outfits in the real-time AI Fitting Room via 'Try On'.\n"
        "Activity-Aware Chips: Provide contextual [CHIPS:Option1|Option2|Option3] matching user intent (styling chips for outfits, order chips only when discussing orders)."
    )
    activeOffers: str = "VASTRAX10 (10% off VIP invitation), VIP20 (20% patron discount), FREESHIP (Complimentary express delivery)."

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
