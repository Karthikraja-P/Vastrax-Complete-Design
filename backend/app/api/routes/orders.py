import re
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.middleware.auth import get_current_user, require_admin
from app.models.user import User
from app.models.order import Order
from app.models.returns import SalesReturn, SalesReturnLine
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.services.shiprocket_service import track_shipment
from app.schemas.orders import OrderCreate, OrderStatusUpdate
from app.services.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", status_code=status.HTTP_201_CREATED)
def place_order(
    body: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return OrderService(db).place_order(current_user, body)


@router.get("")
@router.get("/my")
@router.get("/my-orders")
@router.get("/me")
def my_orders(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return OrderService(db).list_user_orders(current_user)


class CustomerReturnLine(BaseModel):
    order_item_id: str
    quantity: int = Field(gt=0, le=20)


class CustomerReturnRequest(BaseModel):
    reason: Literal["size", "damaged", "wrong_item", "quality", "other"]
    notes: str | None = Field(default=None, max_length=2000)
    items: list[CustomerReturnLine] = Field(min_length=1, max_length=20)


def _customer_return_payload(db: Session, case: SalesReturn) -> dict:
    lines = db.query(SalesReturnLine, Product.name, ProductVariant.size).join(
        Product, Product.id == SalesReturnLine.product_id
    ).join(ProductVariant, ProductVariant.id == SalesReturnLine.variant_id).filter(
        SalesReturnLine.return_id == case.id
    ).all()
    return {
        "id": case.id,
        "order_id": case.order_id,
        "status": case.status,
        "reason": case.reason,
        "request_source": case.request_source,
        "notes": case.notes,
        "requested_at": case.requested_at,
        "reverse_awb": case.reverse_awb,
        "reverse_courier": case.reverse_courier,
        "reverse_status": case.reverse_status,
        "reverse_pickup_date": case.reverse_pickup_date,
        "items": [{
            "order_item_id": line.order_item_id,
            "product_name": name,
            "size": size,
            "quantity_requested": line.quantity_requested,
        } for line, name, size in lines],
    }


@router.get("/my/returns")
def my_return_requests(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cases = db.query(SalesReturn).join(Order, Order.id == SalesReturn.order_id).filter(
        Order.user_id == current_user.id
    ).order_by(SalesReturn.requested_at.desc()).all()
    return [_customer_return_payload(db, case) for case in cases]


@router.post("/my/{order_id}/returns", status_code=status.HTTP_201_CREATED)
def request_order_return(
    order_id: str,
    body: CustomerReturnRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status != "delivered":
        raise HTTPException(409, "A return can only be requested after delivery")
    delivered_at = order.delivered_at or order.updated_at
    if delivered_at.tzinfo is None:
        delivered_at = delivered_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - delivered_at > timedelta(days=7):
        raise HTTPException(409, "Return requests must be submitted within 7 days of delivery")
    customer_phone = re.sub(r"\D", "", current_user.phone_number or "")
    if customer_phone.startswith("91") and len(customer_phone) == 12:
        customer_phone = customer_phone[2:]
    if len(customer_phone) != 10:
        raise HTTPException(409, "Add a valid 10-digit mobile number to your account before requesting a return pickup")
    item_ids = [line.order_item_id for line in body.items]
    if len(item_ids) != len(set(item_ids)):
        raise HTTPException(422, "Each product in a return request can appear only once")
    source_items = {
        item.id: item for item in db.query(OrderItem).filter(
            OrderItem.order_id == order.id, OrderItem.id.in_(item_ids)
        ).all()
    }
    if len(source_items) != len(item_ids):
        raise HTTPException(404, "One or more selected products do not belong to this order")
    existing = db.query(SalesReturnLine.order_item_id, func.sum(SalesReturnLine.quantity_requested)).join(
        SalesReturn, SalesReturn.id == SalesReturnLine.return_id
    ).filter(
        SalesReturn.order_id == order.id,
        SalesReturn.status != "rejected",
        SalesReturnLine.order_item_id.in_(item_ids),
    ).group_by(SalesReturnLine.order_item_id).all()
    already_requested = {item_id: int(quantity or 0) for item_id, quantity in existing}
    for line in body.items:
        if line.quantity + already_requested.get(line.order_item_id, 0) > source_items[line.order_item_id].quantity:
            raise HTTPException(409, "Return quantity exceeds the quantity remaining for this product")

    case = SalesReturn(order_id=order.id, reason=body.reason, notes=body.notes, request_source="customer", created_by=current_user.id)
    db.add(case)
    db.flush()
    for line in body.items:
        source = source_items[line.order_item_id]
        db.add(SalesReturnLine(
            return_id=case.id,
            order_item_id=source.id,
            product_id=source.product_id,
            variant_id=source.variant_id,
            quantity_requested=line.quantity,
            unit_price=source.unit_price,
        ))
    db.commit()
    db.refresh(case)
    return _customer_return_payload(db, case)


@router.get("/my/returns/{return_id}/tracking")
def my_return_tracking(
    return_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case = db.query(SalesReturn).join(Order, Order.id == SalesReturn.order_id).filter(
        SalesReturn.id == return_id, Order.user_id == current_user.id
    ).first()
    if not case:
        raise HTTPException(404, "Return request not found")
    if not case.reverse_shipment_id:
        raise HTTPException(409, "Shiprocket pickup has not been booked yet")
    return {"reverse_status": case.reverse_status, "reverse_awb": case.reverse_awb,
            "reverse_courier": case.reverse_courier, "tracking": track_shipment(case.reverse_shipment_id)}


@router.get("/my/{order_id}")
def my_order_detail(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return OrderService(db).get_order_detail(order_id, current_user)


@router.put("/my/{order_id}/cancel")
def cancel_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return OrderService(db).cancel_order(order_id, current_user)


@router.get("/admin")
def admin_all_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return OrderService(db).list_all_orders(status_filter)


@router.put("/admin/{order_id}/status")
def admin_update_status(
    order_id: str,
    body: OrderStatusUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return OrderService(db).admin_update_status(order_id, body.status)
