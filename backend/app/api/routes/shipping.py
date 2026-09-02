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


@router.get("/serviceability")
@router.post("/serviceability")
def check_shipping_serviceability(
    pincode: str = "400001",
    weight: float = 0.5,
    cod: bool = False,
    body: dict = None,
):
    target_pincode = (body.get("delivery_pincode") or body.get("pincode") if body else None) or pincode
    clean_pincode = str(target_pincode).strip()
    return check_serviceability(clean_pincode, weight, cod)


@router.post("/rates")
@router.get("/rates")
def get_shipping_rates(body: ShippingRatesRequest = None, pincode: str = "400001", weight: float = 0.5, cod: bool = False):
    delivery_pincode = body.delivery_pincode if body else pincode
    clean_pincode = delivery_pincode.strip()
    result = check_serviceability(clean_pincode, body.weight if body else weight, body.cod if body else cod)
    return result


@router.post("/manifest")
def generate_shipping_manifest(
    body: dict = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shipment_id = body.get("shipment_id") if body else "MOCK_SHIP_001"
    return {
        "status": 200,
        "manifest_url": f"https://api.shiprocket.in/v1/manifest/{shipment_id}.pdf",
        "message": "Manifest generated successfully"
    }


@router.get("/track/{awb}")
@router.get("/track")
def track_courier_shipment(awb: str = "AWB123456789"):
    from app.services.shiprocket_service import track_shipment
    return track_shipment(awb)


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
