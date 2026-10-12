"""Admin return authorization, receiving, and stock reconciliation endpoints."""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.middleware.auth import require_business_permission
from app.models.business import StockMovement
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.payment import Payment
from app.models.payment_refund import PaymentRefund
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.returns import SalesReturn, SalesReturnLine
from app.models.user import User
from app.schemas.payments import RefundIn
from app.services.payment_service import PaymentService
from app.services.erp_posting_service import restore_returned_cogs

router = APIRouter(tags=["erp-returns"], dependencies=[Depends(require_business_permission("erp"))])


class ReturnLineInput(BaseModel):
    order_item_id: str
    quantity: int = Field(gt=0, le=100000)


class ReturnCreate(BaseModel):
    order_id: str
    reason: Literal["size", "damaged", "wrong_item", "quality", "other"]
    notes: str | None = Field(default=None, max_length=2000)
    items: list[ReturnLineInput] = Field(min_length=1)


class ReturnReview(BaseModel):
    decision: Literal["approve", "reject"]


class ReturnReceiptLine(BaseModel):
    line_id: str
    quantity_received: int = Field(gt=0, le=100000)
    quantity_restocked: int = Field(ge=0, le=100000)


class ReturnReceipt(BaseModel):
    items: list[ReturnReceiptLine] = Field(min_length=1)


def _serialize_return(db: Session, item: SalesReturn) -> dict:
    lines = db.query(SalesReturnLine, Product.name, ProductVariant.size).join(Product, Product.id == SalesReturnLine.product_id).join(ProductVariant, ProductVariant.id == SalesReturnLine.variant_id).filter(SalesReturnLine.return_id == item.id).all()
    payments = db.query(Payment).filter(Payment.order_id == item.order_id).order_by(Payment.created_at.desc()).all()
    payment_rows = []
    for payment in payments:
        refunds = db.query(PaymentRefund).filter(
            PaymentRefund.payment_id == payment.id,
            PaymentRefund.return_id == item.id,
        ).order_by(PaymentRefund.created_at.desc()).all()
        all_refunds = db.query(PaymentRefund).filter(PaymentRefund.payment_id == payment.id).all()
        processed = sum((Decimal(row.amount) for row in all_refunds if row.status == "processed"), Decimal("0.00"))
        reserved = sum((Decimal(row.amount) for row in all_refunds if row.status in ("pending", "unknown")), Decimal("0.00"))
        payment_rows.append({
            "id": payment.id, "amount": str(payment.amount), "status": payment.status,
            "refundable_amount": str(max(Decimal("0.00"), Decimal(payment.amount) - processed - reserved)),
            "refunds": [{"id": row.id, "amount": str(row.amount), "status": row.status, "created_at": row.created_at} for row in refunds],
        })
    return {
        "id": item.id, "order_id": item.order_id, "status": item.status, "reason": item.reason,
        "notes": item.notes, "requested_at": item.requested_at, "reviewed_at": item.reviewed_at,
        "received_at": item.received_at,
        "payments": payment_rows,
        "items": [{"id": line.id, "order_item_id": line.order_item_id, "product_name": name, "size": size,
                   "quantity_requested": line.quantity_requested, "quantity_received": line.quantity_received,
                   "quantity_restocked": line.quantity_restocked, "unit_price": str(line.unit_price)}
                  for line, name, size in lines],
    }


@router.get("/erp/returnable-orders")
def returnable_orders(db: Session = Depends(get_db)):
    orders = db.query(Order).filter(Order.status == "delivered").order_by(Order.placed_at.desc()).limit(500).all()
    result = []
    for order in orders:
        items = db.query(OrderItem, Product.name, ProductVariant.size).join(Product, Product.id == OrderItem.product_id).join(ProductVariant, ProductVariant.id == OrderItem.variant_id).filter(OrderItem.order_id == order.id).all()
        result.append({"id": order.id, "placed_at": order.placed_at, "items": [
            {"order_item_id": line.id, "product_name": name, "size": size, "quantity": line.quantity,
             "unit_price": str(line.unit_price)} for line, name, size in items
        ]})
    return result


@router.get("/erp/returns")
def list_returns(db: Session = Depends(get_db)):
    returns = db.query(SalesReturn).order_by(SalesReturn.requested_at.desc()).limit(500).all()
    return [_serialize_return(db, item) for item in returns]


@router.post("/erp/returns", status_code=status.HTTP_201_CREATED)
def create_return(body: ReturnCreate, admin: User = Depends(require_business_permission("erp")), db: Session = Depends(get_db)):
    order = db.get(Order, body.order_id)
    if not order or order.status != "delivered":
        raise HTTPException(409, "Returns can only be logged for delivered orders")
    item_ids = [line.order_item_id for line in body.items]
    if len(set(item_ids)) != len(item_ids):
        raise HTTPException(422, "Each order item can appear once per return")
    order_items = {line.id: line for line in db.query(OrderItem).filter(OrderItem.order_id == order.id, OrderItem.id.in_(item_ids)).all()}
    if len(order_items) != len(item_ids):
        raise HTTPException(404, "One or more items do not belong to this order")
    existing = db.query(SalesReturnLine.order_item_id, func.sum(SalesReturnLine.quantity_requested)).join(SalesReturn, SalesReturn.id == SalesReturnLine.return_id).filter(SalesReturn.order_id == order.id, SalesReturn.status != "rejected", SalesReturnLine.order_item_id.in_(item_ids)).group_by(SalesReturnLine.order_item_id).all()
    already_requested = {item_id: int(quantity or 0) for item_id, quantity in existing}
    for request_line in body.items:
        if request_line.quantity + already_requested.get(request_line.order_item_id, 0) > order_items[request_line.order_item_id].quantity:
            raise HTTPException(409, "Requested return quantity exceeds the unreturned quantity")
    case = SalesReturn(order_id=order.id, reason=body.reason, notes=body.notes, created_by=admin.id)
    db.add(case)
    db.flush()
    for request_line in body.items:
        source = order_items[request_line.order_item_id]
        db.add(SalesReturnLine(return_id=case.id, order_item_id=source.id, product_id=source.product_id,
                               variant_id=source.variant_id, quantity_requested=request_line.quantity,
                               unit_price=source.unit_price))
    db.commit()
    db.refresh(case)
    return _serialize_return(db, case)


@router.post("/erp/returns/{return_id}/review")
def review_return(return_id: str, body: ReturnReview, admin: User = Depends(require_business_permission("erp")), db: Session = Depends(get_db)):
    case = db.get(SalesReturn, return_id)
    if not case or case.status != "requested":
        raise HTTPException(409, "Only a requested return can be reviewed")
    case.status = "approved" if body.decision == "approve" else "rejected"
    case.reviewed_by = admin.id
    case.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": case.id, "status": case.status}


@router.post("/erp/returns/{return_id}/receive")
def receive_return(return_id: str, body: ReturnReceipt, admin: User = Depends(require_business_permission("erp")), db: Session = Depends(get_db)):
    case = db.get(SalesReturn, return_id)
    if not case or case.status not in ("approved", "partially_received"):
        raise HTTPException(409, "Return must be approved before receiving items")
    line_ids = [row.line_id for row in body.items]
    if len(set(line_ids)) != len(line_ids):
        raise HTTPException(422, "Each return line can appear once per receipt")
    lines = {line.id: line for line in db.query(SalesReturnLine).filter(SalesReturnLine.return_id == case.id, SalesReturnLine.id.in_(line_ids)).with_for_update().all()}
    if len(lines) != len(line_ids):
        raise HTTPException(404, "One or more return lines do not belong to this case")
    for receipt in body.items:
        line = lines[receipt.line_id]
        if line.quantity_received + receipt.quantity_received > line.quantity_requested:
            db.rollback()
            raise HTTPException(409, "Received quantity exceeds the requested quantity")
        if line.quantity_restocked + receipt.quantity_restocked > line.quantity_received + receipt.quantity_received:
            db.rollback()
            raise HTTPException(409, "Cannot restock more units than were received")
        if receipt.quantity_restocked:
            variant = db.query(ProductVariant).filter(ProductVariant.id == line.variant_id).with_for_update().first()
            if not variant:
                db.rollback()
                raise HTTPException(409, "Product variant no longer exists")
            before = int(variant.stock_qty or 0)
            variant.stock_qty = before + receipt.quantity_restocked
            db.add(StockMovement(product_id=line.product_id, variant_id=line.variant_id,
                                 quantity_delta=receipt.quantity_restocked, stock_before=before,
                                 stock_after=variant.stock_qty, reason="customer_return", reference_id=case.id,
                                 notes=f"Return receipt {line.id}", created_by=admin.id))
            source_key = f"return-cogs:{case.id}:{line.id}:{line.quantity_restocked + receipt.quantity_restocked}"
            try:
                restore_returned_cogs(db, line, receipt.quantity_restocked, admin.id, source_key)
            except RuntimeError as exc:
                db.rollback()
                raise HTTPException(409, str(exc)) from exc
        line.quantity_received += receipt.quantity_received
        line.quantity_restocked += receipt.quantity_restocked
    all_lines = db.query(SalesReturnLine).filter(SalesReturnLine.return_id == case.id).all()
    case.status = "received" if all(line.quantity_received == line.quantity_requested for line in all_lines) else "partially_received"
    case.received_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": case.id, "status": case.status}


@router.post("/erp/returns/{return_id}/refund")
def refund_return(return_id: str, body: RefundIn, admin: User = Depends(require_business_permission("erp")), db: Session = Depends(get_db)):
    case = db.query(SalesReturn).filter(SalesReturn.id == return_id).first()
    if not case:
        raise HTTPException(404, "Return case not found")
    if body.return_id and body.return_id != case.id:
        raise HTTPException(422, "Return id does not match request path")
    return PaymentService(db).process_refund(body.txn_id, body.amount, created_by_id=admin.id, return_id=case.id)
