import base64
from io import BytesIO

import pytest
from PIL import Image

from app.core.exceptions import BadRequestError
from app.services import product_image_storage


def _data_url() -> str:
    image = Image.new("RGB", (1200, 900), (228, 220, 205))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def test_base64_upload_becomes_small_static_webp(monkeypatch, tmp_path):
    monkeypatch.setattr(product_image_storage.settings, "upload_dir", str(tmp_path))
    url = product_image_storage.store_product_image(_data_url())
    assert url.startswith("/user_uploads/products/")
    output = tmp_path / url.removeprefix("/user_uploads/")
    with Image.open(output) as stored:
        assert stored.format == "WEBP"
        assert stored.size == (1200, 900)
    assert output.stat().st_size < 100_000


def test_remote_image_url_is_preserved():
    url = "https://cdn.example.test/product.jpg"
    assert product_image_storage.store_product_image(url) == url


def test_unsupported_data_url_is_rejected():
    with pytest.raises(BadRequestError):
        product_image_storage.store_product_image("data:image/svg+xml;base64,PHN2Zz4=")


def test_product_creation_requires_at_least_one_size():
    from pydantic import ValidationError
    from app.schemas.products import ProductCreate

    base = {
        "category_id": "cat", "name": "Dress",
        "price_mrp": 100, "price_selling": 100,
    }
    with pytest.raises(ValidationError):
        ProductCreate.model_validate(base)
    with pytest.raises(ValidationError):
        ProductCreate.model_validate({**base, "variants": []})


def test_product_size_cannot_be_blank():
    from pydantic import ValidationError
    from app.schemas.products import ProductVariantCreate

    with pytest.raises(ValidationError):
        ProductVariantCreate(sku="sku", size="   ")


def test_product_update_cannot_remove_all_sizes():
    from pydantic import ValidationError
    from app.schemas.products import ProductUpdate

    with pytest.raises(ValidationError):
        ProductUpdate.model_validate({"variants": []})
