"""Idempotent double-entry postings derived from Vastrax payment/order/refund records."""
from datetime import date
from decimal import Decimal
import logging

from sqlalchemy.orm import Session

from app.models.erp_posting_config import ERPPostingConfig
from app.models.ledger import JournalEntry, JournalLine, LedgerAccount
from app.models.order import Order
from app.models.payment import Payment
from app.models.payment_refund import PaymentRefund

logger = logging.getLogger(__name__)


def _config(db: Session) -> ERPPostingConfig | None:
    config = db.get(ERPPostingConfig, "default")
    if not config:
        return None
    roles = (
        (config.payment_clearing_account_id, "asset"),
        (config.customer_advances_account_id, "liability"),
        (config.sales_revenue_account_id, "revenue"),
        (config.sales_returns_account_id, "expense"),
    )
    for account_id, expected_type in roles:
        account = db.get(LedgerAccount, account_id)
        if not account or not account.is_active or account.account_type != expected_type:
            logger.warning("ERP posting skipped: invalid or inactive account mapping (%s)", expected_type)
            return None
    return config


def _entry(db: Session, source_key: str) -> JournalEntry | None:
    return db.query(JournalEntry).filter(JournalEntry.source_key == source_key).first()


def post_payment_receipt(db: Session, payment: Payment) -> bool:
    if payment.status not in ("success", "partially_refunded", "refunded"):
        return False
    source_key = f"payment-receipt:{payment.id}"
    if _entry(db, source_key):
        return False
    config = _config(db)
    if not config:
        return False
    amount = Decimal(payment.amount).quantize(Decimal("0.01"))
    if amount <= 0:
        return False
    entry = JournalEntry(
        posting_date=(payment.updated_at.date() if payment.updated_at else date.today()),
        description=f"Payment received for order {payment.order_id}",
        reference=payment.id,
        source_key=source_key,
        created_by=payment.user_id,
    )
    db.add(entry)
    db.flush()
    db.add_all([
        JournalLine(journal_entry_id=entry.id, account_id=config.payment_clearing_account_id, debit=amount, credit=0,
                    memo=f"Gross checkout receipt {payment.id}; tax not separated"),
        JournalLine(journal_entry_id=entry.id, account_id=config.customer_advances_account_id, debit=0, credit=amount,
                    memo="Customer advance pending order delivery"),
    ])
    return True


def post_order_revenue(db: Session, order: Order) -> int:
    if order.status != "delivered":
        return 0
    posted = 0
    for payment in order.payments:
        if payment.status not in ("success", "partially_refunded", "refunded"):
            continue
        post_payment_receipt(db, payment)
        source_key = f"order-revenue:{payment.id}"
        if _entry(db, source_key):
            continue
        config = _config(db)
        if not config:
            continue
        refunds = db.query(PaymentRefund).filter(
            PaymentRefund.payment_id == payment.id, PaymentRefund.status == "processed"
        ).all()
        net_amount = Decimal(payment.amount) - sum((Decimal(row.amount) for row in refunds), Decimal("0.00"))
        net_amount = net_amount.quantize(Decimal("0.01"))
        if net_amount <= 0:
            continue
        entry = JournalEntry(
            posting_date=(order.updated_at.date() if order.updated_at else date.today()),
            description=f"Revenue recognized for delivered order {order.id}",
            reference=payment.id,
            source_key=source_key,
            created_by=payment.user_id,
        )
        db.add(entry)
        db.flush()
        db.add_all([
            JournalLine(journal_entry_id=entry.id, account_id=config.customer_advances_account_id, debit=net_amount, credit=0,
                        memo="Release customer advance on delivery"),
            JournalLine(journal_entry_id=entry.id, account_id=config.sales_revenue_account_id, debit=0, credit=net_amount,
                        memo="Gross order amount; GST not split"),
        ])
        posted += 1
    return posted


def post_refund(db: Session, refund: PaymentRefund) -> bool:
    if refund.status != "processed":
        return False
    source_key = f"payment-refund:{refund.id}"
    if _entry(db, source_key):
        return False
    payment = db.get(Payment, refund.payment_id)
    if not payment:
        return False
    post_payment_receipt(db, payment)
    config = _config(db)
    if not config:
        return False
    amount = Decimal(refund.amount).quantize(Decimal("0.01"))
    if amount <= 0:
        return False
    was_recognized = _entry(db, f"order-revenue:{payment.id}") is not None
    debit_account_id = config.sales_returns_account_id if was_recognized else config.customer_advances_account_id
    entry = JournalEntry(
        posting_date=(refund.updated_at.date() if refund.updated_at else date.today()),
        description=f"Refund for payment {payment.id}",
        reference=refund.gateway_refund_id or refund.id,
        source_key=source_key,
        created_by=refund.created_by or payment.user_id,
    )
    db.add(entry)
    db.flush()
    db.add_all([
        JournalLine(journal_entry_id=entry.id, account_id=debit_account_id, debit=amount, credit=0,
                    memo="Processed refund"),
        JournalLine(journal_entry_id=entry.id, account_id=config.payment_clearing_account_id, debit=0, credit=amount,
                    memo="Refund returned to customer"),
    ])
    return True


def reconcile_postings(db: Session) -> dict[str, int]:
    counts = {"receipts": 0, "sales": 0, "refunds": 0}
    payments = db.query(Payment).filter(
        Payment.status.in_(("success", "partially_refunded", "refunded"))
    ).order_by(Payment.created_at, Payment.id).all()
    for payment in payments:
        counts["receipts"] += int(post_payment_receipt(db, payment))
        if payment.order and payment.order.status == "delivered":
            counts["sales"] += post_order_revenue(db, payment.order)
    refunds = db.query(PaymentRefund).filter(PaymentRefund.status == "processed").order_by(
        PaymentRefund.created_at, PaymentRefund.id
    ).all()
    for refund in refunds:
        counts["refunds"] += int(post_refund(db, refund))
    return counts
