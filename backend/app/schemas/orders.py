from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.products import ProductVariantResponse


class OrderItemCreate(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    size: Optional[str] = "M"
    color: Optional[str] = None
    quantity: int = Field(1, ge=1, le=20)
    unit_price: Optional[Decimal] = None
    price: Optional[Decimal] = None

    @property
    def final_unit_price(self) -> Decimal:
        return self.unit_price or self.price or Decimal("0.00")


class OrderCreate(BaseModel):
    address_id: str
    items: list[OrderItemCreate]
    total_amount: Optional[Decimal] = None  # ignored: the server prices the order
    delivery_method: str = "standard"
    payment_method: str = "UPI"
    shipping_courier_id: Optional[int] = None


class OrderItemResponse(BaseModel):
    id: str
    product_id: str
    variant_id: str
    quantity: int
    unit_price: Decimal
    product_name: Optional[str] = None
    image_url: Optional[str] = None
    size: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OrderResponse(BaseModel):
    id: str
    user_id: str
    address_id: str
    total_amount: Decimal
    status: str
    payment_status: str
    payment_method: Optional[str] = None
    shipping_shipment_id: str | None = None
    shipping_awb: str | None = None
    shipping_courier: str | None = None
    shipping_status: str | None = None
    shipping_courier_id: int | None = None
    shipping_charge: Decimal = Decimal("0.00")
    shipping_address: str | None = None
    placed_at: datetime
    updated_at: datetime
    items: list[OrderItemResponse] = []
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    shipping_address: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OrderStatusUpdate(BaseModel):
    status: str
