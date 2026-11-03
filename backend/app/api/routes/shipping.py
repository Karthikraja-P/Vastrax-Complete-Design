import hmac
import logging
import re
from typing import Literal
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.database import get_db
from app.middleware.auth import get_current_user, require_admin
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product_variant import ProductVariant
from app.models.product import Product
from app.models.business import StockMovement
from app.models.rto_receipt import RtoReceipt, RtoReceiptLine
from app.models.user import User
from app.models.returns import SalesReturn
from app.services.shiprocket_service import (
    cancel_shipment_by_awb,
    assign_awb,
    check_serviceability,
    generate_label,
    generate_manifest,
    get_ndr_shipments,
    normalize_courier_options,
    schedule_pickup,
    submit_ndr_action,
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


class LabelRequest(BaseModel):
    shipment_id: str


class PickupRequest(BaseModel):
    shipment_id: str
    pickup_date: str


class CancelRequest(BaseModel):
    awb_code: str


class DispatchRequest(BaseModel):
    pickup_date: date
    courier_id: int | None = Field(default=None, ge=1)


@router.get("/admin/orders/{order_id}/couriers")
def available_order_couriers(
    order_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Return live serviceable courier options before an admin dispatches an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise NotFoundError("Order not found")
    if order.payment_status != "paid":
        raise HTTPException(status_code=409, detail="Confirm payment before choosing a courier")
    if order.shipping_awb:
        raise HTTPException(status_code=409, detail="A courier is already assigned to this shipment")
    if not order.address:
        raise HTTPException(status_code=409, detail="Order delivery address is unavailable")

    serviceability = check_serviceability(order.address.pincode, total_weight=0.5)
    if serviceability.get("error"):
        raise HTTPException(status_code=502, detail=serviceability["error"])
    couriers = normalize_courier_options(serviceability)
    if not couriers:
        raise HTTPException(status_code=409, detail="Shiprocket returned no courier options for this destination")
    return {"order_id": order.id, "mock": bool(serviceability.get("mock")), "couriers": couriers}


@router.post("/admin/orders/{order_id}/dispatch")
def dispatch_order(
    order_id: str,
    body: DispatchRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Assign an AWB, schedule collection, and create the Shiprocket manifest."""
    order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
    if body.pickup_date < date.today():
        raise HTTPException(status_code=422, detail="Pickup date cannot be in the past")
    if not order:
        raise NotFoundError("Order not found")
    if order.status in {"cancelled", "delivered", "returned"}:
        raise HTTPException(status_code=409, detail="This order cannot be dispatched")

    if order.payment_status != "paid":
        raise HTTPException(status_code=409, detail="Confirm payment before dispatching this order")

    if not order.shipping_awb:
        if body.courier_id is None:
            raise HTTPException(status_code=422, detail="Choose an available courier before assigning the AWB")
        if not order.address:
            raise HTTPException(status_code=409, detail="Order delivery address is unavailable")
        serviceability = check_serviceability(order.address.pincode, total_weight=0.5)
        available_couriers = normalize_courier_options(serviceability)
        if serviceability.get("error"):
            raise HTTPException(status_code=502, detail=serviceability["error"])
        if not any(option["courier_id"] == body.courier_id for option in available_couriers):
            raise HTTPException(status_code=409, detail="That courier is no longer available. Refresh options and choose again.")

    if not order.shipping_shipment_id:
        from app.services.order_service import _book_shiprocket
        user = db.query(User).filter(User.id == order.user_id).first()
        address = order.address
        if not user or not address:
            raise HTTPException(status_code=409, detail="Order customer or delivery address is unavailable")
        _book_shiprocket(order, user, address)
        db.commit()
        if not order.shipping_shipment_id:
            raise HTTPException(status_code=502, detail="Shiprocket did not create a shipment. Check its credentials and retry.")

    if not order.shipping_awb:
        awb_result = assign_awb(str(order.shipping_shipment_id), body.courier_id)
        if awb_result.get("error") or awb_result.get("status") not in (200, 201) or not awb_result.get("awb_code"):
            raise HTTPException(status_code=502, detail=awb_result.get("error", "Shiprocket could not assign a courier/AWB"))
        order.shipping_awb = str(awb_result["awb_code"])
        order.shipping_courier = str(awb_result.get("courier_name") or order.shipping_courier or "Shiprocket courier")
        order.shipping_courier_id = body.courier_id or awb_result.get("courier_company_id") or order.shipping_courier_id
        order.shipping_status = "AWB assigned"
        db.commit()

    normalized_shipping_status = (order.shipping_status or "").strip().casefold()
    pickup_requested = normalized_shipping_status in {"pickup scheduled", "manifest generated", "shipped", "delivered"}
    if not pickup_requested:
        pickup_result = schedule_pickup(str(order.shipping_shipment_id), body.pickup_date.isoformat())
        if pickup_result.get("error") or pickup_result.get("status") != 200:
            raise HTTPException(status_code=502, detail=pickup_result.get("error", "AWB assigned, but Shiprocket could not schedule pickup"))
        order.shipping_status = "Pickup scheduled"
        db.commit()

    manifest_result = generate_manifest(str(order.shipping_shipment_id))
    manifest_url = manifest_result.get("manifest_url") or manifest_result.get("data", {}).get("manifest_url")
    if manifest_result.get("error") or manifest_result.get("status_code") not in (200, 201) or not manifest_url:
        raise HTTPException(status_code=502, detail=manifest_result.get("error", "Pickup is scheduled, but Shiprocket did not return a manifest"))

    order.shipping_status = "Manifest generated"
    db.commit()
    return {
        "order_id": order.id,
        "shipment_id": order.shipping_shipment_id,
        "awb_code": order.shipping_awb,
        "courier_name": order.shipping_courier,
        "shipping_status": order.shipping_status,
        "manifest_url": manifest_url,
    }


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
    return_case = db.query(SalesReturn).filter(SalesReturn.reverse_awb == awb).first() if awb else None
    if not return_case and shipment_id:
        return_case = db.query(SalesReturn).filter(SalesReturn.reverse_shipment_id == shipment_id).first()
    if not status_text and status_id is not None:
        try:
            reverse_codes = {
                21: "RETURN PENDING", 22: "RETURN INITIATED", 23: "RETURN PICKUP QUEUED",
                24: "RETURN PICKUP ERROR", 25: "RETURN IN TRANSIT", 26: "RETURN DELIVERED",
                27: "RETURN CANCELLED", 28: "RETURN PICKUP GENERATED", 29: "RETURN CANCELLATION REQUESTED",
                30: "RETURN PICKUP CANCELLED", 31: "RETURN PICKUP RESCHEDULED", 32: "RETURN PICKED UP", 33: "RETURN LOST",
                34: "OUT FOR PICKUP", 35: "PICKUP EXCEPTION", 36: "RETURN UNDELIVERED",
                37: "RETURN DELIVERY DELAYED", 47: "RETURN OUT FOR PICKUP",
                48: "RETURN OUT FOR DELIVERY", 49: "RETURN PICKUP EXCEPTION", 50: "RETURN UNDELIVERED",
            }
            status_text = reverse_codes.get(int(status_id), "") if return_case else _SHIPMENT_STATUS_CODES.get(int(status_id), "")
        except (TypeError, ValueError):
            status_text = ""
    status_text = " ".join(status_text.upper().replace("_", " ").split())[:100]
    if return_case and status_text == "DELIVERED":
        status_text = "RETURN DELIVERED"

    if not (awb or shipment_id) or not status_text:
        raise HTTPException(status_code=400, detail="Webhook must include an AWB or shipment ID and a status")

    if return_case:
        terminal_return_statuses = {"RETURN DELIVERED", "RETURN CANCELLED", "RETURN LOST"}
        previous_return_status = (return_case.reverse_status or "").upper()
        if previous_return_status not in terminal_return_statuses or status_text == "RETURN DELIVERED":
            return_case.reverse_status = status_text
        if awb and not return_case.reverse_awb:
            return_case.reverse_awb = awb
        if shipment_id and not return_case.reverse_shipment_id:
            return_case.reverse_shipment_id = shipment_id
        if payload.get("courier_name"):
            return_case.reverse_courier = str(payload["courier_name"])[:100]
        db.commit()
        logger.info("Courier return status updated request %s to %s", return_case.id, return_case.reverse_status)
        return {"received": True, "matched": True, "return_id": return_case.id,
                "reverse_status": return_case.reverse_status}

    order = db.query(Order).filter(Order.shipping_awb == awb).first() if awb else None
    if not order and shipment_id:
        order = db.query(Order).filter(Order.shipping_shipment_id == shipment_id).first()
    if not order:
        # Shiprocket expects a 200 response; log unmatched callbacks for diagnostics.
        logger.warning("Ignoring courier status for an unknown shipment (awb=%s, shipment_id=%s)", awb, shipment_id)
        return {"received": True, "matched": False}

    previous_order_status = (order.status or "").lower()
    incoming_status = status_text
    notification_status = None
    rto_statuses = {
        "RTO INITIATED", "RTO IN TRANSIT", "RTO OUT FOR DELIVERY", "RTO OFD",
        "RTO NDR", "RTO LOCKED", "RTO DELIVERED", "RTO ACKNOWLEDGED", "RTO RECEIVED",
    }
    is_rto_status = incoming_status in rto_statuses
    if previous_order_status not in {"cancelled", "delivered", "returned"} or (is_rto_status and order.shipping_status != "RTO RECEIVED"):
        order.shipping_status = incoming_status
        if incoming_status == "DELIVERED":
            order.status = "delivered"
            notification_status = "delivered"
            if not order.delivered_at:
                order.delivered_at = datetime.now(timezone.utc)
        elif incoming_status == "OUT FOR DELIVERY":
            notification_status = "out_for_delivery"
            if order.status not in {"delivered", "returned", "cancelled"}:
                order.status = "shipped"
        elif incoming_status in {"RTO DELIVERED", "RTO ACKNOWLEDGED", "RTO RECEIVED"}:
            order.status = "returned"
        elif incoming_status == "PACKED":
            order.status = "packed"
            notification_status = "packed"
        elif incoming_status in _IN_TRANSIT_STATUSES:
            order.status = "shipped"
            notification_status = "shipped"
    # Preserve completed order states when an older forward-shipment event arrives late.
    elif previous_order_status in {"delivered", "returned"}:
        status_text = (order.shipping_status or "DELIVERED").upper()
        if previous_order_status == "delivered" and incoming_status == "DELIVERED":
            notification_status = "delivered"

    if incoming_status in {"RTO DELIVERED", "RTO ACKNOWLEDGED"}:
        _ensure_rto_receipt(db, order)

    if payload.get("courier_name"):
        order.shipping_courier = str(payload["courier_name"])[:100]
    if awb and not order.shipping_awb:
        order.shipping_awb = awb
    if shipment_id and not order.shipping_shipment_id:
        order.shipping_shipment_id = shipment_id

    became_delivered = previous_order_status != "delivered" and order.status == "delivered"
    db.commit()
    if notification_status:
        try:
            from app.services.order_status_notification_service import send_order_status_notification
            send_order_status_notification(db, order, notification_status)
        except Exception:
            logger.exception("Could not send customer status email for order %s", order.id)
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



class NdrActionRequest(BaseModel):
    action: Literal["re-attempt", "return"]
    comments: str = Field(min_length=3, max_length=500)
    phone: str | None = None
    deferred_date: date | None = None


class RtoReceiptLineInput(BaseModel):
    order_item_id: str
    quantity_received: int = Field(ge=0, le=100000)
    quantity_restocked: int = Field(ge=0, le=100000)


class RtoReceiptRequest(BaseModel):
    notes: str | None = Field(default=None, max_length=1000)
    items: list[RtoReceiptLineInput] = Field(min_length=1, max_length=100)


def _ensure_rto_receipt(db: Session, order: Order) -> RtoReceipt:
    receipt = db.query(RtoReceipt).filter(RtoReceipt.order_id == order.id).with_for_update().first()
    if receipt:
        return receipt
    receipt = RtoReceipt(order_id=order.id, status="awaiting_receipt")
    db.add(receipt)
    db.flush()
    for item in db.query(OrderItem).filter(OrderItem.order_id == order.id).all():
        db.add(RtoReceiptLine(
            receipt_id=receipt.id, order_item_id=item.id, product_id=item.product_id,
            variant_id=item.variant_id, quantity_expected=item.quantity,
        ))
    db.flush()
    return receipt


def _serialize_rto_receipt(db: Session, receipt: RtoReceipt) -> dict:
    order = db.get(Order, receipt.order_id)
    rows = db.query(RtoReceiptLine, OrderItem, Product.name, ProductVariant.size).join(
        OrderItem, OrderItem.id == RtoReceiptLine.order_item_id
    ).join(Product, Product.id == RtoReceiptLine.product_id).join(
        ProductVariant, ProductVariant.id == RtoReceiptLine.variant_id
    ).filter(RtoReceiptLine.receipt_id == receipt.id).all()
    return {
        "id": receipt.id, "order_id": receipt.order_id, "status": receipt.status,
        "notes": receipt.notes, "received_at": receipt.received_at,
        "shipping_status": order.shipping_status if order else None,
        "awb": order.shipping_awb if order else None,
        "courier": order.shipping_courier if order else None,
        "items": [{
            "order_item_id": line.order_item_id, "product_name": name, "size": size,
            "quantity_expected": line.quantity_expected, "quantity_received": line.quantity_received,
            "quantity_restocked": line.quantity_restocked,
        } for line, _, name, size in rows],
    }


@router.get("/admin/ndr")
def list_shiprocket_ndr(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    result = get_ndr_shipments(page=1, per_page=100)
    if result.get("error") or result.get("status") != 200:
        raise HTTPException(502, result.get("error", "Shiprocket NDR cases are unavailable"))
    provider_rows = result.get("data") or []
    awbs = {
        str(row.get("awb") or row.get("awb_code") or row.get("awb_number") or "").strip()
        for row in provider_rows if isinstance(row, dict)
    }
    awbs.discard("")
    order_by_awb = {
        order.shipping_awb: order for order in db.query(Order).filter(Order.shipping_awb.in_(awbs)).all()
    } if awbs else {}
    result_rows = []
    for row in provider_rows:
        if not isinstance(row, dict):
            continue
        awb = str(row.get("awb") or row.get("awb_code") or row.get("awb_number") or "").strip()
        order = order_by_awb.get(awb)
        result_rows.append({
            "awb": awb, "order_id": order.id if order else None,
            "order_status": order.status if order else None,
            "shipping_status": order.shipping_status if order else None,
            "customer_name": row.get("customer_name") or row.get("name"),
            "ndr_reason": row.get("ndr_reason") or row.get("reason") or row.get("ndr_reason_text"),
            "ndr_attempt": row.get("ndr_attempt") or row.get("attempt_count"),
            "ndr_raised_at": row.get("ndr_raised_at") or row.get("created_at"),
            "courier": row.get("courier") or row.get("courier_name"),
            "raw_status": row.get("status") or row.get("current_status"),
        })
    return {"items": result_rows, "count": len(result_rows), "unmatched_count": sum(1 for row in result_rows if not row["order_id"])}


@router.post("/admin/orders/{order_id}/ndr-action")
def act_on_shiprocket_ndr(
    order_id: str,
    body: NdrActionRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
    if not order or not order.shipping_awb:
        raise NotFoundError("A Shiprocket AWB is required for an NDR action")
    if body.phone and not re.fullmatch(r"\+?\d{10,13}", body.phone.strip()):
        raise HTTPException(422, "Enter a valid customer phone number")
    if body.deferred_date and body.deferred_date < date.today():
        raise HTTPException(422, "A reattempt date cannot be in the past")
    live_ndr = get_ndr_shipments(page=1, per_page=100, search=order.shipping_awb)
    if live_ndr.get("error") or live_ndr.get("status") != 200:
        raise HTTPException(502, live_ndr.get("error", "Could not verify the current Shiprocket NDR state"))
    found = any(
        isinstance(row, dict) and str(row.get("awb") or row.get("awb_code") or row.get("awb_number") or "").strip() == order.shipping_awb
        for row in (live_ndr.get("data") or [])
    )
    if not found:
        raise HTTPException(409, "Shiprocket no longer lists this shipment as an actionable NDR case; refresh the order status")
    result = submit_ndr_action(
        order.shipping_awb, body.action, body.comments,
        phone=body.phone.strip() if body.phone else None,
        deferred_date=body.deferred_date.isoformat() if body.deferred_date else None,
    )
    if result.get("error") or result.get("status") not in (200, 201):
        raise HTTPException(502, result.get("error", "Shiprocket did not accept the NDR action"))
    order.shipping_status = "NDR REATTEMPT REQUESTED" if body.action == "re-attempt" else "NDR RETURN REQUESTED"
    db.commit()
    return {"order_id": order.id, "awb": order.shipping_awb, "action": body.action,
            "shipping_status": order.shipping_status, "provider": result.get("data") or {}}


@router.get("/admin/rto-receipts")
def list_rto_receipts(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    receipts = db.query(RtoReceipt).order_by(RtoReceipt.created_at.desc()).limit(200).all()
    return [_serialize_rto_receipt(db, receipt) for receipt in receipts]


@router.post("/admin/rto-receipts/{receipt_id}/receive")
def receive_rto_parcel(
    receipt_id: str,
    body: RtoReceiptRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    receipt = db.query(RtoReceipt).filter(RtoReceipt.id == receipt_id).with_for_update().first()
    if not receipt:
        raise NotFoundError("RTO receipt case not found")
    if receipt.status == "received":
        raise HTTPException(409, "This RTO parcel has already been received and reconciled")
    order = db.query(Order).filter(Order.id == receipt.order_id).with_for_update().first()
    if not order or not any(tag in (order.shipping_status or "").upper() for tag in ("RTO DELIVERED", "RTO ACKNOWLEDGED")):
        raise HTTPException(409, "Wait until Shiprocket confirms the RTO parcel was delivered to the seller")
    input_ids = [line.order_item_id for line in body.items]
    if len(input_ids) != len(set(input_ids)):
        raise HTTPException(422, "Each order item can be entered only once")
    lines = {
        line.order_item_id: line for line in db.query(RtoReceiptLine).filter(
            RtoReceiptLine.receipt_id == receipt.id
        ).with_for_update().all()
    }
    if set(input_ids) != set(lines):
        raise HTTPException(422, "Enter received and restock quantities for every item in the returned parcel")
    for item_input in body.items:
        line = lines[item_input.order_item_id]
        if item_input.quantity_received > line.quantity_expected:
            raise HTTPException(422, "Received quantity cannot exceed the quantity originally shipped")
        if item_input.quantity_restocked > item_input.quantity_received:
            raise HTTPException(422, "Restock quantity cannot exceed the quantity received")
        variant = db.query(ProductVariant).filter(ProductVariant.id == line.variant_id).with_for_update().first()
        if not variant:
            raise HTTPException(409, "A returned product size no longer exists")
        if item_input.quantity_restocked:
            before = int(variant.stock_qty or 0)
            variant.stock_qty = before + item_input.quantity_restocked
            db.add(StockMovement(
                product_id=line.product_id, variant_id=line.variant_id,
                quantity_delta=item_input.quantity_restocked, stock_before=before,
                stock_after=variant.stock_qty, reason="rto_return",
                reference_id=receipt.id, notes=f"Received back from Shiprocket RTO for order {order.id}",
                created_by=admin.id,
            ))
        line.quantity_received = item_input.quantity_received
        line.quantity_restocked = item_input.quantity_restocked
    receipt.status = "received"
    receipt.notes = body.notes
    receipt.received_at = datetime.now(timezone.utc)
    receipt.received_by = admin.id
    order.shipping_status = "RTO RECEIVED"
    db.commit()
    return _serialize_rto_receipt(db, receipt)


@router.get("/serviceability")
@router.post("/serviceability")
def check_shipping_serviceability(
    pincode: str = "400001",
    weight: float = 0.5,
    body: dict = None,
):
    target_pincode = (body.get("delivery_pincode") or body.get("pincode") if body else None) or pincode
    clean_pincode = str(target_pincode).strip()
    return check_serviceability(clean_pincode, weight)


@router.post("/rates")
@router.get("/rates")
def get_shipping_rates(body: ShippingRatesRequest = None, pincode: str = "400001", weight: float = 0.5):
    delivery_pincode = body.delivery_pincode if body else pincode
    clean_pincode = delivery_pincode.strip()
    result = check_serviceability(clean_pincode, body.weight if body else weight)
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
