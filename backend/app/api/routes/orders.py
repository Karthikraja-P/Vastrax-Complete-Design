from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.middleware.auth import get_current_user, require_admin
from app.models.user import User
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
