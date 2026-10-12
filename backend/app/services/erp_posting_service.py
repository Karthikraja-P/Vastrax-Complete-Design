"""Idempotent double-entry postings derived from Vastrax payment/order/refund records."""
from datetime import date
from decimal import Decimal, ROUND_FLOOR, ROUND_HALF_UP
import logging

from sqlalchemy.orm import Session

from app.models.erp_posting_config import ERPPostingConfig
from app.models.ledger import JournalEntry, JournalLine, LedgerAccount
from app.models.order import Order
from app.models.business import ERPInventoryCostingConfig, ERPInventoryCostLayer, ERPInventoryCostConsumption
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


def _inventory_costing_config(db: Session) -> ERPInventoryCostingConfig | None:
    config = db.get(ERPInventoryCostingConfig, "default")
    if not config or config.cost_method not in {"fifo", "moving_average"}:
        return None
    inventory = db.get(LedgerAccount, config.inventory_account_id)
    cogs = db.get(LedgerAccount, config.cogs_account_id)
    if not inventory or not inventory.is_active or inventory.account_type != "asset":
        return None
    if not cogs or not cogs.is_active or cogs.account_type != "expense":
        return None
    return config


def _allocate_cost_layers(layers, remaining, costs, quantity: int, method: str):
    available = sum(remaining[layer.id] for layer in layers)
    if quantity <= 0 or available < quantity:
        return None
    if method == "fifo":
        allocations = []
        left = quantity
        for layer in layers:
            take = min(left, remaining[layer.id])
            if take:
                unit_cost = costs[layer.id]
                allocations.append({"layer": layer, "quantity": take, "unit_cost": unit_cost,
                                   "total_cost": (unit_cost * take).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)})
                remaining[layer.id] -= take
                left -= take
            if not left:
                break
        return allocations

    inventory_value = sum((Decimal(remaining[layer.id]) * costs[layer.id] for layer in layers), Decimal("0"))
    average = (inventory_value / Decimal(available)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    shares = []
    allocated = 0
    for layer in layers:
        exact = Decimal(quantity * remaining[layer.id]) / Decimal(available)
        units = int(exact.to_integral_value(rounding=ROUND_FLOOR))
        shares.append([layer, units, exact - units])
        allocated += units
    remainder = quantity - allocated
    for row in sorted(shares, key=lambda item: (-item[2], item[0].created_at, item[0].id))[:remainder]:
        row[1] += 1
    total_cost = (average * quantity).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    allocations = []
    for layer, units, _ in shares:
        if not units:
            continue
        allocations.append({"layer": layer, "quantity": units, "unit_cost": average,
                            "total_cost": (average * units).quantize(Decimal("0.01"), rounding=ROUND_FLOOR)})
        remaining[layer.id] -= units
    if allocations:
        allocations[-1]["total_cost"] = total_cost - sum((row["total_cost"] for row in allocations[:-1]), Decimal("0"))
    return allocations


def post_order_cogs(db: Session, order: Order) -> bool:
    """Post COGS once for a delivered order, only after explicit costing setup."""
    if order.status != "delivered":
        return False
    source_key = f"order-cogs:{order.id}"
    if _entry(db, source_key):
        return False
    if db.query(ERPInventoryCostConsumption.id).join(
        ERPInventoryCostLayer, ERPInventoryCostLayer.id == ERPInventoryCostConsumption.cost_layer_id
    ).filter(ERPInventoryCostConsumption.order_item_id.in_([item.id for item in order.items])).first():
        logger.error("COGS posting skipped: found cost consumption without its source journal (%s)", order.id)
        return False
    config = _inventory_costing_config(db)
    if not config:
        return False

    item_plans = []
    remaining_by_layer = {}
    cost_by_layer = {}
    layers_by_variant = {}
    for item in order.items:
        layers = layers_by_variant.get(item.variant_id)
        if layers is None:
            layers = db.query(ERPInventoryCostLayer).filter(
                ERPInventoryCostLayer.variant_id == item.variant_id,
                ERPInventoryCostLayer.remaining_quantity > 0,
            ).order_by(ERPInventoryCostLayer.created_at, ERPInventoryCostLayer.id).with_for_update().all()
            layers_by_variant[item.variant_id] = layers
            for layer in layers:
                remaining_by_layer[layer.id] = int(layer.remaining_quantity)
                cost_by_layer[layer.id] = Decimal(layer.unit_cost)
        allocations = _allocate_cost_layers(layers, remaining_by_layer, cost_by_layer, int(item.quantity), config.cost_method)
        if allocations is None:
            logger.warning("COGS posting skipped: insufficient valued stock for delivered order %s", order.id)
            return False
        item_plans.append((item, allocations))
        if config.cost_method == "moving_average":
            remaining_units = sum(remaining_by_layer[layer.id] for layer in layers)
            remaining_value = sum((Decimal(remaining_by_layer[layer.id]) * cost_by_layer[layer.id] for layer in layers), Decimal("0"))
            if remaining_units:
                new_average = (remaining_value / Decimal(remaining_units)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                for layer in layers:
                    if remaining_by_layer[layer.id] > 0:
                        cost_by_layer[layer.id] = new_average

    total_cost = sum((row["total_cost"] for _, allocations in item_plans for row in allocations), Decimal("0.00"))
    for layers in layers_by_variant.values():
        for layer in layers:
            layer.remaining_quantity = remaining_by_layer[layer.id]
            if config.cost_method == "moving_average" and remaining_by_layer[layer.id] > 0:
                layer.unit_cost = cost_by_layer[layer.id]

    journal_entry_id = None
    if total_cost > 0:
        entry = JournalEntry(
            posting_date=(order.updated_at.date() if order.updated_at else date.today()),
            description=f"Cost of goods sold for delivered order {order.id}",
            reference=order.id,
            source_key=source_key,
            created_by=order.user_id,
        )
        db.add(entry)
        db.flush()
        journal_entry_id = entry.id
        db.add_all([
            JournalLine(journal_entry_id=entry.id, account_id=config.cogs_account_id, debit=total_cost, credit=0,
                        memo=f"{config.cost_method} cost for order {order.id}"),
            JournalLine(journal_entry_id=entry.id, account_id=config.inventory_account_id, debit=0, credit=total_cost,
                        memo=f"Inventory relieved for order {order.id}"),
        ])
    for item, allocations in item_plans:
        db.add_all([
            ERPInventoryCostConsumption(
                order_item_id=item.id,
                cost_layer_id=row["layer"].id,
                quantity=row["quantity"],
                unit_cost=row["unit_cost"],
                total_cost=row["total_cost"],
                journal_entry_id=journal_entry_id,
            )
            for row in allocations
        ])
    return True


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
    counts = {"receipts": 0, "sales": 0, "refunds": 0, "cogs": 0}
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
    for order in db.query(Order).filter(Order.status == "delivered").order_by(Order.placed_at, Order.id).all():
        counts["cogs"] += int(post_order_cogs(db, order))
    return counts
