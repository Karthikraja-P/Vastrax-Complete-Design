import uuid
from datetime import datetime, timezone
from html import escape
from typing import Optional
from urllib.parse import quote

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.core.logging import get_logger
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.stock_notification import StockNotification
from app.services.email_service import send_email

logger = get_logger(__name__)


class StockNotificationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def subscribe(
        self,
        product_id: str,
        email: str,
        size: Optional[str] = None,
        variant_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> StockNotification:
        clean_id = str(product_id).strip()
        product = (
            self.db.query(Product)
            .filter((Product.id == clean_id) | (Product.id == f"vtx-{clean_id}"))
            .first()
        )
        if not product:
            raise NotFoundError(f"Product {product_id} not found")

        if not variant_id and size:
            variant = (
                self.db.query(ProductVariant)
                .filter(
                    ProductVariant.product_id == product.id,
                    ProductVariant.size.ilike(size),
                )
                .first()
            )
            if variant:
                variant_id = variant.id

        existing_query = self.db.query(StockNotification).filter(
            StockNotification.product_id == product.id,
            StockNotification.email == email.strip().lower(),
            StockNotification.is_notified.is_(False),
        )
        if size:
            existing_query = existing_query.filter(StockNotification.size.ilike(size))
        existing = existing_query.first()
        if existing:
            return existing

        notification = StockNotification(
            id=str(uuid.uuid4()),
            product_id=product.id,
            variant_id=variant_id,
            user_id=user_id,
            email=email.strip().lower(),
            size=size,
            is_notified=False,
        )
        self.db.add(notification)
        self.db.commit()
        self.db.refresh(notification)
        logger.info(
            "Subscribed %s to waitlist for product %s (size %s)",
            email,
            product.id,
            size,
        )
        return notification

    def _stock_for(self, notification: StockNotification) -> int:
        variant = notification.variant
        if variant is None and notification.size:
            variant = (
                self.db.query(ProductVariant)
                .filter(
                    ProductVariant.product_id == notification.product_id,
                    ProductVariant.size.ilike(notification.size),
                )
                .first()
            )
        if variant is not None:
            return int(variant.stock_qty or 0)
        if notification.size:
            return 0
        total = (
            self.db.query(func.coalesce(func.sum(ProductVariant.stock_qty), 0))
            .filter(ProductVariant.product_id == notification.product_id)
            .scalar()
        )
        return int(total or 0)

    def list_for_admin(self, limit: int = 1000) -> list[dict]:
        rows = (
            self.db.query(StockNotification)
            .order_by(StockNotification.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": row.id,
                "product_id": row.product_id,
                "product_name": row.product.name if row.product else "Deleted product",
                "size": row.size,
                "email": row.email,
                "current_stock": self._stock_for(row),
                "is_notified": row.is_notified,
                "created_at": row.created_at,
                "notified_at": row.notified_at,
            }
            for row in rows
        ]

    async def send_one(self, notification_id: str) -> dict:
        notification = (
            self.db.query(StockNotification)
            .filter(StockNotification.id == notification_id)
            .first()
        )
        if not notification:
            raise NotFoundError("Restock request not found")
        if notification.is_notified:
            raise ConflictError("This customer has already been notified")
        product = self.db.query(Product).filter(Product.id == notification.product_id).first()
        if not product:
            raise NotFoundError("The product for this restock request no longer exists")
        if self._stock_for(notification) <= 0:
            raise BadRequestError("Add stock for this size before sending the restock email")

        size_label = f" in size {escape(notification.size)}" if notification.size else ""
        subject = f"{product.name} is back in stock"
        product_url = f"https://vastrax.ai/storefront/product?id={quote(product.id)}"
        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #241a22;">
          <h2>Your Vastrax pick is available again</h2>
          <p>You asked us to let you know when <strong>{escape(product.name)}</strong>{size_label} was back in stock.</p>
          <p>Stock is now available. Visit the product page to take another look.</p>
          <p style="margin: 28px 0;"><a href="{product_url}" style="background:#241a22;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;">View the product</a></p>
          <p style="font-size:12px;color:#746b70;">You received this because you requested a restock update from Vastrax.</p>
        </div>
        """

        await send_email(to_email=notification.email, subject=subject, html_content=html_body)
        notification.is_notified = True
        notification.notified_at = datetime.now(timezone.utc)
        self.db.commit()
        logger.info("Manually sent restock notification %s", notification.id)
        return {"status": "sent", "notification_id": notification.id, "notified_at": notification.notified_at}
