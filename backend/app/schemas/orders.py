from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.schemas.products import ProductVariantResponse


class OrderItemCreate(BaseModel):
    product_id: str
    variant_id: str
    quantity: int
    unit_price: Decimal


class OrderCreate(BaseModel):
    address_id: str
    items: list[OrderItemCreate]
    total_amount: Decimal
    payment_method: str = "UPI"


class OrderItemResponse(BaseModel):
    id: str
    product_id: str
    variant_id: str
    quantity: int
    unit_price: Decimal

    model_config = ConfigDict(from_attributes=True)


class OrderResponse(BaseModel):
    id: str
    user_id: str
    address_id: str
    total_amount: Decimal
    status: str
    payment_status: str
    shipping_shipment_id: str | None
    shipping_awb: str | None
    shipping_courier: str | None
    shipping_status: str | None
    placed_at: datetime
    updated_at: datetime
    items: list[OrderItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class OrderStatusUpdate(BaseModel):
    status: str
