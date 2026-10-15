from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class PaymentCreate(BaseModel):
    order_id: str
    amount: Decimal = Field(ge=Decimal("1.00"), max_digits=10, decimal_places=2)
    payment_method: str = "UPI"


class RefundIn(BaseModel):
    txn_id: str = Field(min_length=1, max_length=50)
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    return_id: str | None = Field(default=None, max_length=36)


class PaymentVerify(BaseModel):
    txn_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class SimulatePaymentIn(BaseModel):
    txn_id: str
    success: bool = True


class PaymentResponse(BaseModel):
    id: str
    order_id: str
    user_id: str
    amount: Decimal
    method: str
    status: str
    razorpay_order_id: str | None
    razorpay_payment_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
