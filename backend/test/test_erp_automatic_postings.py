"""Automatic bookkeeping stays linked to source payments, orders, and refunds."""
from decimal import Decimal
import uuid

from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.main import app
from app.models.address import Address
from app.models.ledger import JournalEntry, JournalLine, LedgerAccount
from app.models.order import Order
from app.models.payment import Payment
from app.models.user import User
from app.services.order_service import OrderService
from app.services.payment_service import PaymentService


def _accounts(db, suffix):
    accounts = [
        LedgerAccount(code=f"POST-CASH-{suffix}", name="Processor clearing", account_type="asset"),
        LedgerAccount(code=f"POST-ADV-{suffix}", name="Customer advances", account_type="liability"),
        LedgerAccount(code=f"POST-SALES-{suffix}", name="Sales", account_type="revenue"),
        LedgerAccount(code=f"POST-RET-{suffix}", name="Sales returns", account_type="expense"),
    ]
    db.add_all(accounts)
    db.flush()
    return accounts


def test_payment_delivery_and_refund_post_once_and_reconcile(monkeypatch):
    suffix = uuid.uuid4().hex[:8]
    db = SessionLocal()
    admin = User(id=f"posting-admin-{suffix}", email=f"posting-admin-{suffix}@example.test", hashed_password="test", role="admin", is_active=True)
    customer = User(id=f"posting-customer-{suffix}", email=f"posting-customer-{suffix}@example.test", hashed_password="test", role="customer", is_active=True)
    address = Address(id=f"posting-address-{suffix}", user_id=customer.id, label="Home", address_line1="1 Test Road", city="Chennai", state="Tamil Nadu", pincode="600001")
    order = Order(id=f"POST-{suffix}", user_id=customer.id, address_id=address.id, total_amount=Decimal("100.00"), status="pending", payment_status="pending")
    payment = Payment(id=f"TXN-POST-{suffix}", order_id=order.id, user_id=customer.id, amount=Decimal("100.00"), method="Card", status="pending")
    db.add_all([admin, customer, address, order, payment])
    accounts = _accounts(db, suffix)
    db.commit()
    ids = [account.id for account in accounts]
    token = create_access_token({"sub": admin.id})
    db.close()

    client = TestClient(app)
    headers = {"Authorization": f"Bearer {token}"}
    mapping = {
        "payment_clearing_account_id": ids[0],
        "customer_advances_account_id": ids[1],
        "sales_revenue_account_id": ids[2],
        "sales_returns_account_id": ids[3],
    }
    monkeypatch.setattr("app.services.order_service._book_shiprocket", lambda *args, **kwargs: None)
    monkeypatch.setattr("app.services.order_service.send_order_email_notification", lambda *args, **kwargs: None)
    db = SessionLocal()
    payment = db.get(Payment, f"TXN-POST-{suffix}")
    PaymentService(db)._mark_payment_success(payment)
    db.close()
    status = client.get("/api/v1/erp/postings/status", headers=headers)
    assert status.status_code == 200 and status.json()["unposted_receipts"] >= 1
    assert client.post("/api/v1/erp/postings/reconcile", headers=headers).status_code == 409

    configured = client.put("/api/v1/erp/posting-settings", headers=headers, json=mapping)
    assert configured.status_code == 200, configured.text
    reconciled = client.post("/api/v1/erp/postings/reconcile", headers=headers)
    assert reconciled.status_code == 200, reconciled.text
    assert reconciled.json()["status"]["unposted_receipts"] == 0
    wrong_type = client.put("/api/v1/erp/posting-settings", headers=headers, json={**mapping, "sales_revenue_account_id": ids[0]})
    assert wrong_type.status_code == 422

    db = SessionLocal()
    assert db.query(JournalEntry).filter_by(source_key=f"payment-receipt:TXN-POST-{suffix}").count() == 1
    posted = OrderService(db).admin_update_status(f"POST-{suffix}", "delivered")
    assert posted.status == "delivered"
    assert db.query(JournalEntry).filter_by(source_key=f"order-revenue:TXN-POST-{suffix}").count() == 1
    db.close()

    db = SessionLocal()
    payment = db.get(Payment, f"TXN-POST-{suffix}")
    refund = PaymentService(db).process_refund(payment.id, Decimal("25.00"), created_by_id=f"posting-admin-{suffix}")
    assert refund["status"] == "partially_refunded"
    payment = db.get(Payment, f"TXN-POST-{suffix}")
    assert payment.status == "partially_refunded"
    PaymentService(db)._mark_payment_success(payment)  # duplicate captured event must not undo a refund
    assert payment.status == "partially_refunded"
    result = client.post("/api/v1/erp/postings/reconcile", headers=headers)
    assert result.status_code == 200, result.text
    assert result.json()["posted"] == {"receipts": 0, "sales": 0, "refunds": 0, "cogs": 0}
    assert db.query(JournalEntry).filter_by(source_key=f"payment-refund:{refund['refund_id']}").count() == 1
    lines = db.query(JournalLine).join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id).filter(
        JournalEntry.source_key == f"payment-refund:{refund['refund_id']}"
    ).all()
    assert len(lines) == 2
    assert {line.account_id: (Decimal(line.debit), Decimal(line.credit)) for line in lines} == {
        ids[3]: (Decimal("25.00"), Decimal("0.00")),
        ids[0]: (Decimal("0.00"), Decimal("25.00")),
    }
    assert sum((Decimal(line.debit) for line in lines), Decimal("0.00")) == sum((Decimal(line.credit) for line in lines), Decimal("0.00"))
    db.close()


def test_additive_migration_adds_unique_source_key_to_existing_journal_table():
    from sqlalchemy import create_engine, inspect, text
    from app.db.ensure_schema import ensure_columns

    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE erp_journal_entries (id VARCHAR(36) PRIMARY KEY, posting_date DATE NOT NULL, "
            "description VARCHAR(255) NOT NULL, reference VARCHAR(100), created_by VARCHAR(36) NOT NULL, created_at DATETIME NOT NULL)"
        ))
    ensure_columns(engine)
    columns = {column["name"] for column in inspect(engine).get_columns("erp_journal_entries")}
    assert "source_key" in columns
    indexes = inspect(engine).get_indexes("erp_journal_entries")
    assert any(index["name"] == "uq_erp_journal_source_key" and index["unique"] for index in indexes)
    engine.dispose()


def test_cod_cash_collection_posts_payment_and_delivery_once():
    from app.models.erp_posting_config import ERPPostingConfig
    from app.services.order_service import OrderService

    suffix = uuid.uuid4().hex[:8]
    db = SessionLocal()
    admin = User(id=f"cod-admin-{suffix}", email=f"cod-admin-{suffix}@example.test", hashed_password="test", role="admin", is_active=True)
    customer = User(id=f"cod-customer-{suffix}", email=f"cod-customer-{suffix}@example.test", hashed_password="test", role="customer", is_active=True)
    address = Address(id=f"cod-address-{suffix}", user_id=customer.id, label="Home", address_line1="1 Test Road", city="Chennai", state="Tamil Nadu", pincode="600001")
    order = Order(id=f"COD-ORDER-{suffix}", user_id=customer.id, address_id=address.id, total_amount=Decimal("80.00"), status="delivered", payment_status="pending", payment_method="Cash on Delivery")
    payment = Payment(id=f"COD-{order.id}", order_id=order.id, user_id=customer.id, amount=Decimal("80.00"), method="COD", status="pending")
    accounts = _accounts(db, suffix)
    config = db.get(ERPPostingConfig, "default")
    if config:
        config.payment_clearing_account_id = accounts[0].id
        config.customer_advances_account_id = accounts[1].id
        config.sales_revenue_account_id = accounts[2].id
        config.sales_returns_account_id = accounts[3].id
        config.updated_by = admin.id
    else:
        config = ERPPostingConfig(id="default", payment_clearing_account_id=accounts[0].id,
                                  customer_advances_account_id=accounts[1].id, sales_revenue_account_id=accounts[2].id,
                                  sales_returns_account_id=accounts[3].id, updated_by=admin.id)
        db.add(config)
    db.add_all([admin, customer, address, order, payment])
    db.commit()

    first = OrderService(db).mark_cod_collected(order.id, admin)
    assert first["payment_status"] == "paid" and first["already_collected"] is False
    second = OrderService(db).mark_cod_collected(order.id, admin)
    assert second["already_collected"] is True
    assert db.query(JournalEntry).filter_by(source_key=f"payment-receipt:{payment.id}").count() == 1
    assert db.query(JournalEntry).filter_by(source_key=f"order-revenue:{payment.id}").count() == 1
    payment = db.get(Payment, payment.id)
    assert payment.status == "success"
    assert db.get(Order, order.id).payment_status == "paid"
    db.close()
