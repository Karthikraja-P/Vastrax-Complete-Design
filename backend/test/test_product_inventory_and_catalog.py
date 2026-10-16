"""Product inventory identity and catalog metadata regressions."""
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.main  # noqa: F401
from app.core.exceptions import BadRequestError, ForbiddenError
from app.db.base import Base
from app.models.address import Address
from app.models.category import Category
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.review import ProductReview
from app.models.user import User
from app.schemas.products import ProductUpdate, ProductVariantCreate
from app.services.product_service import ProductService


@pytest.fixture()
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path}/products.db")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    engine.dispose()


def _product(db, *, rating_average=Decimal("4.80"), rating_count=15):
    category = Category(id="cat", name="Clothing", slug="clothing")
    product = Product(
        id="p-1", category_id=category.id, name="Test Shirt",
        price_mrp=Decimal("100"), price_selling=Decimal("90"),
        rating_average=rating_average, rating_count=rating_count,
    )
    db.add_all([category, product])
    db.commit()
    return product


def test_removed_order_variant_keeps_id_and_is_marked_out_of_stock(db):
    product = _product(db)
    variant = ProductVariant(id="size-s", product_id=product.id, sku="shirt-s", size="S", stock_qty=8)
    user = User(email="buyer@example.test", hashed_password="test", role="customer")
    db.add_all([variant, user])
    db.flush()
    address = Address(
        user_id=user.id, label="Home", address_line1="1 Test Road",
        city="Mumbai", state="MH", pincode="400001",
    )
    db.add(address)
    db.flush()
    order = Order(id="order-1", user_id=user.id, address_id=address.id, total_amount=Decimal("90"))
    db.add(order)
    db.flush()
    db.add(OrderItem(
        order_id=order.id, product_id=product.id, variant_id=variant.id,
        quantity=1, unit_price=Decimal("90"),
    ))
    db.commit()

    ProductService(db).update_product(product.id, ProductUpdate(variants=[
        ProductVariantCreate(sku="shirt-m", size="M", stock_qty=3),
    ]))

    db.expire_all()
    saved_size_s = db.get(ProductVariant, variant.id)
    assert saved_size_s is not None
    assert saved_size_s.stock_qty == 0
    assert db.query(OrderItem).filter_by(variant_id=variant.id).count() == 1
    assert db.query(ProductVariant).filter_by(product_id=product.id, size="M", stock_qty=3).count() == 1


def test_catalog_rating_is_calculated_from_real_reviews(db):
    product = _product(db)
    user_a = User(email="a@example.test", hashed_password="test", role="customer")
    user_b = User(email="b@example.test", hashed_password="test", role="customer")
    db.add_all([user_a, user_b])
    db.flush()
    db.add_all([
        ProductReview(product_id=product.id, user_id=user_a.id, user_name="A", rating=3),
        ProductReview(product_id=product.id, user_id=user_b.id, user_name="B", rating=5),
    ])
    db.commit()

    response = ProductService(db)._to_response(db.get(Product, product.id))
    assert response.rating_count == 2
    assert response.rating_average == Decimal("4.00")


def test_only_delivered_buyers_can_review_product_once(db):
    product = _product(db)
    user = User(email="buyer@example.test", hashed_password="test", role="customer")
    db.add(user)
    db.flush()
    address = Address(user_id=user.id, label="Home", address_line1="1 Test Road", city="Mumbai", state="MH", pincode="400001")
    variant = ProductVariant(id="size-s-review", product_id=product.id, sku="shirt-s-review", size="S", stock_qty=1)
    db.add_all([address, variant])
    db.flush()
    order = Order(id="order-review", user_id=user.id, address_id=address.id, total_amount=Decimal("90"), status="shipped")
    db.add(order)
    db.flush()
    db.add(OrderItem(order_id=order.id, product_id=product.id, variant_id=variant.id, quantity=1, unit_price=Decimal("90")))
    db.commit()

    service = ProductService(db)
    with pytest.raises(ForbiddenError):
        service.add_review(product.id, user, 5, "Great fit")
    assert service.review_eligibility(product.id, user) == {"eligible": False, "already_reviewed": False}

    order.status = "delivered"
    db.commit()
    assert service.review_eligibility(product.id, user) == {"eligible": True, "already_reviewed": False}
    service.add_review(product.id, user, 5, "Great fit")
    assert service.review_eligibility(product.id, user) == {"eligible": False, "already_reviewed": True}
    with pytest.raises(BadRequestError):
        service.add_review(product.id, user, 4, "Second review")


def test_invalid_category_does_not_create_a_placeholder(db):
    service = ProductService(db)
    with pytest.raises(BadRequestError):
        service._resolve_category_id("")
    assert db.query(Category).count() == 0
