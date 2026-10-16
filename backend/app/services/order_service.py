import threading
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
from app.models.business import StockMovement
from app.schemas.orders import OrderCreate, OrderResponse
from app.services.shiprocket_service import check_serviceability

logger = get_logger(__name__)

VALID_ADMIN_STATUSES = {"packed", "shipped", "delivered", "cancelled"}

# Thread-safe lock to prevent overselling race conditions during concurrent checkouts
_inventory_lock = threading.Lock()


DEFAULT_ITEM_WEIGHT_KG = Decimal("0.5")


def _checkout_shipping_quote(pincode: str, weight: Decimal, cod: bool, courier_id: int | None) -> dict:
    from app.services.shiprocket_service import select_shipping_quote
    result = check_serviceability(pincode, float(weight), cod)
    if result.get("error") or result.get("status") not in (200, 201):
        raise BadRequestError(result.get("error", "Shiprocket rates are unavailable for this pincode"))
    companies = (result.get("data") or {}).get("available_courier_companies") or result.get("available_courier_companies") or []
    if courier_id is not None:
        matches = [c for c in companies if str(c.get("courier_company_id") or c.get("id")) == str(courier_id)]
        if not matches:
            raise BadRequestError("The selected Shiprocket courier is no longer available; refresh delivery options")
        normalized = select_shipping_quote({"data": {"available_courier_companies": matches}})
    else:
        normalized = select_shipping_quote(result)
    if normalized.get("error"):
        raise BadRequestError(normalized["error"])
    return normalized


class OrderService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _to_response(self, order: Order) -> OrderResponse:
        res = OrderResponse.model_validate(order)
        if order.user:
            res.customer_name = order.user.full_name or order.user.email.split("@")[0]
            res.customer_email = order.user.email
        if order.address:
            res.shipping_address = ", ".join(part for part in (order.address.address_line1, order.address.city, order.address.state, order.address.pincode) if part)
        for response_item, item in zip(res.items, order.items):
            response_item.product_name = item.product.name if item.product else None
            response_item.image_url = item.product.images[0].s3_url if item.product and item.product.images else None
            response_item.size = item.variant.size if item.variant else None
        return res

    def place_order(self, user: User, payload: OrderCreate) -> OrderResponse:
        address = self.db.query(Address).filter(
            Address.id == payload.address_id, Address.user_id == user.id
        ).first()
        if not address:
            raise NotFoundError("Delivery address not found")

        # Price server-side: client-supplied prices/totals are never trusted.
        prices = {p.id: p.price_selling for p in self.db.query(Product).filter(
            Product.id.in_([i.product_id for i in payload.items])).all()}
        for i in payload.items:
            if i.product_id not in prices:
                raise NotFoundError(f"Product {i.product_id} not found")
        subtotal = sum((Decimal(prices[i.product_id]) * i.quantity for i in payload.items), Decimal("0"))
        package_weight = DEFAULT_ITEM_WEIGHT_KG * sum(i.quantity for i in payload.items)
        shipping_quote = _checkout_shipping_quote(address.pincode, package_weight, payload.payment_method in ("COD", "Cash on Delivery"), payload.shipping_courier_id)
        shipping = Decimal(str(shipping_quote["rate"])).quantize(Decimal("0.01"))
        total = (subtotal * Decimal("1.08") + shipping).quantize(Decimal("0.01"))

        order_id = f"VX-{datetime.now(timezone.utc).year}-{uuid.uuid4().hex[:10].upper()}"
        is_cod = payload.payment_method in ("Cash on Delivery", "COD")

        order = Order(
            id=order_id,
            user_id=user.id,
            address_id=payload.address_id,
            total_amount=total,
            status="confirmed" if is_cod else "pending",
            payment_status="pending",
            shipping_charge=shipping,
            shipping_courier_id=shipping_quote.get("courier_id"),
            shipping_courier=shipping_quote.get("courier_name"),
            shipping_status="Rate quoted — shipment pending",
        )
        self.db.add(order)
        self.db.flush()

        with _inventory_lock:
            for item_data in payload.items:
                product = self.db.query(Product).filter(Product.id == item_data.product_id).first()
                if not product:
                    raise NotFoundError(f"Product {item_data.product_id} not found")

                q = self.db.query(ProductVariant).filter(ProductVariant.product_id == product.id)
                variant = None
                if item_data.variant_id and item_data.variant_id != "var_dummy":
                    variant = q.filter(ProductVariant.id == item_data.variant_id).first()
                if not variant and item_data.size:
                    variant = q.filter(ProductVariant.size == item_data.size).first()
                if not variant:
                    only = q.all()
                    if len(only) == 1 and not item_data.size:
                        variant = only[0]
                if not variant:
                    raise BadRequestError(f"Size '{item_data.size or ''}' is not available for {product.name}")

                if variant.stock_qty < item_data.quantity:
                    raise BadRequestError(
                        f"Insufficient stock for {product.name} size {variant.size} (Available: {variant.stock_qty})"
                    )
                before = int(variant.stock_qty or 0)
                variant.stock_qty = before - item_data.quantity
                self.db.add(StockMovement(product_id=product.id, variant_id=variant.id, quantity_delta=-item_data.quantity, stock_before=before, stock_after=variant.stock_qty, reason='sale', reference_id=order.id, created_by=user.id))

                self.db.add(OrderItem(
                    order_id=order.id,
                    product_id=item_data.product_id,
                    variant_id=variant.id,
                    quantity=item_data.quantity,
                    unit_price=prices[item_data.product_id],
                ))

            self.db.commit()
            self.db.refresh(order)
        logger.info("Order placed: %s by user: %s", order_id, user.id)

        if is_cod:
            try:
                _book_shiprocket(order, user, address, payment_method="COD")
                send_order_email_notification(order, user, address)
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

    def retry_shiprocket(self, order_id: str) -> OrderResponse:
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise NotFoundError("Order not found")
        if order.status == "cancelled" or order.payment_status not in ("paid", "pending"):
            raise BadRequestError("Only active, confirmed or COD orders can be booked for shipment")
        if order.payment_status != "paid" and order.status != "confirmed":
            raise BadRequestError("Shipment can be booked only after payment is confirmed")
        _book_shiprocket(order, order.user, order.address, payment_method="COD" if order.payment_status != "paid" else "Prepaid")
        self.db.commit()
        self.db.refresh(order)
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
            before = int(variant.stock_qty or 0)
            variant.stock_qty = before + item.quantity
            db.add(StockMovement(product_id=item.product_id, variant_id=variant.id, quantity_delta=item.quantity, stock_before=before, stock_after=variant.stock_qty, reason='order_cancelled', reference_id=order.id, created_by=order.user_id))


def _book_shiprocket(order: Order, user: User, address: Address, payment_method: str = "Prepaid") -> bool:
    from app.services.shiprocket_service import assign_awb, create_shipment_order
    customer_info = {
        "name": user.full_name or "Valued Customer",
        "address": f"{address.address_line1}, {address.city}, {address.state}",
        "pincode": address.pincode,
        "city": address.city,
        "state": address.state,
        "phone": user.phone_number or "",
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

    shipment = None
    if order.shipping_shipment_id:
        # A previous attempt may have created the Shiprocket order but failed before AWB assignment.
        shipment = {"status": 200, "shipment_id": order.shipping_shipment_id}
    else:
        shipment = create_shipment_order(
            order_id=order.id,
            customer_info=customer_info,
            items=items_to_ship,
            total_amount=float(order.total_amount),
            payment_method=payment_method,
            weight=0.5 * sum(it.quantity for it in order.items),
        )
    if not shipment or shipment.get("error") or shipment.get("status", 200) not in (200, 201):
        order.shipping_status = "Shipment booking failed — admin retry required"
        logger.warning("Shiprocket booking failed for %s: %s", order.id, (shipment or {}).get("error", "unknown error"))
        return False

    shipment_id = shipment.get("shipment_id")
    if not shipment_id:
        order.shipping_status = "Shipment created — shipment id missing; admin review required"
        logger.error("Shiprocket response for order %s did not include shipment_id", order.id)
        return False
    order.shipping_shipment_id = str(shipment_id)
    order.shipping_awb = shipment.get("awb_code") or order.shipping_awb
    order.shipping_courier = shipment.get("courier_name") or order.shipping_courier

    if not order.shipping_awb:
        assigned = assign_awb(str(shipment_id), order.shipping_courier_id)
        if assigned and not assigned.get("error") and assigned.get("status", 200) in (200, 201):
            order.shipping_awb = assigned.get("awb_code")
            order.shipping_courier = assigned.get("courier_name") or order.shipping_courier
        else:
            order.shipping_status = "Shipment created — AWB assignment failed; admin retry required"
            logger.warning("Shiprocket AWB failed for %s: %s", order.id, (assigned or {}).get("error", "unknown error"))
            return False

    order.shipping_status = "AWB assigned — pickup pending"
    return True


def send_order_email_notification(order: Order, user: User, address: Optional[Address] = None) -> None:
    try:
        import asyncio
        from app.services.email_service import send_email

        subject = f"Order Confirmed #{order.id} | VASTRAX Luxury"
        items_rows = "".join([
            f"<tr><td style='padding:12px;border-bottom:1px solid #222;'>{it.product.name if it.product else 'Haute Couture Item'} (Size: {it.variant.size if it.variant else 'Standard'}, Qty: {it.quantity})</td><td style='padding:12px;border-bottom:1px solid #222;text-align:right;font-weight:bold;'>₹{float(it.unit_price * it.quantity):,.2f}</td></tr>"
            for it in order.items
        ])
        
        addr_text = f"{address.address_line1}, {address.city}, {address.state} - {address.pincode}" if address else "Registered Address"

        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0B0F19; color: #FFFFFF; padding: 40px 20px; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid rgba(212,175,55,0.3);">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #D4AF37; letter-spacing: 4px; font-size: 28px; margin: 0;">VASTRAX</h1>
                <p style="color: #94A3B8; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin-top: 5px;">Cyber-Luxury Couture</p>
            </div>
            
            <h2 style="color: #FFFFFF; font-size: 20px; margin-bottom: 8px;">Order Confirmation</h2>
            <p style="color: #94A3B8; font-size: 14px; line-height: 1.6;">Dear {user.full_name or 'Valued Patron'},</p>
            <p style="color: #CBD5E1; font-size: 14px; line-height: 1.6;">Thank you for your order. We are preparing your garment with meticulous care.</p>
            
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin: 24px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px; color: #94A3B8;">
                    <span>Order Reference: <strong style="color: #FFFFFF;">#{order.id}</strong></span>
                </div>
                <table style="width: 100%; border-collapse: collapse; color: #FFFFFF; font-size: 14px;">
                    <tbody>
                        {items_rows}
                    </tbody>
                </table>
                <div style="text-align: right; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(212,175,55,0.2);">
                    <span style="font-size: 14px; color: #94A3B8; margin-right: 12px;">Grand Total:</span>
                    <span style="font-size: 20px; font-weight: bold; color: #D4AF37;">₹{float(order.total_amount):,.2f}</span>
                </div>
            </div>

            <div style="font-size: 13px; color: #94A3B8; margin-top: 20px; border-top: 1px solid #1E293B; padding-top: 16px;">
                <p style="margin: 4px 0;"><strong style="color: #CBD5E1;">Shipping to:</strong> {addr_text}</p>
                <p style="margin: 4px 0;"><strong style="color: #CBD5E1;">Payment Status:</strong> <span style="color: #34D399; font-weight: 600;">{order.payment_status.upper()}</span></p>
            </div>
            
            <div style="text-align: center; margin-top: 32px; font-size: 11px; color: #64748B;">
                © 2026 VASTRAX Inc. All rights reserved.
            </div>
        </div>
        """

        try:
            loop = asyncio.get_running_loop()
            loop.create_task(send_email(to_email=user.email, subject=subject, html_content=html_content))
        except RuntimeError:
            asyncio.run(send_email(to_email=user.email, subject=subject, html_content=html_content))
    except Exception as exc:
        logger.warning("Could not dispatch confirmation email: %s", exc)
