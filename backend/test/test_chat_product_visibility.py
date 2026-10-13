"""Chat product tools must only expose published products, to every caller."""

from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
import app.models  # noqa: F401  (register all tables)
from app.models.category import Category
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.user import User
from app.services.chat_tools import execute_tool

SECRET_NAME = "Unreleased Draft Saree"
SECRET_DESC = "secret-draft-description"


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Category(id="cat", name="Sarees", slug="sarees"))
        session.add(User(id="admin", email="admin@example.com", hashed_password="x", role="admin"))
        session.flush()
        for pid, name, published, desc in [
            ("pub", "Public Saree", True, "public"),
            ("draft", SECRET_NAME, False, SECRET_DESC),
        ]:
            session.add(Product(id=pid, category_id="cat", name=name, price_mrp=Decimal("200"),
                                price_selling=Decimal("150"), description=desc,
                                is_published=published))
            session.flush()
            session.add(ProductVariant(product_id=pid, sku=f"{pid}-M", size="M", stock_qty=7))
            session.add(ProductVariant(product_id=pid, sku=f"{pid}-L", size="L", stock_qty=0))
        session.commit()
        yield session


CALLERS = [None, "admin"]


@pytest.mark.parametrize("user_id", CALLERS)
def test_published_product_details_visible(db, user_id):
    res = execute_tool("get_product_details", {"product_id": "pub"}, db=db, user_id=user_id)
    assert res["name"] == "Public Saree"
    assert {s["size"]: s["quantity"] for s in res["sizes"]} == {"M": 7, "L": 0}


@pytest.mark.parametrize("user_id", CALLERS)
def test_unpublished_product_details_hidden_like_missing(db, user_id):
    res = execute_tool("get_product_details", {"product_id": "draft"}, db=db, user_id=user_id)
    missing = execute_tool("get_product_details", {"product_id": "nope"}, db=db, user_id=user_id)
    assert "error" in res and "name" not in res
    assert SECRET_NAME not in str(res) and SECRET_DESC not in str(res)
    assert res["error"].replace("draft", "X") == missing["error"].replace("nope", "X")


@pytest.mark.parametrize("user_id", CALLERS)
def test_published_inventory_exact_variants(db, user_id):
    m = execute_tool("check_inventory", {"product_id": "pub", "size": "m"}, db=db, user_id=user_id)
    assert (m["available"], m["stock"]) == (True, 7)
    l = execute_tool("check_inventory", {"product_id": "pub", "size": "L"}, db=db, user_id=user_id)
    assert (l["available"], l["stock"]) == (False, 0)
    all_ = execute_tool("check_inventory", {"product_id": "pub"}, db=db, user_id=user_id)
    assert all_["total_stock"] == 7 and all_["size_breakdown"] == {"M": 7, "L": 0}


@pytest.mark.parametrize("user_id", CALLERS)
@pytest.mark.parametrize("size", [None, "M", "L", "XL"])
def test_unpublished_inventory_hidden(db, user_id, size):
    args = {"product_id": "draft", **({"size": size} if size else {})}
    res = execute_tool("check_inventory", args, db=db, user_id=user_id)
    assert "error" in res
    for leaked in ("stock", "total_stock", "size_breakdown", "available", "product"):
        assert leaked not in res
    assert SECRET_NAME not in str(res)


def test_unpublishing_after_publish_hides_product(db):
    assert "name" in execute_tool("get_product_details", {"product_id": "pub"}, db=db)
    db.get(Product, "pub").is_published = False
    db.commit()
    assert "error" in execute_tool("get_product_details", {"product_id": "pub"}, db=db)
    assert "error" in execute_tool("check_inventory", {"product_id": "pub", "size": "M"}, db=db)
