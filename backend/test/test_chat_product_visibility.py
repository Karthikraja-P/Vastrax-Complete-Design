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
                                hem_length="ankle length" if pid == "pub" else None,
                                product_details="Length: ankle length; sleeves: sleeveless" if pid == "pub" else SECRET_DESC,
                                how_to_style="Pair with sandals" if pid == "pub" else SECRET_DESC,
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


def test_catalog_context_includes_structured_garment_facts_and_marks_sizes_unverified(db):
    from app.services.chat_service import _get_catalog_context

    context = _get_catalog_context(db)
    assert 'Hem length (exact stored value; do not infer if not specified): "ankle length"' in context
    assert 'Product details data: "Length: ankle length; sleeves: sleeveless"' in context
    assert 'How-to-style data: "Pair with sandals"' in context
    assert "Size options (not stock status; use check_inventory for availability)" in context
    assert SECRET_NAME not in context
    assert SECRET_DESC not in context


def test_stylist_prompt_prioritizes_current_question_and_prohibits_length_guessing():
    from app.services.chat_service import _STYLING_RULES, _SYSTEM_PROMPT_TEMPLATE

    prompt = _STYLING_RULES + _SYSTEM_PROMPT_TEMPLATE
    assert "standalone question on a new/general topic must get a fresh answer" in prompt
    assert '"maxi" or "frock" does not establish' in prompt
    assert "Call check_inventory before any current stock or size-availability claim" in prompt
    assert "never restart with a greeting or generic introduction" in prompt
    assert "do not name or card a product" in prompt
    assert "as hard constraints" in prompt


@pytest.mark.parametrize("message", [
    "General tips only; no product recommendation.",
    "No product recommendations, please.",
    "Do not recommend any products.",
])
def test_explicit_general_advice_request_is_detected(message):
    from app.services.chat_service import _explicitly_requests_no_products

    assert _explicitly_requests_no_products([{"role": "user", "content": message}])


def test_response_constraints_remove_repeated_greeting_products_chips_and_closing_question():
    from app.services.chat_service import _apply_stylist_response_constraints

    messages = [
        {"role": "assistant", "content": "Earlier answer"},
        {"role": "user", "content": "General tips only; no product recommendation."},
    ]
    reply = (
        "Vastra here! Practical tips: try tonal dressing.\n"
        "Vertical stripes can create a longer line.\n"
        "Would you like a product suggestion? [PRODUCT:vtx-example] [CHIPS:Browse|Shop]"
    )
    cleaned = _apply_stylist_response_constraints(reply, messages)
    assert cleaned == "Practical tips: try tonal dressing.\nVertical stripes can create a longer line."
    assert "PRODUCT:" not in cleaned and "CHIPS:" not in cleaned and "?" not in cleaned


def test_first_stylist_reply_keeps_welcome():
    from app.services.chat_service import _apply_stylist_response_constraints

    reply = "Welcome in! How can I help?"
    assert _apply_stylist_response_constraints(
        reply, [{"role": "user", "content": "Hello"}]
    ) == reply
