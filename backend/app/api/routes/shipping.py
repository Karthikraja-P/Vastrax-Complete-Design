import hmac
import logging

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
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
    generate_manifest,
    schedule_pickup,
    track_shipment,
)

router = APIRouter(prefix="/shipping", tags=["shipping"])
logger = logging.getLogger("vastrax.shipping.webhook")

_SHIPMENT_STATUS_CODES = {
    6: "SHIPPED", 7: "DELIVERED", 8: "CANCELLED", 9: "RTO INITIATED",
    10: "RTO DELIVERED", 12: "LOST", 13: "PICKUP ERROR", 14: "RTO ACKNOWLEDGED",
    15: "PICKUP RESCHEDULED", 16: "CANCELLATION REQUESTED", 17: "OUT FOR DELIVERY",
    18: "IN TRANSIT", 19: "OUT FOR PICKUP", 20: "PICKUP EXCEPTION", 21: "UNDELIVERED",
    22: "DELAYED", 23: "PARTIAL DELIVERED", 24: "DESTROYED", 25: "DAMAGED",
    26: "FULFILLED", 27: "PICKUP BOOKED", 38: "REACHED AT DESTINATION HUB",
    39: "MISROUTED", 40: "RTO NDR", 41: "RTO OUT FOR DELIVERY", 42: "PICKED UP",
    43: "SELF FULFILLED", 44: "DISPOSED OFF", 45: "CANCELLED BEFORE DISPATCHED",
    46: "RTO IN TRANSIT", 47: "QC FAILED", 48: "REACHED WAREHOUSE", 49: "CUSTOMS CLEARED",
    50: "IN FLIGHT", 51: "HANDED OVER TO COURIER", 52: "SHIPMENT BOOKED",
    54: "IN TRANSIT OVERSEAS", 55: "CONNECTION ALIGNED", 56: "REACHED OVERSEAS WAREHOUSE",
    57: "CUSTOMS CLEARED OVERSEAS", 59: "BOX PACKING", 60: "FC ALLOCATED",
    61: "PICKLIST GENERATED", 62: "READY TO PACK", 63: "PACKED", 67: "FC MANIFEST GENERATED",
    68: "PROCESSED AT WAREHOUSE", 71: "HANDOVER EXCEPTION", 72: "PACKED EXCEPTION",
    75: "RTO LOCKED", 76: "UNTRACEABLE", 77: "ISSUE RELATED TO RECIPIENT",
    78: "REACHED BACK AT SELLER CITY",
}

_IN_TRANSIT_STATUSES = {
    "SHIPPED", "PICKED UP", "HANDED OVER TO COURIER", "IN TRANSIT",
    "IN TRANSIT OVERSEAS", "OUT FOR DELIVERY", "DELAYED", "REACHED AT DESTINATION HUB",
    "REACHED WAREHOUSE", "IN FLIGHT", "CONNECTION ALIGNED", "REACHED OVERSEAS WAREHOUSE",
    "CUSTOMS CLEARED", "CUSTOMS CLEARED OVERSEAS", "MISROUTED",
}


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


@router.post("/status-callback")
def receive_courier_status(
    payload: dict,
    x_api_key: str | None = Header(default=None, alias="x-api-key"),
    db: Session = Depends(get_db),
):
    """Receive Shiprocket tracking events; configure its dashboard to send x-api-key."""
    webhook_token = settings.shiprocket_webhook_token.strip()
    if not webhook_token:
        raise HTTPException(status_code=503, detail="Courier status webhook is not configured")
    if not x_api_key or not hmac.compare_digest(x_api_key, webhook_token):
        raise HTTPException(status_code=401, detail="Invalid webhook token")

    awb = str(payload.get("awb") or payload.get("awb_code") or "").strip()
    shipment_id = str(payload.get("shipment_id") or "").strip()
    status_text = str(payload.get("shipment_status") or payload.get("current_status") or "").strip()
    status_id = payload.get("shipment_status_id") or payload.get("current_status_id")
    if not status_text and status_id is not None:
        try:
            status_text = _SHIPMENT_STATUS_CODES.get(int(status_id), "")
        except (TypeError, ValueError):
            status_text = ""
    status_text = " ".join(status_text.upper().replace("_", " ").split())[:100]

    if not (awb or shipment_id) or not status_text:
        raise HTTPException(status_code=400, detail="Webhook must include an AWB or shipment ID and a status")

    order = db.query(Order).filter(Order.shipping_awb == awb).first() if awb else None
    if not order and shipment_id:
        order = db.query(Order).filter(Order.shipping_shipment_id == shipment_id).first()
    if not order:
        # Shiprocket expects a 200 response; log unmatched callbacks for diagnostics.
        logger.warning("Ignoring courier status for an unknown shipment (awb=%s, shipment_id=%s)", awb, shipment_id)
        return {"received": True, "matched": False}

    previous_order_status = (order.status or "").lower()
    if previous_order_status not in {"cancelled", "delivered"}:
        order.shipping_status = status_text
        if status_text == "DELIVERED":
            order.status = "delivered"
        elif status_text in _IN_TRANSIT_STATUSES:
            order.status = "shipped"
    # Preserve the delivered state if an older courier event arrives late.
    elif previous_order_status == "delivered":
        status_text = (order.shipping_status or "DELIVERED").upper()

    if payload.get("courier_name"):
        order.shipping_courier = str(payload["courier_name"])[:100]
    if awb and not order.shipping_awb:
        order.shipping_awb = awb
    if shipment_id and not order.shipping_shipment_id:
        order.shipping_shipment_id = shipment_id

    became_delivered = previous_order_status != "delivered" and order.status == "delivered"
    db.commit()
    if became_delivered:
        try:
            from app.services.erp_posting_service import post_order_cogs, post_order_revenue
            post_order_revenue(db, order)
            post_order_cogs(db, order)
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("Courier delivered event updated order %s, but ERP posting failed", order.id)

    logger.info("Courier status updated order %s to %s", order.id, status_text)
    return {"received": True, "matched": True, "order_id": order.id, "shipping_status": status_text}


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
    shipment_id = str(body.get("shipment_id", "")).strip() if body else ""
    order = db.query(Order).filter(Order.shipping_shipment_id == shipment_id).first()
    _authorize_order_access(order, current_user)
    if not order.shipping_awb:
        raise HTTPException(status_code=409, detail="Assign an AWB before generating the manifest")
    result = generate_manifest(shipment_id)
    if result.get("error") or result.get("status_code") not in (200, 201) or not result.get("manifest_url"):
        raise HTTPException(status_code=502, detail=result.get("error", "Shiprocket manifest generation failed"))
    return result


@router.get("/track/{shipment_ref}")
def track_courier_shipment(
    shipment_ref: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(
        (Order.shipping_awb == shipment_ref) | (Order.shipping_shipment_id == shipment_ref)
    ).first()
    _authorize_order_access(order, current_user)
    if not order.shipping_shipment_id:
        raise HTTPException(status_code=404, detail="Shipment has not been booked")
    result = track_shipment(order.shipping_shipment_id)
    if result.get("error"):
        raise HTTPException(status_code=502, detail=result["error"])
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
    if result.get("error") or result.get("status") != 200:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to generate shipping label"))
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
    if result.get("error") or result.get("status") != 200:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to schedule courier pickup"))
    order.shipping_status = "Pickup scheduled"
    db.commit()
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
    if result.get("error") or result.get("status") != 200:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to create return shipment"))
    return result
