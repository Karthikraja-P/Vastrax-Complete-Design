from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.middleware.auth import require_admin
from app.models.user import User
from app.schemas.products import ImageUploadIn, ProductCreate, ProductUpdate, StockUpdateIn
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/featured")
def get_featured(db: Session = Depends(get_db)):
    return ProductService(db).list_featured()


@router.get("")
def list_products(
    category_id: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    size: Optional[str] = Query(None),
    published_only: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return ProductService(db).list_products(category_id, min_price, max_price, size, published_only, skip, limit)


@router.get("/search")
def search_products(
    q: str = Query(..., min_length=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return ProductService(db).search_products(q, skip, limit)


@router.get("/{product_id}")
def get_product(product_id: str, db: Session = Depends(get_db)):
    return ProductService(db).get_product(product_id)


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


@router.post("/{product_id}/images")
def generate_image_upload_url(
    product_id: str,
    body: ImageUploadIn,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return ProductService(db).generate_image_upload_url(product_id, body.filename, body.content_type)
