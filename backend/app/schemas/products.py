from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ProductImageCreate(BaseModel):
    s3_url: str
    display_order: int = 0


class ProductImageResponse(BaseModel):
    id: str
    s3_url: str
    display_order: int

    model_config = ConfigDict(from_attributes=True)


class ProductVariantCreate(BaseModel):
    sku: str
    size: str
    stock_qty: int = 0


class ProductVariantResponse(BaseModel):
    id: str
    sku: str
    size: str
    stock_qty: int

    model_config = ConfigDict(from_attributes=True)


class ProductCreate(BaseModel):
    category_id: str
    name: str
    fabric: Optional[str] = None
    colour: Optional[str] = None
    price_mrp: Decimal
    price_selling: Decimal
    description: Optional[str] = None
    is_featured: bool = False
    is_published: bool = True
    model_path: Optional[str] = None  # URL or S3 key for 3D model
    images: list[ProductImageCreate] = []
    variants: list[ProductVariantCreate] = []


class ProductUpdate(BaseModel):
    category_id: Optional[str] = None
    name: Optional[str] = None
    fabric: Optional[str] = None
    colour: Optional[str] = None
    price_mrp: Optional[Decimal] = None
    price_selling: Optional[Decimal] = None
    description: Optional[str] = None
    is_featured: Optional[bool] = None
    is_published: Optional[bool] = None
    images: Optional[list[ProductImageCreate]] = None
    variants: Optional[list[ProductVariantCreate]] = None


class ProductResponse(BaseModel):
    id: str
    category_id: str
    name: str
    fabric: str | None
    colour: str | None
    price_mrp: Decimal
    price_selling: Decimal
    description: str | None
    is_featured: bool
    is_published: bool
    created_at: datetime
    updated_at: datetime
    images: list[ProductImageResponse] = []
    variants: list[ProductVariantResponse] = []

    model_config = ConfigDict(from_attributes=True)


class StockUpdateIn(BaseModel):
    variant_id: str
    stock_qty: int


class ImageUploadIn(BaseModel):
    filename: str
    content_type: str
class ModelUploadIn(BaseModel):
    filename: str
    content_type: str

