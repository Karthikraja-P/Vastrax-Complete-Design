import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.stock_notification import StockNotification
from app.services.email_service import send_email

logger = get_logger(__name__)


async def _dispatch_notification_batch(jobs: list[dict]) -> None:
    """Dispatches emails in paced, throttled batches to avoid SMTP/API rate limits."""
    import asyncio
    chunk_size = 5
    for i in range(0, len(jobs), chunk_size):
        chunk = jobs[i:i + chunk_size]
        tasks = [
            send_email(to_email=j["email"], subject=j["subject"], html_content=j["body"])
            for j in chunk
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for job, res in zip(chunk, results):
            if isinstance(res, Exception):
                logger.error("Failed to dispatch restock email to %s: %s", job["email"], str(res))
        if i + chunk_size < len(jobs):
            await asyncio.sleep(0.15)


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

    def notify_subscribers_for_product(
        self, product_id: str, variant_id: Optional[str] = None, new_qty: int = 1
    ) -> int:
        """Trigger email notifications for users waiting for this product/variant."""
        if new_qty <= 0:
            return 0

        product = (
            self.db.query(Product)
            .filter(Product.id == product_id)
            .first()
        )
        if not product:
            return 0

        query = self.db.query(StockNotification).filter(
            StockNotification.product_id == product_id,
            StockNotification.is_notified.is_(False),
        )

        variant = None
        if variant_id:
            variant = (
                self.db.query(ProductVariant)
                .filter(ProductVariant.id == variant_id)
                .first()
            )
            if variant and variant.size:
                # Notify users waiting for this specific size OR users waiting for any size
                query = query.filter(
                    (StockNotification.size.is_(None))
                    | (StockNotification.size.ilike(variant.size))
                    | (StockNotification.variant_id == variant_id)
                )

        subscribers = query.all()
        email_jobs = []
        notified_count = 0
        for sub in subscribers:
            size_label = f" (Size: {sub.size})" if sub.size else ""
            subject = f"Back in Stock: {product.name} is now available!"
            html_body = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #111;">Good news! Your item is back in stock.</h2>
                <p style="color: #555; font-size: 15px;">
                    You recently asked to be notified when <strong>{product.name}</strong>{size_label} became available again.
                </p>
                <div style="margin: 25px 0;">
                    <a href="https://vastrax.shop/storefront/product?id={product.id}" 
                       style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                        Order Now Before It Sells Out
                    </a>
                </div>
                <p style="color: #888; font-size: 12px;">
                    Thank you for choosing VastraX Luxury Fashion.
                </p>
            </div>
            """
            email_jobs.append({"email": sub.email, "subject": subject, "body": html_body})
            sub.is_notified = True
            sub.notified_at = datetime.now(timezone.utc)
            notified_count += 1

        if notified_count > 0:
            self.db.commit()
            logger.info(
                "Queued %d restock notifications for product %s",
                notified_count,
                product_id,
            )
            # Dispatch batch in background without blocking response
            try:
                import asyncio
                import threading
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(_dispatch_notification_batch(email_jobs))
                except RuntimeError:
                    threading.Thread(
                        target=lambda: asyncio.run(_dispatch_notification_batch(email_jobs)),
                        daemon=True,
                    ).start()
            except Exception as e:
                logger.error("Failed to schedule restock notification batch: %s", str(e))

        return notified_count
