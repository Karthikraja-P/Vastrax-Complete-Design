from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.middleware.auth import require_admin, get_optional_user, get_current_user
from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.models.user import User
from app.models.stock_notification import StockNotification
from app.models.product_variant import ProductVariant
from app.models.product import Product
from app.schemas.products import ImageUploadIn, ModelUploadIn, ProductCreate, ProductUpdate, StockUpdateIn
from app.schemas.reviews import ReviewCreate, ReviewResponse
from app.schemas.stock_notifications import StockNotificationCreate, StockNotificationResponse
from app.services.product_service import ProductService
from html import escape
from datetime import datetime, timezone
from app.services.stock_notification_service import StockNotificationService
from app.services.email_service import send_email
from html import escape
from datetime import datetime, timezone

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/featured")
def get_featured(db: Session = Depends(get_db)):
    return ProductService(db).list_featured()


@router.get("")
def list_products(
    category_id: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    size: Optional[str] = Query(None),
    published_only: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    if not published_only and (not current_user or str(current_user.role).lower() != "admin"):
        raise ForbiddenError("Admin access required to list drafts")
    return ProductService(db).list_products(category_id, gender, min_price, max_price, size, published_only, skip, limit)


@router.get("/search")
def search_products(
    q: str = Query(..., min_length=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return ProductService(db).search_products(q, skip, limit)


@router.get("/stock-notifications")
def list_stock_notifications(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
    bucket: Literal["all", "waiting", "notified"] = Query("all"),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    search: str = Query("", max_length=120),
):
    base_query = db.query(StockNotification)
    counts = {
        "all": base_query.count(),
        "waiting": base_query.filter(StockNotification.is_notified.is_(False)).count(),
        "notified": base_query.filter(StockNotification.is_notified.is_(True)).count(),
    }
    query = base_query
    if bucket == "waiting":
        query = query.filter(StockNotification.is_notified.is_(False))
    elif bucket == "notified":
        query = query.filter(StockNotification.is_notified.is_(True))
    clean_search = search.strip()
    if clean_search:
        pattern = f"%{clean_search}%"
        query = query.join(Product, StockNotification.product_id == Product.id).filter(
            or_(StockNotification.email.ilike(pattern), Product.name.ilike(pattern))
        )

    total = query.count()
    rows = (
        query.order_by(StockNotification.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    items = []
    for row in rows:
        variant_query = db.query(ProductVariant).filter(ProductVariant.product_id == row.product_id)
        if row.variant_id:
            variant_query = variant_query.filter(ProductVariant.id == row.variant_id)
        elif row.size:
            variant_query = variant_query.filter(ProductVariant.size.ilike(row.size))
        variant = variant_query.first() if row.size or row.variant_id else variant_query.filter(ProductVariant.stock_qty > 0).first()
        items.append({
            "id": row.id,
            "product_id": row.product_id,
            "product_name": row.product.name if row.product else "Deleted product",
            "email": row.email,
            "size": row.size,
            "is_in_stock": bool(variant and int(variant.stock_qty or 0) > 0),
            "is_notified": row.is_notified,
            "created_at": row.created_at,
            "notified_at": row.notified_at,
        })
    return {
        "items": items,
        "counts": counts,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": max(1, (total + limit - 1) // limit),
    }


@router.post("/stock-notifications/{notification_id}/send")
async def send_stock_notification_email(
    notification_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    notification = db.query(StockNotification).filter(StockNotification.id == notification_id).first()
    if not notification:
        raise NotFoundError("Waitlist request not found")
    product_name = notification.product.name if notification.product else "your requested item"
    variant_query = db.query(ProductVariant).filter(ProductVariant.product_id == notification.product_id)
    if notification.variant_id:
        variant_query = variant_query.filter(ProductVariant.id == notification.variant_id)
    elif notification.size:
        variant_query = variant_query.filter(ProductVariant.size.ilike(notification.size))
    else:
        variant_query = variant_query.filter(ProductVariant.stock_qty > 0)
    variant = variant_query.first()
    if not variant or int(variant.stock_qty or 0) <= 0:
        raise BadRequestError("Add stock for this size before sending the restock email.")

    escaped_product_name = escape(product_name)
    size_label = f" in size {escape(notification.size)}" if notification.size else ""
    product_link = f"https://vastrax.ai/storefront/product/{escape(notification.product_id)}"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #222;">
      <h2 style="color: #35214f;">Your Vastrax pick is back in stock</h2>
      <p>Hello,</p>
      <p>Good news — <strong>{escaped_product_name}</strong>{size_label} is back in stock. You asked us to let you know when it became available.</p>
      <p>Stock can change quickly, so shop whenever you’re ready.</p>
      <p style="margin: 28px 0;"><a href="{product_link}" style="background-color: #35214f; color: #fff; padding: 12px 22px; text-decoration: none; border-radius: 6px; font-weight: bold;">View product</a></p>
      <p>Thank you,<br />The Vastrax Team</p>
    </div>
    """
    await send_email(
        to_email=notification.email,
        subject=f"Your Vastrax pick is back in stock: {product_name}",
        html_content=html_body,
    )
    notification.is_notified = True
    notification.notified_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(notification)
    return {"success": True, "email": notification.email, "is_notified": notification.is_notified, "notified_at": notification.notified_at}


@router.get("/{product_id}")
def get_product(
    product_id: str,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    product = ProductService(db).get_product(product_id)
    if not product.is_published and (not current_user or str(current_user.role).lower() != "admin"):
        raise NotFoundError("Product not found")
    return product


@router.post("", status_code=status.HTTP_201_CREATED)
def create_product(
    body: ProductCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return ProductService(db).create_product(body)


@router.put("/{product_id}")
def update_product(
    product_id: str,
    body: ProductUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return ProductService(db).update_product(product_id, body)



@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ProductService(db).delete_product(product_id)


@router.put("/{product_id}/stock")
def update_stock(
    product_id: str,
    body: StockUpdateIn,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return ProductService(db).update_stock(product_id, body.variant_id, body.stock_qty)
@router.post("/{product_id}/notify", response_model=StockNotificationResponse, status_code=status.HTTP_201_CREATED)
def subscribe_stock_notification(
    product_id: str,
    body: StockNotificationCreate,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    service = StockNotificationService(db)
    notification = service.subscribe(
        product_id=product_id,
        email=body.email,
        size=body.size,
        variant_id=body.variant_id,
        user_id=current_user.id if current_user else None,
    )
    return StockNotificationResponse(
        id=notification.id,
        product_id=notification.product_id,
        email=notification.email,
        size=notification.size,
        is_notified=notification.is_notified,
        created_at=notification.created_at,
        message="You have been added to the waitlist. We will notify you as soon as this item is back in stock.",
    )



@router.post("/{product_id}/images")
def generate_image_upload_url(
    product_id: str,
    body: ImageUploadIn,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return ProductService(db).generate_image_upload_url(product_id, body.filename, body.content_type)


@router.post("/{product_id}/model")
def generate_model_upload_url(
    product_id: str,
    body: ModelUploadIn,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return ProductService(db).generate_model_upload_url(product_id, body.filename, body.content_type)


@router.post("/{product_id}/reconstruct")
def reconstruct_model(
    product_id: str,
    front: UploadFile = File(...),
    side: UploadFile = File(...),
    back: UploadFile = File(...),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return ProductService(db).reconstruct_model(product_id, front, side, back)


@router.get("/{product_id}/reviews")
def get_product_reviews(product_id: str, db: Session = Depends(get_db)):
    return ProductService(db).list_reviews(product_id)


@router.get("/{product_id}/reviews/eligibility")
def get_product_review_eligibility(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ProductService(db).review_eligibility(product_id, current_user)


@router.post("/{product_id}/reviews", status_code=status.HTTP_201_CREATED)
def create_product_review(
    product_id: str,
    body: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ProductService(db).add_review(product_id, current_user, body.rating, body.comment)
