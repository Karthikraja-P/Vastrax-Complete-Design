from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.database import get_db
from app.middleware.auth import get_current_user
from app.models.order import Order
from app.models.user import User
from app.services.shiprocket_service import (
    cancel_shipment_by_awb,
    check_serviceability,
    create_return_shipment,
    generate_label,
    schedule_pickup,
)

router = APIRouter(prefix="/shipping", tags=["shipping"])


def _authorize_order_access(order: Order | None, current_user: User) -> Order:
    if not order:
        raise NotFoundError("Shipment not found")
    if order.user_id != current_user.id and str(current_user.role).lower() != "admin":
        raise ForbiddenError("Access denied")
    return order


class ShippingRatesRequest(BaseModel):
    delivery_pincode: str
    weight: float = 0.5
    cod: bool = False


class LabelRequest(BaseModel):
    shipment_id: str


class PickupRequest(BaseModel):
    shipment_id: str
    pickup_date: str


class CancelRequest(BaseModel):
    awb_code: str


class ReturnRequest(BaseModel):
    order_id: str
    return_data: dict


@router.post("/rates")
def get_shipping_rates(body: ShippingRatesRequest):
    pincode = body.delivery_pincode.strip()
    if len(pincode) != 6 or not pincode.isdigit():
        raise HTTPException(status_code=400, detail="Invalid Indian pincode. Must be exactly 6 digits.")
    result = check_serviceability(pincode, body.weight, body.cod)
    if result.get("status") != 200:
        raise HTTPException(status_code=400, detail=result.get("message", "Serviceability check failed"))
    return result


@router.post("/label")
def get_shipping_label(
    body: LabelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(Order.shipping_shipment_id == body.shipment_id).first()
    _authorize_order_access(order, current_user)
    result = generate_label(body.shipment_id)
    if result.get("status") != 200:
        raise HTTPException(status_code=400, detail="Failed to generate shipping label")
    return result


@router.post("/pickup")
def book_shipping_pickup(
    body: PickupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(Order.shipping_shipment_id == body.shipment_id).first()
    _authorize_order_access(order, current_user)
    result = schedule_pickup(body.shipment_id, body.pickup_date)
    if result.get("status") != 200:
        raise HTTPException(status_code=400, detail="Failed to schedule courier pickup")
    return result


@router.post("/cancel")
def cancel_shipping_shipment(
    body: CancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(Order.shipping_awb == body.awb_code).first()
    _authorize_order_access(order, current_user)
    result = cancel_shipment_by_awb(body.awb_code)
    if result.get("status") != 200:
        raise HTTPException(status_code=400, detail="Failed to cancel shipment")
    return result


@router.post("/return")
def create_reverse_return(
    body: ReturnRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(Order.id == body.order_id).first()
    _authorize_order_access(order, current_user)
    result = create_return_shipment(body.order_id, body.return_data)
    if result.get("status") != 200:
        raise HTTPException(status_code=400, detail="Failed to create return shipment")
    return result
