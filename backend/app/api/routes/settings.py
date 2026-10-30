import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.middleware.auth import require_admin
from app.models.store_settings import StoreSettings
from app.models.user import User

router = APIRouter(prefix="/settings", tags=["settings"])

class AppSettingsSchema(BaseModel):
    storeName: str = "VASTRAX Luxury Apparel"
    supportEmail: str = "concierge@vastrax.luxury"
    supportPhone: str = "+1 (800) 827-8729"
    currency: str = "INR (₹)"
    timezone: str = "UTC+05:30 (India Standard Time)"
    announcementText: str = "Complimentary Express Delivery on Orders Over ₹1,999"
    enableGuestCheckout: bool = True
    enableLowStockAlerts: bool = True
    lowStockThreshold: int = 5
    autoArchiveOrders: bool = False
    maintenanceMode: bool = False
    productDisplayBackground: str = "#F5F2ED"
    # AI Stylist & Concierge Customization (Option 2: Styling & Fit Core)
    stylistSystemPrompt: str = (
        "You are Vastra, a friendly, knowledgeable personal stylist for VASTRAX. Speak like a thoughtful human in a relaxed conversation, not a script or sales pitch.\n"
        "Use natural, warm language and answer the shopper's actual question first. Keep replies concise by default, but give enough detail to solve the question. Ask at most one relevant follow-up question, only when it helps, and never repeat a question the shopper already answered.\n"
        "Offer useful general fashion advice even when the shopper has not asked for a specific catalog item. For example, explain that vertical stripes can create a longer visual line, while noting that styling effects vary by garment, proportions, and personal taste. Give practical suggestions about colour pairing, layering, occasions, and coordinating separates when relevant.\n"
        "Never assume a shopper's body shape, complexion, budget, identity, or preferences. Do not make body-shaming comments or promise that an outfit will fit. For sizing, point to the actual product size chart and use inventory data before saying a size is available.\n"
        "When recommending products, use ONLY items in the live VASTRAX catalog and include [PRODUCT:id] for every recommended item so the store can show its product card. Never invent product details, prices, stock, or discounts. Mention promotions only when they appear in the verified active-offers context.\n"
        "Suggest Virtual Try-On as an optional visual preview, never as a fit guarantee. Use quick replies only when they help the next step, in [CHIPS:Option1|Option2|Option3] format; omit them for simple factual answers. Only offer order or shipping actions when the shopper asks about an order. Use only preferences the shopper explicitly shares; never infer complexion or body shape from an image."
    )
    activeOffers: str = ""

    @field_validator("productDisplayBackground")
    @classmethod
    def validate_product_display_background(cls, value: str) -> str:
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", value):
            raise ValueError("Product display background must be a six-digit hex color.")
        return value.upper()

PUBLIC_FIELDS = {"storeName", "supportEmail", "supportPhone", "currency", "timezone", "announcementText", "enableGuestCheckout", "maintenanceMode", "activeOffers", "productDisplayBackground"}


def load_app_settings(db: Session | None) -> AppSettingsSchema:
    if db is None:
        return AppSettingsSchema()
    row = db.get(StoreSettings, "default")
    if row is None:
        return AppSettingsSchema()
    return AppSettingsSchema.model_validate_json(row.settings_json)


def save_app_settings(db: Session, settings: AppSettingsSchema) -> None:
    row = db.get(StoreSettings, "default")
    settings_json = settings.model_dump_json()
    if row is None:
        row = StoreSettings(id="default", settings_json=settings_json)
        db.add(row)
    else:
        row.settings_json = settings_json
    db.commit()


@router.get("/app")
def get_app_settings(db: Session = Depends(get_db)):
    """Public storefront flags only; the stylist prompt stays private."""
    return load_app_settings(db).model_dump(include=PUBLIC_FIELDS)


@router.get("/app/admin")
def get_app_settings_admin(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return load_app_settings(db)

@router.put("/app")
def update_app_settings(
    body: AppSettingsSchema,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update global store configuration (admin only)."""
    save_app_settings(db, body)
    return {"success": True, "settings": body}
