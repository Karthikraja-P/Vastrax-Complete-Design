from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PaymentCreate(BaseModel):
    order_id: str
    amount: Decimal
    payment_method: str = "UPI"


class RefundIn(BaseModel):
    txn_id: str
    amount: Decimal


class PaymentResponse(BaseModel):
    id: str
    order_id: str
    user_id: str
    amount: Decimal
    method: str
    status: str
    phonepe_txn_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
