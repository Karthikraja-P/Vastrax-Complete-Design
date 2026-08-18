import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.core.logging import get_logger
from app.models.address import Address
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.user import User
from app.schemas.orders import OrderCreate, OrderResponse

logger = get_logger(__name__)

VALID_ADMIN_STATUSES = {"packed", "shipped", "delivered", "cancelled"}


class OrderService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _to_response(self, order: Order) -> OrderResponse:
        return OrderResponse.model_validate(order)

    def place_order(self, user: User, payload: OrderCreate) -> OrderResponse:
        address = self.db.query(Address).filter(
            Address.id == payload.address_id, Address.user_id == user.id
        ).first()
        if not address:
            raise NotFoundError("Delivery address not found")

        order_id = f"VX-{datetime.now(timezone.utc).year}-{uuid.uuid4().hex[:4].upper()}"
        is_cod = payload.payment_method in ("Cash on Delivery", "COD")

        order = Order(
            id=order_id,
            user_id=user.id,
            address_id=payload.address_id,
            total_amount=payload.total_amount,
            status="confirmed" if is_cod else "pending",
            payment_status="pending",
        )
        self.db.add(order)
        self.db.flush()

        for item_data in payload.items:
            variant = self.db.query(ProductVariant).filter(
                ProductVariant.id == item_data.variant_id
            ).first()
            if not variant:
                raise NotFoundError(f"Variant {item_data.variant_id} not found")

            product = self.db.query(Product).filter(Product.id == item_data.product_id).first()
            if not product:
                raise NotFoundError(f"Product {item_data.product_id} not found")

            if variant.stock_qty < item_data.quantity:
                raise BadRequestError(
                    f"Insufficient stock for {product.name} size {variant.size}"
                )
            variant.stock_qty -= item_data.quantity

            self.db.add(OrderItem(
                order_id=order.id,
                product_id=item_data.product_id,
                variant_id=item_data.variant_id,
                quantity=item_data.quantity,
                unit_price=item_data.unit_price,
            ))

        self.db.commit()
        self.db.refresh(order)
        logger.info("Order placed: %s by user: %s", order_id, user.id)

        if is_cod:
            try:
                _book_shiprocket(order, user, address)
                self.db.commit()
            except Exception as exc:
                logger.error("Failed to book COD shipment: %s", exc)

        return self._to_response(order)

    def list_user_orders(self, user: User) -> list[OrderResponse]:
        orders = (
            self.db.query(Order)
            .filter(Order.user_id == user.id)
            .order_by(Order.placed_at.desc())
            .all()
        )
        return [self._to_response(o) for o in orders]

    def get_order_detail(self, order_id: str, user: User) -> dict:
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise NotFoundError("Order not found")
        if order.user_id != user.id:
            raise ForbiddenError("Access denied")

        response = self._to_response(order).model_dump()

        if order.shipping_shipment_id:
            try:
                from app.services.shiprocket_service import track_shipment
                tracking = track_shipment(order.shipping_shipment_id)
                if tracking:
                    response["tracking_info"] = tracking
            except Exception as exc:
                logger.error("Tracking fetch failed: %s", exc)

        return response

    def cancel_order(self, order_id: str, user: User) -> OrderResponse:
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise NotFoundError("Order not found")
        if order.user_id != user.id:
            raise ForbiddenError("Access denied")
        if order.status in ("shipped", "delivered"):
            raise BadRequestError("Cannot cancel a shipped or delivered order")

        if order.shipping_awb:
            try:
                from app.services.shiprocket_service import cancel_shipment_by_awb
                cancel_shipment_by_awb(order.shipping_awb)
            except Exception as exc:
                logger.error("Shiprocket cancellation failed: %s", exc)

        _restore_stock(self.db, order)
        order.status = "cancelled"
        order.payment_status = "refunded"
        self.db.commit()
        self.db.refresh(order)
        logger.info("Order cancelled: %s by user: %s", order_id, user.id)
        return self._to_response(order)

    def list_all_orders(self, status_filter: Optional[str] = None) -> list[OrderResponse]:
        q = self.db.query(Order).order_by(Order.placed_at.desc())
        if status_filter:
            q = q.filter(Order.status == status_filter)
        return [self._to_response(o) for o in q.all()]

    def admin_update_status(self, order_id: str, new_status: str) -> OrderResponse:
        if new_status not in VALID_ADMIN_STATUSES:
            raise BadRequestError(
                f"Invalid status. Must be one of: {', '.join(sorted(VALID_ADMIN_STATUSES))}"
            )
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise NotFoundError("Order not found")

        if new_status == "cancelled":
            if order.shipping_awb:
                try:
                    from app.services.shiprocket_service import cancel_shipment_by_awb
                    cancel_shipment_by_awb(order.shipping_awb)
                except Exception as exc:
                    logger.error("Shiprocket cancellation failed: %s", exc)
            _restore_stock(self.db, order)
            order.payment_status = "refunded"

        order.status = new_status
        self.db.commit()
        self.db.refresh(order)
        logger.info("Admin updated order %s to: %s", order_id, new_status)
        return self._to_response(order)


def _restore_stock(db: Session, order: Order) -> None:
    if order.status == "cancelled":
        return
    for item in order.items:
        variant = db.query(ProductVariant).filter(
            ProductVariant.id == item.variant_id
        ).first()
        if variant:
            variant.stock_qty += item.quantity


def _book_shiprocket(order: Order, user: User, address: Address) -> None:
    from app.services.shiprocket_service import create_shipment_order
    customer_info = {
        "name": user.full_name or "Valued Customer",
        "address": f"{address.address_line1}, {address.city}, {address.state}",
        "pincode": address.pincode,
        "phone": user.phone_number or "9999999999",
        "email": user.email,
    }
    items_to_ship = []
    for it in order.items:
        items_to_ship.append({
            "name": it.product.name if it.product else "Premium Garment",
            "variant_id": it.variant_id,
            "quantity": it.quantity,
            "unit_price": float(it.unit_price),
        })

    shipment = create_shipment_order(
        order_id=order.id,
        customer_info=customer_info,
        items=items_to_ship,
        total_amount=float(order.total_amount),
        payment_method="Cash on Delivery",
    )
    if shipment:
        order.shipping_shipment_id = shipment.get("shipment_id")
        order.shipping_awb = shipment.get("awb_code")
        order.shipping_courier = shipment.get("courier_name")
        order.shipping_status = "Manifested"
