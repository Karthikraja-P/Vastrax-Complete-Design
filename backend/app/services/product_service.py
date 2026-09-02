from decimal import Decimal
from typing import Optional

import boto3
from botocore.exceptions import ClientError
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import InternalError, NotFoundError
from fastapi import UploadFile
import requests
from app.core.logging import get_logger
from app.models.category import Category
from app.models.product import Product
from app.models.product_image import ProductImage
from app.models.product_variant import ProductVariant
from app.schemas.products import ProductCreate, ProductResponse, ProductUpdate

logger = get_logger(__name__)


class ProductService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _resolve_category_id(self, cat_input: Optional[str]) -> str:
        if cat_input:
            cat = self.db.query(Category).filter(
                (Category.id == cat_input) | (Category.slug == cat_input) | (Category.name.ilike(cat_input))
            ).first()
            if cat:
                return cat.id
        # Fallback to any existing category, or create a default 'apparel' category
        first_cat = self.db.query(Category).first()
        if first_cat:
            return first_cat.id
        new_cat = Category(name="Apparel", slug="apparel")
        self.db.add(new_cat)
        self.db.commit()
        self.db.refresh(new_cat)
        return new_cat.id

    def _to_response(self, product: Product) -> ProductResponse:
        return ProductResponse.model_validate(product)

    def list_featured(self) -> list[ProductResponse]:
        products = (
            self.db.query(Product)
            .filter(Product.is_featured.is_(True), Product.is_published.is_(True))
            .all()
        )
        return [self._to_response(p) for p in products]

    def list_products(
        self,
        category_id: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        size: Optional[str] = None,
        published_only: bool = True,
        skip: int = 0,
        limit: int = 50,
    ) -> list[ProductResponse]:
        q = self.db.query(Product)
        if published_only:
            q = q.filter(Product.is_published.is_(True))
        if category_id:
            resolved_cat = self._resolve_category_id(category_id)
            q = q.filter((Product.category_id == category_id) | (Product.category_id == resolved_cat))
        if min_price is not None:
            q = q.filter(Product.price_selling >= Decimal(str(min_price)))
        if max_price is not None:
            q = q.filter(Product.price_selling <= Decimal(str(max_price)))
        if size:
            q = q.join(Product.variants).filter(ProductVariant.size == size)
        products = q.offset(skip).limit(limit).all()
        return [self._to_response(p) for p in products]

    def search_products(self, query: str, skip: int = 0, limit: int = 50) -> list[ProductResponse]:
        # Raw SQL for full-text-like ILIKE search across name and description
        rows = self.db.execute(
            text(
                "SELECT id FROM products "
                "WHERE (name ILIKE :q OR description ILIKE :q) AND is_published = TRUE "
                "ORDER BY name LIMIT :limit OFFSET :skip"
            ),
            {"q": f"%{query}%", "limit": limit, "skip": skip},
        ).fetchall()
        ids = [r[0] for r in rows]
        products = self.db.query(Product).filter(Product.id.in_(ids)).all()
        id_order = {pid: i for i, pid in enumerate(ids)}
        products.sort(key=lambda p: id_order.get(p.id, 999))
        return [self._to_response(p) for p in products]

    def get_product(self, product_id: str) -> ProductResponse:
        product = self.db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise NotFoundError("Product not found")
        return self._to_response(product)

    def create_product(self, payload: ProductCreate) -> ProductResponse:
        cat_id = self._resolve_category_id(payload.category_id)
        product = Product(
            category_id=cat_id,
            name=payload.name,
            fabric=payload.fabric,
            colour=payload.colour,
            price_mrp=payload.price_mrp,
            price_selling=payload.price_selling,
            model_path=payload.model_path,
            description=payload.description,
            is_featured=payload.is_featured,
            is_published=payload.is_published,
        )
        self.db.add(product)
        self.db.flush()

        for img_data in payload.images:
            self.db.add(ProductImage(
                product_id=product.id,
                s3_url=img_data.s3_url,
                display_order=img_data.display_order,
            ))
        for var_data in payload.variants:
            self.db.add(ProductVariant(
                product_id=product.id,
                sku=var_data.sku,
                size=var_data.size,
                stock_qty=var_data.stock_qty,
            ))

        self.db.commit()
        self.db.refresh(product)
        logger.info("Product created: %s", product.id)
        return self._to_response(product)

    def update_product(self, product_id: str, payload: ProductUpdate) -> ProductResponse:
        clean_id = str(product_id).strip()
        product = self.db.query(Product).filter(
            (Product.id == clean_id) | 
            (Product.id == f"vtx-{clean_id}")
        ).first()
        if not product:
            raise NotFoundError("Product not found")

        for field in ("name", "fabric", "colour", "price_mrp",
                      "price_selling", "description", "is_featured", "is_published"):
            value = getattr(payload, field, None)
            if value is not None:
                if field in ("price_mrp", "price_selling"):
                    try:
                        value = float(value)
                    except (ValueError, TypeError):
                        pass
                setattr(product, field, value)

        if payload.model_path is not None:
            product.model_path = payload.model_path

        if payload.category_id is not None:
            product.category_id = self._resolve_category_id(payload.category_id)

        from app.models.product_image import ProductImage
        from app.models.product_variant import ProductVariant

        if payload.images is not None:
            self.db.query(ProductImage).filter(ProductImage.product_id == product.id).delete(synchronize_session=False)
            for img_data in payload.images:
                self.db.add(ProductImage(
                    product_id=product.id,
                    s3_url=img_data.s3_url,
                    display_order=img_data.display_order,
                ))

        if payload.variants is not None:
            self.db.query(ProductVariant).filter(ProductVariant.product_id == product.id).delete(synchronize_session=False)
            for var_data in payload.variants:
                self.db.add(ProductVariant(
                    product_id=product.id,
                    sku=var_data.sku or f"{product.id}-{var_data.size}",
                    size=var_data.size,
                    stock_qty=var_data.stock_qty,
                ))

        self.db.commit()
        self.db.refresh(product)
        logger.info("Product updated: %s", product_id)
        return self._to_response(product)

    def delete_product(self, product_id: str) -> None:
        clean_id = str(product_id).strip()
        product = self.db.query(Product).filter(
            (Product.id == clean_id) | 
            (Product.id == f"vtx-{clean_id}") |
            (Product.name.ilike(clean_id))
        ).first()

        if not product and "-" in clean_id:
            product = self.db.query(Product).filter(Product.id.ilike(f"%{clean_id}%")).first()

        if not product:
            raise NotFoundError(f"Product {product_id} not found")

        try:
            from app.models.order_item import OrderItem
            from app.models.tryon_session import TryonSession
            from app.models.wishlist import Wishlist
            from app.models.product_image import ProductImage
            from app.models.product_variant import ProductVariant

            self.db.query(TryonSession).filter(TryonSession.product_id == product.id).delete(synchronize_session=False)
            self.db.query(OrderItem).filter(OrderItem.product_id == product.id).delete(synchronize_session=False)
            self.db.query(Wishlist).filter(Wishlist.product_id == product.id).delete(synchronize_session=False)
            self.db.query(ProductImage).filter(ProductImage.product_id == product.id).delete(synchronize_session=False)
            self.db.query(ProductVariant).filter(ProductVariant.product_id == product.id).delete(synchronize_session=False)
            self.db.delete(product)
            self.db.commit()
            logger.info("Product %s (%s) deleted permanently from database", product.id, product.name)
        except Exception as e:
            self.db.rollback()
            logger.error("Failed to delete product %s: %s", product_id, str(e))
            raise e

    def update_stock(self, product_id: str, variant_id: str, stock_qty: int) -> dict:
        variant = self.db.query(ProductVariant).filter(
            ProductVariant.id == variant_id,
            ProductVariant.product_id == product_id,
        ).first()
        if not variant:
            raise NotFoundError("Variant not found for this product")
        variant.stock_qty = stock_qty
        self.db.commit()
        return {"product_id": product_id, "variant_id": variant_id, "stock_qty": stock_qty}

    def reconstruct_model(self, product_id: str, front: UploadFile, side: UploadFile, back: UploadFile) -> dict:
        """Send three 2D images to Hunyuan 3D service, get GLB, upload to S3, and store path.
        Returns same dict as generate_model_upload_url (upload_url, s3_url, key)."""
        # Verify product exists
        if not self.db.query(Product).filter(Product.id == product_id).first():
            raise NotFoundError("Product not found")
        # Read files
        front_bytes = front.file.read()
        side_bytes = side.file.read()
        back_bytes = back.file.read()
        # Call external Hunyuan API (placeholder URL & auth)
        import requests
        hunyuan_url = "https://api.hunyuan.com/v1/garment/reconstruct"
        files = {
            "front": (front.filename, front_bytes, front.content_type),
            "side": (side.filename, side_bytes, side.content_type),
            "back": (back.filename, back_bytes, back.content_type),
        }
        # Assume API token in env
        headers = {"Authorization": f"Bearer {settings.hunyuan_api_key}"}
        resp = requests.post(hunyuan_url, files=files, headers=headers)
        if resp.status_code != 200:
            raise InternalError(f"Hunyuan reconstruction failed: {resp.text}")
        glb_bytes = resp.content
        # Generate S3 presigned URL for temporary upload
        filename = f"{product_id}_reconstructed.glb"
        presigned = self.generate_model_upload_url(product_id, filename, "model/gltf-binary")
        # Upload GLB to S3 using the presigned URL
        upload_resp = requests.put(presigned["upload_url"], data=glb_bytes, headers={"Content-Type": "model/gltf-binary"})
        if upload_resp.status_code not in (200, 201):
            raise InternalError(f"Failed to upload GLB to S3: {upload_resp.text}")
        # Update product model_path
        product = self.db.query(Product).filter(Product.id == product_id).first()
        product.model_path = presigned["s3_url"]
        self.db.commit()
        return presigned

        if not self.db.query(Product).filter(Product.id == product_id).first():
            raise NotFoundError("Product not found")
        s3 = boto3.client("s3", region_name=settings.aws_default_region)
        safe_filename = "".join(c for c in filename if c.isalnum() or c in "._-")
        key = f"catalog/{product_id}_{safe_filename}"
        bucket = settings.aws_s3_bucket
        try:
            presigned_url = s3.generate_presigned_url(
                ClientMethod="put_object",
                Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
                ExpiresIn=3600,
            )
        except ClientError as exc:
            raise InternalError(str(exc))
        dest_url = (
            f"https://{bucket}.s3.{settings.aws_default_region}.amazonaws.com/{key}"
        )
        return {"upload_url": presigned_url, "s3_url": dest_url, "key": key}
