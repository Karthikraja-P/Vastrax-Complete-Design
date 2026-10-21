from datetime import datetime
from decimal import Decimal
from typing import Optional, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProductImageCreate(BaseModel):
    s3_url: str
    display_order: int = 0
    tryon_role: Optional[Literal["top", "bottom", "gallery"]] = None


class ProductImageResponse(BaseModel):
    id: str
    s3_url: str
    display_order: int
    tryon_role: Literal["top", "bottom", "gallery"] | None = None

    model_config = ConfigDict(from_attributes=True)


class ProductVariantCreate(BaseModel):
    sku: str
    size: str = Field(min_length=1)
    stock_qty: int = Field(default=0, ge=0)

    @field_validator("size", mode="before")
    @classmethod
    def require_nonblank_size(cls, value: object) -> object:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("Each product variant must have a size.")
        return value.strip()


class ProductVariantResponse(BaseModel):
    id: str
    sku: str
    size: str
    stock_qty: int = Field(ge=0)

    model_config = ConfigDict(from_attributes=True)


class ProductCreate(BaseModel):
    category_id: str
    name: str
    fabric: Optional[str] = None
    colour: Optional[str] = None
    occasion: Optional[str] = None
    gender: Optional[str] = "Women"
    size_chart: Optional[Any] = None
    price_mrp: Decimal
    price_selling: Decimal
    description: Optional[str] = None
    rating_average: Optional[Decimal] = Decimal("0.00")
    rating_count: Optional[int] = 0
    is_featured: bool = False
    is_published: bool = True
    model_path: Optional[str] = None  # URL or S3 key for 3D model
    images: list[ProductImageCreate] = []
    variants: list[ProductVariantCreate] = Field(min_length=1)


class ProductUpdate(BaseModel):
    category_id: Optional[str] = None
    name: Optional[str] = None
    fabric: Optional[str] = None
    colour: Optional[str] = None
    occasion: Optional[str] = None
    gender: Optional[str] = None
    size_chart: Optional[Any] = None
    price_mrp: Optional[Decimal] = None
    price_selling: Optional[Decimal] = None
    description: Optional[str] = None
    rating_average: Optional[Decimal] = None
    rating_count: Optional[int] = None
    is_featured: Optional[bool] = None
    is_published: Optional[bool] = None
    model_path: Optional[str] = None
    images: Optional[list[ProductImageCreate]] = None
    variants: Optional[list[ProductVariantCreate]] = Field(default=None, min_length=1)


class ProductResponse(BaseModel):
    id: str
    category_id: str
    name: str
    fabric: str | None
    colour: str | None
    occasion: str | None
    gender: str | None = "Women"
    size_chart: Any | None = None
    price_mrp: Decimal
    price_selling: Decimal
    description: str | None
    stock: int = 0
    rating_average: Decimal = Decimal("0.00")
    rating_count: int = 0
    is_featured: bool
    is_published: bool
    created_at: datetime
    updated_at: datetime
    model_path: Optional[str] = None
    images: list[ProductImageResponse] = []
    variants: list[ProductVariantResponse] = []

    model_config = ConfigDict(from_attributes=True)


class StockUpdateIn(BaseModel):
    variant_id: str
    stock_qty: int = Field(ge=0)


class ImageUploadIn(BaseModel):
    filename: str
    content_type: str
class ModelUploadIn(BaseModel):
    filename: str
    content_type: str
