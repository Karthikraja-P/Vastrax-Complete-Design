import asyncio
import html
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.order import Order
from app.models.order_status_notification import OrderStatusNotification
from app.services.email_service import send_email

logger = logging.getLogger(__name__)

STATUS_COPY = {
    "packed": ("Your order is packed", "Your order has been packed and is being prepared for dispatch."),
    "shipped": ("Your order is on its way", "Your order has been handed to the courier and is on its way."),
    "out_for_delivery": ("Your order is out for delivery", "The courier is out for delivery with your order."),
    "delivered": ("Your order was delivered", "Your order has been marked as delivered."),
}


def _can_notify(order: Order) -> bool:
    is_cod = str(order.payment_method or "").strip().casefold() in {"cod", "cash on delivery"}
    return bool(order.user and order.user.email and (order.payment_status == "paid" or is_cod))


def _reserve_notification(db: Session, order: Order, status_key: str) -> str | None:
    now = datetime.now(timezone.utc)
    notification = db.query(OrderStatusNotification).filter_by(
        order_id=order.id,
        status_key=status_key,
    ).first()

    if notification:
        if notification.state == "sent":
            return None
        updated_at = notification.updated_at
        if updated_at.tzinfo is None:
            updated_at = updated_at.replace(tzinfo=timezone.utc)
        if notification.state == "sending" and now - updated_at < timedelta(minutes=10):
            return None
        notification.state = "sending"
        notification.attempt_count += 1
        notification.last_error = None
        notification.updated_at = now
    else:
        notification = OrderStatusNotification(
            order_id=order.id,
            status_key=status_key,
            state="sending",
            attempt_count=1,
            created_at=now,
            updated_at=now,
        )
        db.add(notification)

    try:
        db.commit()
        return notification.id
    except IntegrityError:
        db.rollback()
        return None


def send_order_status_notification(db: Session, order: Order, status_key: str) -> None:
    copy = STATUS_COPY.get(status_key)
    if not copy or not _can_notify(order):
        return

    notification_id = _reserve_notification(db, order, status_key)
    if not notification_id:
        return

    title, message = copy
    order_ref = html.escape(order.id)
    customer_name = html.escape(order.user.full_name or "there")
    courier = html.escape(order.shipping_courier or "")
    awb = html.escape(order.shipping_awb or "")
    details = []
    if courier:
        details.append(f"<p style='margin:4px 0;'><strong>Courier:</strong> {courier}</p>")
    if awb:
        details.append(f"<p style='margin:4px 0;'><strong>Tracking / AWB:</strong> {awb}</p>")
    delivery_details = (
        f"<div style='margin:20px 0;padding:16px;border-radius:10px;background:#f7f4ef;color:#302820;'>{''.join(details)}</div>"
        if details else ""
    )
    base_url = str(settings.frontend_url or "https://vastrax.ai").split(",", 1)[0].strip().rstrip("/")
    account_url = html.escape(f"{base_url}/storefront/account", quote=True)
    subject = f"{title} · Order {order.id} | VastraX"
    content = f"""
    <div style="max-width:600px;margin:0 auto;padding:32px 24px;font-family:Arial,sans-serif;color:#29231f;background:#fff;">
      <p style="margin:0;color:#8a4a2d;font-weight:700;letter-spacing:3px;">VASTRAX</p>
      <h1 style="margin:24px 0 8px;font-size:24px;">{html.escape(title)}</h1>
      <p>Hi {customer_name},</p>
      <p>{html.escape(message)}</p>
      <p><strong>Order:</strong> {order_ref}</p>
      {delivery_details}
      <p><a href="{account_url}" style="color:#8a4a2d;font-weight:700;">View your order</a></p>
      <p style="margin-top:32px;color:#777;font-size:12px;">Questions? Email vastrax.shop@gmail.com</p>
    </div>
    """

    try:
        asyncio.run(send_email(to_email=order.user.email, subject=subject, html_content=content))
    except Exception as exc:
        notification = db.query(OrderStatusNotification).filter_by(id=notification_id).first()
        if notification:
            notification.state = "failed"
            notification.last_error = type(exc).__name__
            notification.updated_at = datetime.now(timezone.utc)
            db.commit()
        logger.warning("Order status email failed for order %s (%s)", order.id, status_key)
        return

    notification = db.query(OrderStatusNotification).filter_by(id=notification_id).first()
    if notification:
        notification.state = "sent"
        notification.sent_at = datetime.now(timezone.utc)
        notification.updated_at = notification.sent_at
        notification.last_error = None
        db.commit()
    logger.info("Order status email sent for order %s (%s)", order.id, status_key)
