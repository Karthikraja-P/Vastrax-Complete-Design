"""Admin CRM and commerce ERP endpoints backed by Vastrax's existing records."""
from datetime import date, datetime, timezone
import hashlib
import json
from decimal import Decimal
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.db.database import get_db
from app.middleware.auth import require_business_permission
from app.models.business import CRMActivity, CRMLead, OperatingExpense, PurchaseOrder, PurchaseOrderLine, StockMovement, Supplier, SupplierPayment, SupplierExpensePayment, ERPInventoryReceipt, ERPPurchaseOrderRequest, ERPInventoryCostingConfig, ERPInventoryCostLayer, ERPInventoryCostConsumption
from app.models.ledger import JournalEntry, JournalLine, LedgerAccount
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.user import User
from app.models.support_ticket import SupportTicket
from app.models.marketing_consent import CRMMarketingConsentEvent
from app.models.business_team import BusinessTeamPermission

router = APIRouter(tags=["crm-erp"])


class LeadCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=40)
    source: str | None = Field(default=None, max_length=100)
    notes: str | None = None


class LeadUpdate(BaseModel):
    stage: Literal["new", "contacted", "qualified", "lost"]


class ActivityCreate(BaseModel):
    customer_id: str | None = None
    lead_id: str | None = None
    activity_type: Literal["note", "call", "email", "meeting", "task"] = "note"
    subject: str = Field(min_length=1, max_length=255)
    description: str | None = None
    due_at: datetime | None = None
    assigned_to: str | None = None


class SupportTicketUpdate(BaseModel):
    status: Literal["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] | None = None
    priority: Literal["LOW", "MEDIUM", "HIGH", "URGENT"] | None = None
    assigned_to: str | None = None


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    gstin: str | None = Field(default=None, max_length=20)
    address: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    contact_name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=40)
    gstin: str | None = Field(default=None, max_length=20)
    address: str | None = None
    is_active: bool | None = None


class PurchaseLineCreate(BaseModel):
    variant_id: str
    quantity: int = Field(gt=0, le=100000)
    unit_cost: Decimal = Field(ge=0, max_digits=10, decimal_places=2)


class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    expected_date: date | None = None
    notes: str | None = None
    items: list[PurchaseLineCreate] = Field(min_length=1)
    idempotency_key: str | None = Field(default=None, min_length=16, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


class ReceiptLine(BaseModel):
    line_id: str
    quantity: int = Field(gt=0, le=100000)


class PurchaseReceipt(BaseModel):
    items: list[ReceiptLine] = Field(min_length=1)
    inventory_account_id: str
    payable_account_id: str
    idempotency_key: str | None = Field(default=None, min_length=16, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


class StockAdjustment(BaseModel):
    quantity_delta: int
    reason: Literal["count_correction", "damaged", "returned", "other"]
    notes: str | None = None


class SupplierPaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    payment_date: date
    reference: str = Field(min_length=1, max_length=100)
    payable_account_id: str
    payment_account_id: str


class ExpenseCreate(BaseModel):
    category: str = Field(min_length=1, max_length=80)
    description: str = Field(min_length=1, max_length=255)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    supplier_id: str | None = None
    reference: str | None = Field(default=None, max_length=100)
    expense_date: date
    expense_account_id: str
    credit_account_id: str
    input_tax_account_id: str | None = None


@router.get("/crm/overview", dependencies=[Depends(require_business_permission("crm"))])
def crm_overview(db: Session = Depends(get_db)):
    open_leads = db.query(func.count(CRMLead.id)).filter(CRMLead.stage.notin_(["converted", "lost"])).scalar() or 0
    due_tasks = db.query(func.count(CRMActivity.id)).filter(
        CRMActivity.activity_type == "task", CRMActivity.completed_at.is_(None), CRMActivity.due_at <= datetime.now(timezone.utc)
    ).scalar() or 0
    customers = db.query(func.count(User.id)).filter(User.role == "customer", User.is_active.is_(True)).scalar() or 0
    activities = db.query(func.count(CRMActivity.id)).scalar() or 0
    return {"customers": customers, "open_leads": open_leads, "due_tasks": due_tasks, "logged_activities": activities}


@router.get("/crm/team-members", dependencies=[Depends(require_business_permission("crm"))])
def crm_team_members(db: Session = Depends(get_db)):
    crm_user_ids = select(BusinessTeamPermission.user_id).where(
        BusinessTeamPermission.permission == "crm"
    )
    users = db.query(User).filter(
        User.is_active.is_(True),
        or_(func.lower(User.role) == "admin", User.id.in_(crm_user_ids)),
    ).order_by(User.full_name, User.email).all()
    return [{"id": user.id, "full_name": user.full_name, "email": user.email} for user in users]


@router.get("/crm/customers", dependencies=[Depends(require_business_permission("crm"))])
def crm_customers(
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(
        User.id, User.full_name, User.email, User.phone_number, User.created_at,
        func.count(func.distinct(Order.id)).label("order_count"),
        func.coalesce(func.sum(case((Order.status != "cancelled", Order.total_amount), else_=0)), 0).label("lifetime_value"),
        func.max(Order.placed_at).label("last_order_at"),
    ).outerjoin(Order, Order.user_id == User.id).filter(User.role == "customer", User.is_active.is_(True)).group_by(User.id)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(or_(User.full_name.ilike(term), User.email.ilike(term), User.phone_number.ilike(term)))
    total = query.count()
    rows = query.order_by(User.created_at.desc(), User.id.asc()).offset(offset).limit(limit).all()
    items = [{"id": row.id, "full_name": row.full_name, "email": row.email, "phone": row.phone_number,
             "created_at": row.created_at, "order_count": row.order_count,
             "lifetime_value": str(row.lifetime_value or 0), "last_order_at": row.last_order_at} for row in rows]
    return {"items": items, "total": total, "limit": limit, "offset": offset, "has_more": offset + len(items) < total}


@router.get("/crm/customers/{customer_id}", dependencies=[Depends(require_business_permission("crm"))])
def crm_customer_detail(customer_id: str, db: Session = Depends(get_db)):
    customer = db.query(User).filter(User.id == customer_id, User.role == "customer").first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    orders = db.query(Order).filter(Order.user_id == customer.id).order_by(Order.placed_at.desc()).limit(100).all()
    order_ids = [order.id for order in orders]
    item_rows = []
    if order_ids:
        item_rows = db.query(OrderItem, Product.name, ProductVariant.size).join(
            Product, Product.id == OrderItem.product_id
        ).join(ProductVariant, ProductVariant.id == OrderItem.variant_id).filter(
            OrderItem.order_id.in_(order_ids)
        ).all()
    items_by_order: dict[str, list[dict]] = {}
    for item, product_name, size in item_rows:
        items_by_order.setdefault(item.order_id, []).append({
            "product_name": product_name, "size": size, "quantity": item.quantity,
            "unit_price": str(item.unit_price),
        })
    support_tickets = db.query(SupportTicket).filter(
        SupportTicket.user_id == customer.id
    ).order_by(SupportTicket.created_at.desc()).limit(100).all()
    support_assignee_ids = {ticket.assigned_to for ticket in support_tickets if ticket.assigned_to}
    support_assignees = {user.id: user for user in db.query(User).filter(User.id.in_(support_assignee_ids)).all()} if support_assignee_ids else {}
    consent_events = db.query(CRMMarketingConsentEvent).filter(
        CRMMarketingConsentEvent.customer_id == customer.id
    ).order_by(CRMMarketingConsentEvent.recorded_at.desc(), CRMMarketingConsentEvent.id.desc()).limit(100).all()
    consent_state = {"email_marketing": False, "sms_marketing": False}
    consent_seen = set()
    for event in consent_events:
        key = f"{event.channel}_marketing"
        if key in consent_state and key not in consent_seen:
            consent_state[key] = event.granted
            consent_seen.add(key)
    activities = db.query(CRMActivity).filter(
        CRMActivity.customer_id == customer.id
    ).order_by(CRMActivity.created_at.desc()).limit(100).all()
    activity_user_ids = {activity.created_by for activity in activities}
    activity_user_ids.update(activity.assigned_to for activity in activities if activity.assigned_to)
    activity_users = {user.id: user for user in db.query(User).filter(User.id.in_(activity_user_ids)).all()} if activity_user_ids else {}
    return {
        "customer": {"id": customer.id, "full_name": customer.full_name, "email": customer.email,
                      "phone": customer.phone_number, "created_at": customer.created_at},
        "orders": [{"id": order.id, "status": order.status, "payment_status": order.payment_status,
                     "total_amount": str(order.total_amount), "placed_at": order.placed_at,
                     "shipping_status": order.shipping_status, "items": items_by_order.get(order.id, [])}
                    for order in orders],
        "support_tickets": [{
            "id": ticket.id, "order_id": ticket.order_id, "subject": ticket.subject,
            "description": ticket.description, "status": ticket.status, "priority": ticket.priority,
            "assigned_to": ticket.assigned_to,
            "assigned_to_name": ((support_assignees[ticket.assigned_to].full_name or support_assignees[ticket.assigned_to].email) if ticket.assigned_to in support_assignees else None),
            "created_at": ticket.created_at, "updated_at": ticket.updated_at,
        } for ticket in support_tickets],
        "marketing_preferences": {
            **consent_state,
            "history": [{"channel": event.channel, "granted": event.granted, "source": event.source,
                         "recorded_at": event.recorded_at} for event in consent_events],
        },
        "activities": [{"id": activity.id, "activity_type": activity.activity_type,
                         "subject": activity.subject, "description": activity.description,
                         "due_at": activity.due_at, "completed_at": activity.completed_at,
                         "created_at": activity.created_at,
                         "created_by": (activity_users[activity.created_by].full_name or activity_users[activity.created_by].email) if activity.created_by in activity_users else activity.created_by,
                         "assigned_to": activity.assigned_to,
                         "assigned_to_name": ((activity_users[activity.assigned_to].full_name or activity_users[activity.assigned_to].email) if activity.assigned_to in activity_users else None)} for activity in activities],
    }


@router.get("/crm/support-tickets", dependencies=[Depends(require_business_permission("crm"))])
def list_crm_support_tickets(
    ticket_status: Literal["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] | None = Query(default=None, alias="status"),
    priority: Literal["LOW", "MEDIUM", "HIGH", "URGENT"] | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(SupportTicket, User.full_name, User.email).outerjoin(
        User, User.id == SupportTicket.user_id
    )
    if ticket_status:
        query = query.filter(SupportTicket.status == ticket_status)
    if priority:
        query = query.filter(SupportTicket.priority == priority)
    total = query.count()
    rows = query.order_by(
        case((SupportTicket.status == "OPEN", 0), (SupportTicket.status == "IN_PROGRESS", 1), else_=2),
        case((SupportTicket.priority == "URGENT", 0), (SupportTicket.priority == "HIGH", 1), (SupportTicket.priority == "MEDIUM", 2), else_=3),
        SupportTicket.created_at.desc(), SupportTicket.id.asc(),
    ).offset(offset).limit(limit).all()
    assignee_ids = {ticket.assigned_to for ticket, _, _ in rows if ticket.assigned_to}
    assignees = {user.id: user for user in db.query(User).filter(User.id.in_(assignee_ids)).all()} if assignee_ids else {}
    items = [{
        "id": ticket.id, "customer_id": ticket.user_id, "customer_name": customer_name or customer_email,
        "customer_email": customer_email, "order_id": ticket.order_id,
        "subject": ticket.subject, "description": ticket.description, "status": ticket.status,
        "priority": ticket.priority, "assigned_to": ticket.assigned_to,
        "assigned_to_name": ((assignees[ticket.assigned_to].full_name or assignees[ticket.assigned_to].email) if ticket.assigned_to in assignees else None),
        "created_at": ticket.created_at, "updated_at": ticket.updated_at,
    } for ticket, customer_name, customer_email in rows]
    return {"items": items, "total": total, "limit": limit, "offset": offset, "has_more": offset + len(items) < total}


@router.patch("/crm/support-tickets/{ticket_id}", dependencies=[Depends(require_business_permission("crm"))])
def update_crm_support_ticket(
    ticket_id: str,
    body: SupportTicketUpdate,
    admin: User = Depends(require_business_permission("crm")),
    db: Session = Depends(get_db),
):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(422, "Provide at least one ticket field to update")
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).with_for_update().first()
    if not ticket:
        raise HTTPException(404, "Support ticket not found")
    if "assigned_to" in updates and updates["assigned_to"] is not None:
        assignee = db.query(User).filter(User.id == updates["assigned_to"], User.is_active.is_(True)).first()
        has_crm_access = assignee and (
            str(assignee.role).lower() == "admin" or db.query(BusinessTeamPermission.id).filter(
                BusinessTeamPermission.user_id == assignee.id,
                BusinessTeamPermission.permission == "crm",
            ).first()
        )
        if not has_crm_access:
            raise HTTPException(422, "Choose an active admin or CRM team member")
    changes = []
    for field, value in updates.items():
        old = getattr(ticket, field)
        if old != value:
            setattr(ticket, field, value)
            changes.append(f"{field}: {old or 'unassigned'} → {value or 'unassigned'}")
    if not changes:
        return {"id": ticket.id, "status": ticket.status, "priority": ticket.priority, "assigned_to": ticket.assigned_to}
    ticket.updated_at = datetime.now(timezone.utc)
    if ticket.user_id:
        db.add(CRMActivity(
            customer_id=ticket.user_id,
            activity_type="note",
            subject=f"Support ticket updated · {ticket.id}",
            description="; ".join(changes),
            created_by=admin.id,
        ))
    db.commit()
    return {"id": ticket.id, "status": ticket.status, "priority": ticket.priority, "assigned_to": ticket.assigned_to}


@router.get("/crm/leads", dependencies=[Depends(require_business_permission("crm"))])
def list_leads(
    stage: str | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(CRMLead)
    if stage:
        q = q.filter(CRMLead.stage == stage)
    total = q.count()
    items = q.order_by(CRMLead.created_at.desc(), CRMLead.id.asc()).offset(offset).limit(limit).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset, "has_more": offset + len(items) < total}


@router.post("/crm/leads", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_business_permission("crm"))])
def create_lead(body: LeadCreate, admin: User = Depends(require_business_permission("crm")), db: Session = Depends(get_db)):
    payload = body.model_dump()
    payload["full_name"] = payload["full_name"].strip()
    if not payload["full_name"]:
        raise HTTPException(422, "Lead name is required")
    payload["email"] = payload["email"].strip().casefold() if payload["email"] else None
    payload["phone"] = payload["phone"].strip() if payload["phone"] else None
    lead = CRMLead(**payload, created_by=admin.id)
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.patch("/crm/leads/{lead_id}", dependencies=[Depends(require_business_permission("crm"))])
def update_lead(lead_id: str, body: LeadUpdate, db: Session = Depends(get_db)):
    lead = db.get(CRMLead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    if lead.converted_customer_id:
        raise HTTPException(409, "A converted lead cannot be moved back in the pipeline")
    lead.stage = body.stage
    lead.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)
    return lead


@router.post("/crm/leads/{lead_id}/convert", dependencies=[Depends(require_business_permission("crm"))])
def convert_lead(lead_id: str, admin: User = Depends(require_business_permission("crm")), db: Session = Depends(get_db)):
    lead = db.get(CRMLead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    if lead.converted_customer_id:
        return lead
    if lead.stage != "qualified":
        raise HTTPException(409, "Only qualified leads can be converted")
    if not lead.email and not lead.phone:
        raise HTTPException(422, "Add an email or phone number before converting this lead")

    match_conditions = []
    if lead.email:
        match_conditions.append(func.lower(User.email) == lead.email.casefold())
    if lead.phone:
        match_conditions.append(User.phone_number == lead.phone.strip())
    matches = db.query(User).filter(User.role == "customer", or_(*match_conditions)).all()
    if not matches:
        raise HTTPException(404, "No existing customer account matches this lead; do not create a duplicate account")
    if len(matches) > 1:
        raise HTTPException(409, "Lead contact details match more than one customer account")
    customer = matches[0]
    duplicate = db.query(CRMLead.id).filter(
        CRMLead.converted_customer_id == customer.id,
        CRMLead.id != lead.id,
    ).first()
    if duplicate:
        raise HTTPException(409, "This customer is already linked to another converted lead")

    lead.converted_customer_id = customer.id
    lead.stage = "converted"
    lead.updated_at = datetime.now(timezone.utc)
    db.add(CRMActivity(
        customer_id=customer.id,
        activity_type="note",
        subject="Lead converted to customer",
        description=f"Linked existing Vastrax customer account to CRM lead {lead.id} ({lead.full_name}).",
        created_by=admin.id,
    ))
    db.commit()
    db.refresh(lead)
    return lead


@router.get("/crm/activities", dependencies=[Depends(require_business_permission("crm"))])
def list_activities(
    customer_id: str | None = None,
    lead_id: str | None = None,
    upcoming: bool = False,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(CRMActivity)
    if customer_id:
        q = q.filter(CRMActivity.customer_id == customer_id)
    if lead_id:
        q = q.filter(CRMActivity.lead_id == lead_id)
    if upcoming:
        q = q.filter(CRMActivity.completed_at.is_(None), CRMActivity.due_at.isnot(None))
    total = q.count()
    items = q.order_by(CRMActivity.due_at.asc().nullslast(), CRMActivity.created_at.desc(), CRMActivity.id.asc()).offset(offset).limit(limit).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset, "has_more": offset + len(items) < total}


@router.post("/crm/activities", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_business_permission("crm"))])
def create_activity(body: ActivityCreate, admin: User = Depends(require_business_permission("crm")), db: Session = Depends(get_db)):
    if bool(body.customer_id) == bool(body.lead_id):
        raise HTTPException(422, "Choose exactly one customer or lead")
    if body.customer_id and not db.query(User.id).filter(User.id == body.customer_id, User.role == "customer").first():
        raise HTTPException(404, "Customer not found")
    if body.lead_id and not db.get(CRMLead, body.lead_id):
        raise HTTPException(404, "Lead not found")
    if body.assigned_to:
        assignee = db.query(User).filter(User.id == body.assigned_to, User.is_active.is_(True)).first()
        has_crm_access = assignee and (
            str(assignee.role).lower() == "admin" or db.query(BusinessTeamPermission.id).filter(
                BusinessTeamPermission.user_id == assignee.id,
                BusinessTeamPermission.permission == "crm",
            ).first()
        )
        if not has_crm_access:
            raise HTTPException(422, "Choose an active admin or CRM team member")
    activity = CRMActivity(**body.model_dump(), created_by=admin.id)
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.post("/crm/activities/{activity_id}/complete", dependencies=[Depends(require_business_permission("crm"))])
def complete_activity(activity_id: str, db: Session = Depends(get_db)):
    activity = db.get(CRMActivity, activity_id)
    if not activity:
        raise HTTPException(404, "Activity not found")
    activity.completed_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": activity.id, "completed_at": activity.completed_at}


@router.get("/erp/overview", dependencies=[Depends(require_business_permission("erp"))])
def erp_overview(db: Session = Depends(get_db)):
    stock_units = db.query(func.coalesce(func.sum(ProductVariant.stock_qty), 0)).scalar() or 0
    low_stock = db.query(func.count(ProductVariant.id)).filter(ProductVariant.stock_qty.between(1, 5)).scalar() or 0
    out_of_stock = db.query(func.count(ProductVariant.id)).filter(ProductVariant.stock_qty <= 0).scalar() or 0
    open_po = db.query(func.count(PurchaseOrder.id)).filter(PurchaseOrder.status.in_(["ordered", "partially_received"])).scalar() or 0
    month_start = date.today().replace(day=1)
    monthly_expenses = db.query(func.coalesce(func.sum(OperatingExpense.amount + OperatingExpense.tax_amount), 0)).filter(OperatingExpense.expense_date >= month_start).scalar() or 0
    sales = db.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(Order.status != "cancelled").scalar() or 0
    return {"stock_units": int(stock_units), "low_stock_variants": low_stock, "out_of_stock_variants": out_of_stock,
            "open_purchase_orders": open_po, "monthly_expenses": str(monthly_expenses), "order_value_booked": str(sales)}


@router.get("/erp/inventory", dependencies=[Depends(require_business_permission("erp"))])
def inventory_list(q: str | None = Query(default=None, max_length=120), low_stock_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(ProductVariant, Product.name.label("product_name"), Product.colour, Product.is_published).join(Product, Product.id == ProductVariant.product_id)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(or_(Product.name.ilike(term), ProductVariant.sku.ilike(term), ProductVariant.size.ilike(term)))
    if low_stock_only:
        query = query.filter(ProductVariant.stock_qty <= 5)
    return [{"variant_id": v.id, "product_id": v.product_id, "product_name": name, "colour": colour, "size": v.size,
             "sku": v.sku, "stock_qty": v.stock_qty, "is_published": published}
            for v, name, colour, published in query.order_by(Product.name, ProductVariant.size).limit(1000).all()]


@router.get("/erp/inventory/movements", dependencies=[Depends(require_business_permission("erp"))])
def inventory_movements(variant_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(StockMovement)
    if variant_id:
        q = q.filter(StockMovement.variant_id == variant_id)
    return q.order_by(StockMovement.created_at.desc()).limit(500).all()


@router.get("/erp/inventory-costing/status", dependencies=[Depends(require_business_permission("erp"))])
def inventory_costing_status(db: Session = Depends(get_db)):
    rows = db.query(
        ProductVariant.stock_qty,
        func.coalesce(func.sum(ERPInventoryCostLayer.remaining_quantity), 0),
    ).outerjoin(ERPInventoryCostLayer, ERPInventoryCostLayer.variant_id == ProductVariant.id).group_by(ProductVariant.id).all()
    positive_rows = [(int(stock or 0), int(costed or 0)) for stock, costed in rows if int(stock or 0) > 0]
    config = db.get(ERPInventoryCostingConfig, "default")
    return {
        "configured": config is not None,
        "cost_method": config.cost_method if config else None,
        "positive_stock_variants": len(positive_rows),
        "valued_variants": sum(1 for stock, costed in positive_rows if costed >= stock),
        "unvalued_variants": sum(1 for stock, costed in positive_rows if costed < stock),
        "overvalued_variants": sum(1 for stock, costed in positive_rows if costed > stock),
        "on_hand_units": sum(stock for stock, _ in positive_rows),
        "valued_units": sum(min(stock, costed) for stock, costed in positive_rows),
        "unvalued_units": sum(max(0, stock - costed) for stock, costed in positive_rows),
        "overvalued_units": sum(max(0, costed - stock) for stock, costed in positive_rows),
        "unposted_cost_consumptions": db.query(func.count(ERPInventoryCostConsumption.id)).filter(
            ERPInventoryCostConsumption.journal_entry_id.is_(None)
        ).scalar() or 0,
    }


@router.post("/erp/inventory/{variant_id}/adjust", dependencies=[Depends(require_business_permission("erp"))])
def adjust_inventory(variant_id: str, body: StockAdjustment, admin: User = Depends(require_business_permission("erp")), db: Session = Depends(get_db)):
    if body.quantity_delta == 0:
        raise HTTPException(422, "Adjustment must change stock")
    variant = db.get(ProductVariant, variant_id)
    if not variant:
        raise HTTPException(404, "Product size variant not found")
    before = int(variant.stock_qty or 0)
    after = before + body.quantity_delta
    if after < 0:
        raise HTTPException(409, "Adjustment cannot make stock negative")
    variant.stock_qty = after
    db.add(StockMovement(product_id=variant.product_id, variant_id=variant.id, quantity_delta=body.quantity_delta,
                         stock_before=before, stock_after=after, reason=body.reason, notes=body.notes, created_by=admin.id))
    db.commit()
    return {"variant_id": variant.id, "stock_before": before, "stock_after": after}


@router.get("/erp/suppliers", dependencies=[Depends(require_business_permission("erp"))])
def list_suppliers(db: Session = Depends(get_db)):
    return db.query(Supplier).order_by(Supplier.name).all()


@router.post("/erp/suppliers", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_business_permission("erp"))])
def create_supplier(body: SupplierCreate, db: Session = Depends(get_db)):
    payload = body.model_dump()
    payload["name"] = payload["name"].strip()
    if not payload["name"]:
        raise HTTPException(422, "Supplier name is required")
    supplier = Supplier(**payload)
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.patch("/erp/suppliers/{supplier_id}", dependencies=[Depends(require_business_permission("erp"))])
def update_supplier(supplier_id: str, body: SupplierUpdate, db: Session = Depends(get_db)):
    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(404, "Supplier not found")
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(422, "Provide at least one supplier field to update")
    if "name" in updates:
        if updates["name"] is None or not updates["name"].strip():
            raise HTTPException(422, "Supplier name is required")
        updates["name"] = updates["name"].strip()
    if "is_active" in updates and updates["is_active"] is None:
        raise HTTPException(422, "Supplier active state cannot be null")
    for field, value in updates.items():
        if isinstance(value, str):
            value = value.strip() or None
        setattr(supplier, field, value)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.get("/erp/purchase-orders", dependencies=[Depends(require_business_permission("erp"))])
def list_purchase_orders(
    limit: int = Query(default=100, ge=1, le=200), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db)
):
    query = db.query(PurchaseOrder, Supplier.name).join(Supplier, Supplier.id == PurchaseOrder.supplier_id)
    total = query.count()
    rows = query.order_by(PurchaseOrder.created_at.desc(), PurchaseOrder.id.asc()).offset(offset).limit(limit).all()
    output = []
    for po, supplier_name in rows:
        lines = db.query(PurchaseOrderLine, Product.name, ProductVariant.size).join(Product, Product.id == PurchaseOrderLine.product_id).join(ProductVariant, ProductVariant.id == PurchaseOrderLine.variant_id).filter(PurchaseOrderLine.purchase_order_id == po.id).all()
        output.append({"id": po.id, "supplier_id": po.supplier_id, "supplier_name": supplier_name, "status": po.status,
                       "expected_date": po.expected_date, "notes": po.notes, "created_at": po.created_at,
                       "items": [{"id": line.id, "product_name": name, "size": size, "quantity_ordered": line.quantity_ordered,
                                  "quantity_received": line.quantity_received, "unit_cost": str(line.unit_cost)} for line, name, size in lines]})
    return {"items": output, "total": total, "limit": limit, "offset": offset, "has_more": offset + len(output) < total}


@router.post("/erp/purchase-orders", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_business_permission("erp"))])
def create_purchase_order(body: PurchaseOrderCreate, admin: User = Depends(require_business_permission("erp")), db: Session = Depends(get_db)):
    idempotency_key = body.idempotency_key or uuid.uuid4().hex
    canonical_request = {
        "supplier_id": body.supplier_id,
        "expected_date": body.expected_date.isoformat() if body.expected_date else None,
        "notes": body.notes,
        "items": sorted(({"variant_id": item.variant_id, "quantity": item.quantity, "unit_cost": str(item.unit_cost)} for item in body.items), key=lambda item: item["variant_id"]),
    }
    request_hash = hashlib.sha256(json.dumps(canonical_request, separators=(",", ":"), sort_keys=True).encode()).hexdigest()
    previous = db.query(ERPPurchaseOrderRequest).filter(ERPPurchaseOrderRequest.idempotency_key == idempotency_key).first()
    if previous:
        if previous.request_hash != request_hash:
            raise HTTPException(409, "This purchase-order key was already used for a different request")
        po = db.get(PurchaseOrder, previous.purchase_order_id)
        if not po:
            raise HTTPException(409, "The purchase order for this request key no longer exists")
        return {"id": po.id, "supplier_id": po.supplier_id, "status": po.status}

    supplier = db.get(Supplier, body.supplier_id)
    if not supplier or not supplier.is_active:
        raise HTTPException(404, "Active supplier not found")
    variants = {item.variant_id: db.get(ProductVariant, item.variant_id) for item in body.items}
    missing_variant = next((item.variant_id for item in body.items if not variants[item.variant_id]), None)
    if missing_variant:
        raise HTTPException(404, f"Variant not found: {missing_variant}")
    po = PurchaseOrder(supplier_id=supplier.id, status="ordered", expected_date=body.expected_date,
                       notes=body.notes, created_by=admin.id)
    db.add(po)
    db.flush()
    request_record = ERPPurchaseOrderRequest(idempotency_key=idempotency_key, request_hash=request_hash,
                                             purchase_order_id=po.id, created_by=admin.id)
    db.add(request_record)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        previous = db.query(ERPPurchaseOrderRequest).filter(ERPPurchaseOrderRequest.idempotency_key == idempotency_key).first()
        if previous and previous.request_hash == request_hash:
            po = db.get(PurchaseOrder, previous.purchase_order_id)
            if po:
                return {"id": po.id, "supplier_id": po.supplier_id, "status": po.status}
        if previous:
            raise HTTPException(409, "This purchase-order key was already used for a different request")
        raise HTTPException(409, "A duplicate purchase-order request is being processed; retry with the same key")
    for item in body.items:
        variant = variants[item.variant_id]
        db.add(PurchaseOrderLine(purchase_order_id=po.id, product_id=variant.product_id, variant_id=variant.id,
                                 quantity_ordered=item.quantity, unit_cost=item.unit_cost))
    db.commit()
    db.refresh(po)
    return {"id": po.id, "supplier_id": po.supplier_id, "status": po.status}


@router.post("/erp/purchase-orders/{po_id}/receive", dependencies=[Depends(require_business_permission("erp"))])
def receive_purchase_order(po_id: str, body: PurchaseReceipt, admin: User = Depends(require_business_permission("erp")), db: Session = Depends(get_db)):
    idempotency_key = body.idempotency_key or uuid.uuid4().hex
    canonical_request = {
        "purchase_order_id": po_id,
        "inventory_account_id": body.inventory_account_id,
        "payable_account_id": body.payable_account_id,
        "items": sorted(({"line_id": item.line_id, "quantity": item.quantity} for item in body.items), key=lambda item: item["line_id"]),
    }
    request_hash = hashlib.sha256(json.dumps(canonical_request, separators=(",", ":"), sort_keys=True).encode()).hexdigest()
    previous = db.query(ERPInventoryReceipt).filter(ERPInventoryReceipt.idempotency_key == idempotency_key).first()
    if previous:
        if previous.request_hash != request_hash:
            raise HTTPException(409, "This receipt key was already used for a different request")
        return {"id": previous.purchase_order_id, "status": previous.result_status, "journal_entry_id": previous.journal_entry_id}

    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).with_for_update().first()
    if not po or po.status in ("cancelled", "received"):
        raise HTTPException(404, "Open purchase order not found")
    inventory_account = db.get(LedgerAccount, body.inventory_account_id)
    payable_account = db.get(LedgerAccount, body.payable_account_id)
    if not inventory_account or not inventory_account.is_active or inventory_account.account_type != "asset":
        raise HTTPException(422, "Choose an active asset account for received inventory")
    if not payable_account or not payable_account.is_active or payable_account.account_type != "liability":
        raise HTTPException(422, "Choose an active liability account for supplier payable")
    if len({receipt.line_id for receipt in body.items}) != len(body.items):
        raise HTTPException(422, "Each purchase order line can appear once per receipt")
    validated = []
    total_cost = Decimal("0.00")
    for receipt in body.items:
        line = db.query(PurchaseOrderLine).filter(PurchaseOrderLine.id == receipt.line_id).with_for_update().first()
        if not line or line.purchase_order_id != po.id:
            raise HTTPException(404, "Purchase order line not found")
        if line.quantity_received + receipt.quantity > line.quantity_ordered:
            raise HTTPException(409, "Received quantity exceeds the ordered quantity")
        variant = db.query(ProductVariant).filter(ProductVariant.id == line.variant_id).with_for_update().first()
        if not variant:
            raise HTTPException(409, "Product variant no longer exists")
        validated.append((receipt, line, variant))
        total_cost += Decimal(receipt.quantity) * Decimal(line.unit_cost)

    receipt_record = ERPInventoryReceipt(
        idempotency_key=idempotency_key, request_hash=request_hash, purchase_order_id=po.id,
        result_status="processing", created_by=admin.id,
    )
    db.add(receipt_record)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        previous = db.query(ERPInventoryReceipt).filter(ERPInventoryReceipt.idempotency_key == idempotency_key).first()
        if previous and previous.request_hash == request_hash:
            return {"id": previous.purchase_order_id, "status": previous.result_status, "journal_entry_id": previous.journal_entry_id}
        if previous:
            raise HTTPException(409, "This receipt key was already used for a different request")
        raise HTTPException(409, "A duplicate receipt request is being processed; retry with the same key")

    for receipt, line, variant in validated:
        before = int(variant.stock_qty or 0)
        variant.stock_qty = before + receipt.quantity
        line.quantity_received += receipt.quantity
        db.add(StockMovement(product_id=line.product_id, variant_id=line.variant_id, quantity_delta=receipt.quantity,
                             stock_before=before, stock_after=variant.stock_qty, reason="purchase_receipt",
                             reference_id=po.id, created_by=admin.id))
    lines = db.query(PurchaseOrderLine).filter(PurchaseOrderLine.purchase_order_id == po.id).all()
    po.status = "received" if all(line.quantity_received == line.quantity_ordered for line in lines) else "partially_received"
    journal_entry_id = None
    if total_cost > 0:
        entry = JournalEntry(posting_date=date.today(), description=f"Inventory receipt for {po.id}",
                             reference=f"RECEIPT-{idempotency_key[:24]}", source_key=f"inventory-receipt:{idempotency_key}",
                             created_by=admin.id)
        db.add(entry)
        db.flush()
        db.add_all([
            JournalLine(journal_entry_id=entry.id, account_id=inventory_account.id, debit=total_cost, credit=0),
            JournalLine(journal_entry_id=entry.id, account_id=payable_account.id, debit=0, credit=total_cost),
        ])
        journal_entry_id = entry.id
    receipt_record.result_status = po.status
    receipt_record.journal_entry_id = journal_entry_id
    db.commit()
    return {"id": po.id, "status": po.status, "journal_entry_id": journal_entry_id}


@router.post("/erp/purchase-orders/{po_id}/cancel", dependencies=[Depends(require_business_permission("erp"))])
def cancel_purchase_order(po_id: str, admin: User = Depends(require_business_permission("erp")), db: Session = Depends(get_db)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).with_for_update().first()
    if not po or po.status not in ("ordered", "partially_received"):
        raise HTTPException(409, "Only an open purchase order can be cancelled")
    po.status = "cancelled"
    db.commit()
    return {"id": po.id, "status": po.status}


def _purchase_order_payable_accounts(db: Session, purchase_order_id: str) -> dict[str, Decimal]:
    receipt_lines = db.query(JournalLine.account_id, JournalLine.credit).join(
        JournalEntry, JournalEntry.id == JournalLine.journal_entry_id
    ).filter(
        JournalEntry.description == f"Inventory receipt for {purchase_order_id}",
        JournalLine.credit > 0,
    ).all()
    totals: dict[str, Decimal] = {}
    for account_id, credit in receipt_lines:
        totals[account_id] = totals.get(account_id, Decimal("0.00")) + Decimal(credit)
    return totals


@router.get("/erp/payables", dependencies=[Depends(require_business_permission("erp"))])
def list_purchase_order_payables(
    limit: int = Query(default=100, ge=1, le=200), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db)
):
    query = db.query(PurchaseOrder, Supplier.name).join(
        Supplier, Supplier.id == PurchaseOrder.supplier_id
    ).filter(db.query(JournalEntry.id).filter(JournalEntry.description == ("Inventory receipt for " + PurchaseOrder.id)).exists())
    total = query.count()
    rows = query.order_by(PurchaseOrder.created_at.desc(), PurchaseOrder.id.asc()).offset(offset).limit(limit).all()
    output = []
    for po, supplier_name in rows:
        received_by_account = _purchase_order_payable_accounts(db, po.id)
        if not received_by_account:
            continue
        payment_rows = db.query(SupplierPayment.payable_account_id, func.sum(SupplierPayment.amount)).filter(
            SupplierPayment.purchase_order_id == po.id
        ).group_by(SupplierPayment.payable_account_id).all()
        paid_by_account = {account_id: Decimal(amount or 0) for account_id, amount in payment_rows}
        account_rows = []
        for account_id, received in received_by_account.items():
            account = db.get(LedgerAccount, account_id)
            paid = paid_by_account.get(account_id, Decimal("0.00"))
            account_rows.append({
                "payable_account_id": account_id,
                "payable_account_code": account.code if account else "",
                "payable_account_name": account.name if account else "Unavailable account",
                "received_total": str(received.quantize(Decimal("0.01"))),
                "paid_total": str(paid.quantize(Decimal("0.01"))),
                "outstanding_total": str((received - paid).quantize(Decimal("0.01"))),
            })
        received_total = sum(received_by_account.values(), Decimal("0.00"))
        paid_total = sum(paid_by_account.values(), Decimal("0.00"))
        output.append({
            "purchase_order_id": po.id,
            "supplier_id": po.supplier_id,
            "supplier_name": supplier_name,
            "status": po.status,
            "received_total": str(received_total.quantize(Decimal("0.01"))),
            "paid_total": str(paid_total.quantize(Decimal("0.01"))),
            "outstanding_total": str((received_total - paid_total).quantize(Decimal("0.01"))),
            "accounts": account_rows,
            "payments": [{
                "amount": str(payment.amount),
                "payment_date": payment.payment_date,
                "reference": payment.reference,
                "journal_entry_id": payment.journal_entry_id,
            } for payment in db.query(SupplierPayment).filter(
                SupplierPayment.purchase_order_id == po.id
            ).order_by(SupplierPayment.payment_date.desc(), SupplierPayment.created_at.desc()).all()],
        })
    return {"items": output, "total": total, "limit": limit, "offset": offset, "has_more": offset + len(rows) < total}


@router.post("/erp/payables/{purchase_order_id}/payments", status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_business_permission("erp"))])
def record_supplier_payment(
    purchase_order_id: str,
    body: SupplierPaymentCreate,
    admin: User = Depends(require_business_permission("erp")),
    db: Session = Depends(get_db),
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == purchase_order_id).with_for_update().first()
    if not po:
        raise HTTPException(404, "Purchase order not found")
    reference = body.reference.strip()
    if not reference:
        raise HTTPException(422, "A bank or payment reference is required")
    if db.query(SupplierPayment.id).filter(SupplierPayment.reference == reference).first():
        raise HTTPException(409, "This supplier payment reference has already been recorded")
    payable_account = db.get(LedgerAccount, body.payable_account_id)
    payment_account = db.get(LedgerAccount, body.payment_account_id)
    if not payable_account or not payable_account.is_active or payable_account.account_type != "liability":
        raise HTTPException(422, "Choose an active liability account used by this purchase order's receipts")
    if not payment_account or not payment_account.is_active or payment_account.account_type != "asset":
        raise HTTPException(422, "Choose an active cash or bank asset account")
    received = _purchase_order_payable_accounts(db, po.id).get(payable_account.id, Decimal("0.00"))
    if received <= 0:
        raise HTTPException(409, "No received payable balance exists on this account for the purchase order")
    paid = db.query(func.coalesce(func.sum(SupplierPayment.amount), 0)).filter(
        SupplierPayment.purchase_order_id == po.id,
        SupplierPayment.payable_account_id == payable_account.id,
    ).scalar() or Decimal("0.00")
    outstanding = received - Decimal(paid)
    if body.amount > outstanding:
        raise HTTPException(409, f"Payment exceeds the outstanding balance of {outstanding:.2f}")
    payment_id = str(uuid.uuid4())
    entry = JournalEntry(
        posting_date=body.payment_date,
        description=f"Supplier payment for {po.id}",
        reference=reference,
        source_key=f"supplier-payment:{payment_id}",
        created_by=admin.id,
    )
    db.add(entry)
    db.flush()
    db.add_all([
        JournalLine(journal_entry_id=entry.id, account_id=payable_account.id, debit=body.amount, credit=0),
        JournalLine(journal_entry_id=entry.id, account_id=payment_account.id, debit=0, credit=body.amount),
    ])
    payment = SupplierPayment(
        id=payment_id,
        purchase_order_id=po.id,
        supplier_id=po.supplier_id,
        payable_account_id=payable_account.id,
        payment_account_id=payment_account.id,
        journal_entry_id=entry.id,
        amount=body.amount,
        payment_date=body.payment_date,
        reference=reference,
        created_by=admin.id,
    )
    db.add(payment)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This supplier payment reference has already been recorded")
    return {
        "id": payment.id,
        "purchase_order_id": po.id,
        "supplier_id": po.supplier_id,
        "amount": str(body.amount),
        "reference": reference,
        "journal_entry_id": entry.id,
        "outstanding_total": str((outstanding - body.amount).quantize(Decimal("0.01"))),
    }


def _supplier_expense_payable_accounts(db: Session, expense: OperatingExpense) -> dict[str, Decimal]:
    if not expense.journal_entry_id:
        return {}
    rows = db.query(JournalLine.account_id, JournalLine.credit).join(
        LedgerAccount, LedgerAccount.id == JournalLine.account_id
    ).filter(
        JournalLine.journal_entry_id == expense.journal_entry_id,
        JournalLine.credit > 0,
        LedgerAccount.account_type == "liability",
    ).all()
    totals: dict[str, Decimal] = {}
    for account_id, credit in rows:
        totals[account_id] = totals.get(account_id, Decimal("0.00")) + Decimal(credit)
    return totals


@router.get("/erp/payables/expenses", dependencies=[Depends(require_business_permission("erp"))])
def list_supplier_expense_payables(
    limit: int = Query(default=100, ge=1, le=200), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db)
):
    query = db.query(OperatingExpense, Supplier.name).join(
        Supplier, Supplier.id == OperatingExpense.supplier_id
    ).filter(OperatingExpense.journal_entry_id.is_not(None)).order_by(
        OperatingExpense.expense_date.desc(), OperatingExpense.created_at.desc()
    )
    total = query.count()
    rows = query.order_by(OperatingExpense.id.asc()).offset(offset).limit(limit).all()
    output = []
    for expense, supplier_name in rows:
        received_by_account = _supplier_expense_payable_accounts(db, expense)
        if not received_by_account:
            continue
        payment_rows = db.query(
            SupplierExpensePayment.payable_account_id, func.sum(SupplierExpensePayment.amount)
        ).filter(SupplierExpensePayment.expense_id == expense.id).group_by(
            SupplierExpensePayment.payable_account_id
        ).all()
        paid_by_account = {account_id: Decimal(amount or 0) for account_id, amount in payment_rows}
        accounts = []
        for account_id, received in received_by_account.items():
            account = db.get(LedgerAccount, account_id)
            paid = paid_by_account.get(account_id, Decimal("0.00"))
            accounts.append({
                "payable_account_id": account_id,
                "payable_account_code": account.code if account else "",
                "payable_account_name": account.name if account else "Unavailable account",
                "received_total": str(received.quantize(Decimal("0.01"))),
                "paid_total": str(paid.quantize(Decimal("0.01"))),
                "outstanding_total": str((received - paid).quantize(Decimal("0.01"))),
            })
        received_total = sum(received_by_account.values(), Decimal("0.00"))
        paid_total = sum(paid_by_account.values(), Decimal("0.00"))
        output.append({
            "expense_id": expense.id,
            "supplier_id": expense.supplier_id,
            "supplier_name": supplier_name,
            "description": expense.description,
            "category": expense.category,
            "expense_date": expense.expense_date,
            "reference": expense.reference,
            "received_total": str(received_total.quantize(Decimal("0.01"))),
            "paid_total": str(paid_total.quantize(Decimal("0.01"))),
            "outstanding_total": str((received_total - paid_total).quantize(Decimal("0.01"))),
            "accounts": accounts,
            "payments": [{
                "amount": str(payment.amount),
                "payment_date": payment.payment_date,
                "reference": payment.reference,
                "journal_entry_id": payment.journal_entry_id,
            } for payment in db.query(SupplierExpensePayment).filter(
                SupplierExpensePayment.expense_id == expense.id
            ).order_by(SupplierExpensePayment.payment_date.desc(), SupplierExpensePayment.created_at.desc()).all()],
        })
    return {"items": output, "total": total, "limit": limit, "offset": offset, "has_more": offset + len(rows) < total}


@router.post("/erp/payables/expenses/{expense_id}/payments", status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_business_permission("erp"))])
def record_supplier_expense_payment(
    expense_id: str,
    body: SupplierPaymentCreate,
    admin: User = Depends(require_business_permission("erp")),
    db: Session = Depends(get_db),
):
    expense = db.query(OperatingExpense).filter(OperatingExpense.id == expense_id).with_for_update().first()
    if not expense:
        raise HTTPException(404, "Supplier expense not found")
    if not expense.supplier_id:
        raise HTTPException(409, "Only expenses linked to a supplier can be settled here")
    reference = body.reference.strip()
    if not reference:
        raise HTTPException(422, "A bank or payment reference is required")
    duplicate_po = db.query(SupplierPayment.id).filter(SupplierPayment.reference == reference).first()
    duplicate_expense = db.query(SupplierExpensePayment.id).filter(SupplierExpensePayment.reference == reference).first()
    if duplicate_po or duplicate_expense:
        raise HTTPException(409, "This supplier payment reference has already been recorded")
    payable_account = db.get(LedgerAccount, body.payable_account_id)
    payment_account = db.get(LedgerAccount, body.payment_account_id)
    if not payable_account or not payable_account.is_active or payable_account.account_type != "liability":
        raise HTTPException(422, "Choose an active liability account credited by this expense")
    if not payment_account or not payment_account.is_active or payment_account.account_type != "asset":
        raise HTTPException(422, "Choose an active cash or bank asset account")
    received = _supplier_expense_payable_accounts(db, expense).get(payable_account.id, Decimal("0.00"))
    if received <= 0:
        raise HTTPException(409, "This expense has no payable balance on the selected account")
    paid = db.query(func.coalesce(func.sum(SupplierExpensePayment.amount), 0)).filter(
        SupplierExpensePayment.expense_id == expense.id,
        SupplierExpensePayment.payable_account_id == payable_account.id,
    ).scalar() or Decimal("0.00")
    outstanding = received - Decimal(paid)
    if body.amount > outstanding:
        raise HTTPException(409, f"Payment exceeds the outstanding balance of {outstanding:.2f}")
    payment_id = str(uuid.uuid4())
    entry = JournalEntry(
        posting_date=body.payment_date,
        description=f"Supplier expense payment for {expense.id}",
        reference=reference,
        source_key=f"supplier-expense-payment:{payment_id}",
        created_by=admin.id,
    )
    db.add(entry)
    db.flush()
    db.add_all([
        JournalLine(journal_entry_id=entry.id, account_id=payable_account.id, debit=body.amount, credit=0),
        JournalLine(journal_entry_id=entry.id, account_id=payment_account.id, debit=0, credit=body.amount),
    ])
    payment = SupplierExpensePayment(
        id=payment_id,
        expense_id=expense.id,
        supplier_id=expense.supplier_id,
        payable_account_id=payable_account.id,
        payment_account_id=payment_account.id,
        journal_entry_id=entry.id,
        amount=body.amount,
        payment_date=body.payment_date,
        reference=reference,
        created_by=admin.id,
    )
    db.add(payment)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This supplier payment reference has already been recorded")
    return {
        "id": payment.id,
        "expense_id": expense.id,
        "supplier_id": expense.supplier_id,
        "amount": str(body.amount),
        "reference": reference,
        "journal_entry_id": entry.id,
        "outstanding_total": str((outstanding - body.amount).quantize(Decimal("0.01"))),
    }


@router.get("/erp/expenses", dependencies=[Depends(require_business_permission("erp"))])
def list_expenses(
    limit: int = Query(default=100, ge=1, le=200), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db)
):
    query = db.query(OperatingExpense)
    total = query.count()
    items = query.order_by(OperatingExpense.expense_date.desc(), OperatingExpense.created_at.desc(), OperatingExpense.id.asc()).offset(offset).limit(limit).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset, "has_more": offset + len(items) < total}


@router.post("/erp/expenses", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_business_permission("erp"))])
def create_expense(body: ExpenseCreate, admin: User = Depends(require_business_permission("erp")), db: Session = Depends(get_db)):
    if body.supplier_id and not db.get(Supplier, body.supplier_id):
        raise HTTPException(404, "Supplier not found")
    expense_account = db.get(LedgerAccount, body.expense_account_id)
    credit_account = db.get(LedgerAccount, body.credit_account_id)
    tax_account = db.get(LedgerAccount, body.input_tax_account_id) if body.input_tax_account_id else None
    if not expense_account or not expense_account.is_active or expense_account.account_type != "expense":
        raise HTTPException(422, "Choose an active expense account")
    if not credit_account or not credit_account.is_active or credit_account.account_type not in ("asset", "liability"):
        raise HTTPException(422, "Choose an active asset or liability credit account")
    if body.tax_amount > 0 and (not tax_account or not tax_account.is_active or tax_account.account_type != "asset"):
        raise HTTPException(422, "Choose an active asset account for recoverable tax")
    expense_data = body.model_dump(exclude={"expense_account_id", "credit_account_id", "input_tax_account_id"})
    expense = OperatingExpense(**expense_data, created_by=admin.id)
    db.add(expense)
    db.flush()
    entry = JournalEntry(posting_date=body.expense_date, description=f"Expense: {body.description}",
                         reference=body.reference or f"EXP-{expense.id}",
                         source_key=f"operating-expense:{expense.id}", created_by=admin.id)
    db.add(entry)
    db.flush()
    expense.journal_entry_id = entry.id
    journal_lines = [
        JournalLine(journal_entry_id=entry.id, account_id=expense_account.id, debit=body.amount, credit=0),
        JournalLine(journal_entry_id=entry.id, account_id=credit_account.id, debit=0, credit=body.amount + body.tax_amount),
    ]
    if body.tax_amount > 0 and tax_account:
        journal_lines.append(JournalLine(journal_entry_id=entry.id, account_id=tax_account.id, debit=body.tax_amount, credit=0))
    db.add_all(journal_lines)
    db.commit()
    db.refresh(expense)
    return {"expense": expense, "journal_entry_id": entry.id}
