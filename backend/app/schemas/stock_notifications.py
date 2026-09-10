from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr


class StockNotificationCreate(BaseModel):
    email: EmailStr
    size: Optional[str] = None
    variant_id: Optional[str] = None


class StockNotificationResponse(BaseModel):
    id: str
    product_id: str
    email: str
    size: Optional[str] = None
    is_notified: bool = False
    created_at: datetime
    message: str = "You have been added to the waitlist. We will notify you as soon as this item is back in stock."

    model_config = ConfigDict(from_attributes=True)
