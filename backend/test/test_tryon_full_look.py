import asyncio
from io import BytesIO
from pathlib import Path
import uuid

from fastapi import UploadFile
from PIL import Image

from app.core.config import settings
from app.db.database import SessionLocal
from app.models.category import Category
from app.models.product import Product
from app.models.product_image import ProductImage
from app.services.tryon_service import TryonService


def _image_bytes():
    buffer = BytesIO()
    Image.new("RGB", (64, 96), (170, 210, 125)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_storefront_combo_uses_full_look_reference_for_uploaded_person(monkeypatch, tmp_path):
    upload_dir = tmp_path / "uploads"
    results_dir = tmp_path / "results"
    product_dir = upload_dir / "products"
    product_dir.mkdir(parents=True)
    for filename in ("top.webp", "bottom.webp", "full-look.webp"):
        (product_dir / filename).write_bytes(_image_bytes())
    monkeypatch.setattr(settings, "upload_dir", str(upload_dir))
    monkeypatch.setattr(settings, "results_dir", str(results_dir))

    db = SessionLocal()
    suffix = uuid.uuid4().hex[:8]
    category = Category(id=f"category-{suffix}", slug=f"test-{suffix}", name="Women")
    product = Product(
        id=f"product-{suffix}", category_id=category.id, name="Test Skirt Set",
        price_mrp=1000, price_selling=1000,
    )
    product.images.append(ProductImage(
        id=f"image-{suffix}", product_id=product.id,
        s3_url="/user_uploads/products/full-look.webp", display_order=2, tryon_role="set",
    ))
    db.add_all([category, product])
    db.commit()

    calls = []

    def fake_run_fashn(person_image_path, garment_image_path, garment_type, results_dir, **kwargs):
        calls.append((Path(person_image_path), Path(garment_image_path), garment_type, kwargs))
        result = Path(results_dir) / "adaptive-result.png"
        result.parent.mkdir(parents=True, exist_ok=True)
        result.write_bytes(b"result")
        return str(result)

    monkeypatch.setattr("app.services.fashn_service.run_fashn", fake_run_fashn)
    person_upload = UploadFile(filename="person.png", file=BytesIO(_image_bytes()))
    top_path = "/user_uploads/products/top.webp"
    bottom_path = "/user_uploads/products/bottom.webp"

    try:
        result = asyncio.run(
            TryonService(db).try_on_combo(
                person_upload, top_path, bottom_path, product_id=product.id,
            )
        )
        assert result["category_used"] == "adaptive full-look reference"
        assert len(calls) == 1
        assert calls[0][1] == product_dir / "full-look.webp"
        assert calls[0][2] == "one-pieces"
        assert calls[0][3]["garment_photo_type"] == "model"
        assert calls[0][3]["segmentation_free"] is True
        assert (results_dir / "adaptive-result.png").is_file()
    finally:
        db.delete(product)
        db.delete(category)
        db.commit()
        db.close()
