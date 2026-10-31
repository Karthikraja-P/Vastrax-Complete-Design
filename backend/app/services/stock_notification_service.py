import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.stock_notification import StockNotification

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

        # Resolve variant if variant_id provided or if size provided
        if not variant_id and size:
            var = (
                self.db.query(ProductVariant)
                .filter(
                    ProductVariant.product_id == product.id,
                    ProductVariant.size.ilike(size),
                )
                .first()
            )
            if var:
                variant_id = var.id

        # Check existing subscription for same email and product (and size if specified)
        query = self.db.query(StockNotification).filter(
            StockNotification.product_id == product.id,
            StockNotification.email == email.strip().lower(),
            StockNotification.is_notified.is_(False),
        )
        if size:
            query = query.filter(StockNotification.size.ilike(size))

        existing = query.first()
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
