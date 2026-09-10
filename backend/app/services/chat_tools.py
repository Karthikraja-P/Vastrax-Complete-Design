"""
AI Chat Tool Definitions & Secure Execution Engine.
Strict security boundary: OpenAI decides which tool to call;
Backend validates permissions, checks ownership, queries DB, and returns results.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.category import Category
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.support_ticket import SupportTicket
from app.models.user import User

logger = logging.getLogger(__name__)

# ── OpenAI Tool Schemas ────────────────────────────────────────────────────────

CHAT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": "Search for garments and luxury apparel in the boutique catalog based on search keywords, category, max price, occasion, or color.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search keyword e.g. 'floral dress', 'linen trousers', 'silk shirt'",
                    },
                    "category": {
                        "type": "string",
                        "description": "Category slug or name e.g. 'dresses', 'tops', 'pants', 'jackets'",
                    },
                    "max_price": {
                        "type": "number",
                        "description": "Maximum price in INR (e.g. 5000)",
                    },
                    "color": {
                        "type": "string",
                        "description": "Specific color preference e.g. 'navy', 'olive', 'blue', 'black'",
                    },
                    "occasion": {
                        "type": "string",
                        "description": "Occasion e.g. 'wedding', 'office', 'casual', 'party', 'festive'",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_product_details",
            "description": "Retrieve comprehensive details for a specific product including price, fabric, available colors, description, and available sizes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {
                        "type": "string",
                        "description": "The unique product ID e.g. 'vtx-frock-floral' or UUID",
                    },
                },
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_inventory",
            "description": "Check real-time stock availability for a specific product and optional size.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {
                        "type": "string",
                        "description": "The product ID to check stock for",
                    },
                    "size": {
                        "type": "string",
                        "description": "Garment size e.g. 'XS', 'S', 'M', 'L', 'XL'",
                    },
                },
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_order_status",
            "description": "Retrieve the current delivery, fulfillment, and shipping status of an order. Requires order ID and customer authorization.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The order ID or order number e.g. 'ORD-2026-1048' or UUID",
                    },
                    "email": {
                        "type": "string",
                        "description": "Customer email if unauthenticated/guest lookup",
                    },
                },
                "required": ["order_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_order_details",
            "description": "Retrieve the full list of items, sizes, shipping address, and payment information for an authorized order.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The order ID or order number",
                    },
                    "email": {
                        "type": "string",
                        "description": "Customer email if unauthenticated/guest lookup",
                    },
                },
                "required": ["order_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_shipping_estimate",
            "description": "Get estimated delivery timeline and shipping fee for a customer postal code / pincode.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pincode": {
                        "type": "string",
                        "description": "6-digit destination postal pincode (e.g. '560001')",
                    },
                },
                "required": ["pincode"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_return_eligibility",
            "description": "Check whether an order or specific item is eligible for return or exchange under VastraX's 14-day luxury policy.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The order ID to check return window for",
                    },
                },
                "required": ["order_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "cancel_order",
            "description": "Cancel an order if it is in pending or processing status and not yet shipped. Restores inventory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The order ID to cancel",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Customer's stated reason for cancellation",
                    },
                },
                "required": ["order_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_support_ticket",
            "description": "Create a customer support ticket for inquiries that cannot be resolved automatically.",
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {
                        "type": "string",
                        "description": "Brief summary of the issue",
                    },
                    "description": {
                        "type": "string",
                        "description": "Detailed explanation of customer request or complaint",
                    },
                    "order_id": {
                        "type": "string",
                        "description": "Associated order ID if applicable",
                    },
                },
                "required": ["subject", "description"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "connect_to_human",
            "description": "Escalate the conversation to a human atelier concierge / customer care representative.",
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {
                        "type": "string",
                        "description": "Concise summary of customer issue and chat context",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Why human handoff is needed e.g. 'damaged item', 'custom styling inquiry', 'dispute'",
                    },
                },
                "required": ["summary"],
            },
        },
    },
]


# ── Secure Execution Handlers ──────────────────────────────────────────────────

def execute_tool(
    tool_name: str,
    args: Dict[str, Any],
    db: Session,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Central security gateway. Executes requested tool against active PostgreSQL database
    with strict authentication and authorization checks.
    """
    logger.info("Executing chat tool: %s with args: %s (user_id=%s)", tool_name, args, user_id)

    try:
        if tool_name == "search_products":
            return _search_products(db, **args)
        elif tool_name == "get_product_details":
            return _get_product_details(db, **args)
        elif tool_name == "check_inventory":
            return _check_inventory(db, **args)
        elif tool_name == "get_order_status":
            return _get_order_status(db, user_id=user_id, **args)
        elif tool_name == "get_order_details":
            return _get_order_details(db, user_id=user_id, **args)
        elif tool_name == "get_shipping_estimate":
            return _get_shipping_estimate(db, **args)
        elif tool_name == "check_return_eligibility":
            return _check_return_eligibility(db, user_id=user_id, **args)
        elif tool_name == "cancel_order":
            return _cancel_order(db, user_id=user_id, **args)
        elif tool_name == "create_support_ticket":
            return _create_support_ticket(db, user_id=user_id, session_id=session_id, **args)
        elif tool_name == "connect_to_human":
            return _connect_to_human(db, user_id=user_id, session_id=session_id, **args)
        else:
            return {"error": f"Unknown tool '{tool_name}'"}
    except Exception as e:
        logger.error("Error executing tool %s: %s", tool_name, e, exc_info=True)
        return {"error": f"Failed to execute {tool_name}: {str(e)}"}


# ── Internal Tool Implementations ─────────────────────────────────────────────

def _search_products(
    db: Session,
    query: Optional[str] = None,
    category: Optional[str] = None,
    max_price: Optional[float] = None,
    color: Optional[str] = None,
    occasion: Optional[str] = None,
) -> Dict[str, Any]:
    q = db.query(Product).filter(Product.is_published == True)

    if query:
        term = f"%{query.strip()}%"
        q = q.filter(Product.name.ilike(term) | Product.description.ilike(term))
    if category:
        cat_term = f"%{category.strip()}%"
        q = q.join(Product.category).filter(Category.name.ilike(cat_term) | Category.slug.ilike(cat_term))
    if max_price:
        q = q.filter(Product.price_selling <= max_price)
    if color:
        q = q.filter(Product.colour.ilike(f"%{color.strip()}%"))
    if occasion:
        q = q.filter(Product.occasion.ilike(f"%{occasion.strip()}%"))

    products = q.limit(6).all()
    results = []
    for p in products:
        img = p.images[0].s3_url if p.images else None
        results.append({
            "id": p.id,
            "name": p.name,
            "price": float(p.price_selling) if p.price_selling else 0,
            "category": p.category.name if p.category else "Uncategorized",
            "colour": p.colour,
            "occasion": p.occasion,
            "image": img,
        })

    return {
        "found_count": len(results),
        "products": results,
    }


def _get_product_details(db: Session, product_id: str) -> Dict[str, Any]:
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        return {"error": f"Product '{product_id}' not found"}

    variants = [
        {"size": v.size, "in_stock": v.stock_qty > 0, "quantity": v.stock_qty}
        for v in p.variants
    ]

    return {
        "id": p.id,
        "name": p.name,
        "price": float(p.price_selling) if p.price_selling else 0,
        "original_price": float(p.price_original) if p.price_original else None,
        "category": p.category.name if p.category else None,
        "fabric": p.fabric,
        "colour": p.colour,
        "occasion": p.occasion,
        "description": p.description,
        "image": p.images[0].s3_url if p.images else None,
        "sizes": variants,
    }


def _check_inventory(db: Session, product_id: str, size: Optional[str] = None) -> Dict[str, Any]:
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        return {"error": f"Product '{product_id}' not found"}

    if size:
        variant = (
            db.query(ProductVariant)
            .filter(ProductVariant.product_id == product_id, ProductVariant.size.ilike(size.strip()))
            .first()
        )
        if not variant:
            return {"product": p.name, "size": size, "available": False, "stock": 0}
        return {
            "product": p.name,
            "size": variant.size,
            "available": variant.stock_qty > 0,
            "stock": variant.stock_qty,
        }

    total_stock = sum(v.stock_qty for v in p.variants)
    sizes = {v.size: v.stock_qty for v in p.variants}
    return {
        "product": p.name,
        "available": total_stock > 0,
        "total_stock": total_stock,
        "size_breakdown": sizes,
    }


def _resolve_authorized_order(db: Session, order_id: str, user_id: Optional[str] = None, email: Optional[str] = None) -> Optional[Order]:
    """Authorization guard: prevents customer from accessing orders belonging to another patron."""
    order = db.query(Order).filter(
        (Order.id == order_id) | (Order.id.ilike(f"%{order_id}%"))
    ).first()

    if not order:
        return None

    # Check ownership
    if user_id and order.user_id == user_id:
        return order

    # If guest or user_id not matching, verify via user email
    if email and order.user and order.user.email and order.user.email.lower() == email.strip().lower():
        return order

    # If user is admin, allow
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if user and user.role in ["admin", "superadmin"]:
            return order

    return None


def _get_order_status(db: Session, order_id: str, user_id: Optional[str] = None, email: Optional[str] = None) -> Dict[str, Any]:
    order = _resolve_authorized_order(db, order_id, user_id=user_id, email=email)
    if not order:
        return {
            "authorized": False,
            "message": "Order not found, or you do not have permission to view it. Please sign in or provide the email associated with this order.",
        }

    return {
        "authorized": True,
        "order_id": order.id,
        "status": order.status.upper(),
        "placed_at": order.placed_at.strftime("%B %d, %Y"),
        "total_amount": f"₹{order.total_amount:,.2f}",
        "courier": order.shipping_courier or "VastraX Express Courier",
        "tracking_awb": order.shipping_awb or "Pending assignment",
        "shipping_status": order.shipping_status or "Processing at atelier",
        "estimated_delivery": (order.placed_at + timedelta(days=4)).strftime("%B %d, %Y"),
    }


def _get_order_details(db: Session, order_id: str, user_id: Optional[str] = None, email: Optional[str] = None) -> Dict[str, Any]:
    order = _resolve_authorized_order(db, order_id, user_id=user_id, email=email)
    if not order:
        return {
            "authorized": False,
            "message": "Order not found or access denied.",
        }

    items = []
    for item in order.items:
        items.append({
            "product_id": item.product_id,
            "size": item.size,
            "color": item.color,
            "quantity": item.quantity,
            "unit_price": float(item.unit_price),
            "total_price": float(item.total_price),
        })

    address_summary = None
    if order.address:
        address_summary = f"{order.address.address_line1}, {order.address.city}, {order.address.state} - {order.address.postal_code}"

    return {
        "authorized": True,
        "order_id": order.id,
        "status": order.status,
        "placed_at": order.placed_at.isoformat(),
        "total_amount": float(order.total_amount),
        "shipping_address": address_summary,
        "items": items,
    }


def _get_shipping_estimate(db: Session, pincode: str) -> Dict[str, Any]:
    cleaned = pincode.strip()
    if len(cleaned) != 6 or not cleaned.isdigit():
        return {"error": "Please provide a valid 6-digit postal pincode."}

    # Standard luxury delivery logic
    return {
        "pincode": cleaned,
        "serviceable": True,
        "standard_delivery": "3 - 5 business days",
        "express_delivery": "1 - 2 business days",
        "shipping_fee": "Complimentary on orders over ₹2,500; otherwise ₹150 flat.",
    }


def _check_return_eligibility(db: Session, order_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    order = _resolve_authorized_order(db, order_id, user_id=user_id)
    if not order:
        return {"authorized": False, "message": "Order not found or authorization failed."}

    if order.status.lower() != "delivered":
        return {
            "eligible": False,
            "reason": f"Order status is currently '{order.status}'. Returns can only be initiated after delivery.",
        }

    now = datetime.now(timezone.utc)
    delivery_date = order.updated_at or order.placed_at
    days_since = (now - delivery_date).days

    if days_since > 14:
        return {
            "eligible": False,
            "reason": f"The 14-day luxury return window expired {days_since - 14} days ago.",
        }

    return {
        "eligible": True,
        "return_window_days_remaining": max(0, 14 - days_since),
        "policy": "Items must be unworn, undamaged, with original atelier tags and packaging intact.",
    }


def _cancel_order(db: Session, order_id: str, reason: Optional[str] = None, user_id: Optional[str] = None) -> Dict[str, Any]:
    order = _resolve_authorized_order(db, order_id, user_id=user_id)
    if not order:
        return {"success": False, "message": "Order not found or access denied."}

    non_cancellable = ["shipped", "delivered", "cancelled", "returned"]
    if order.status.lower() in non_cancellable:
        return {
            "success": False,
            "message": f"Order #{order.id} cannot be cancelled because it is already '{order.status}'. Please initiate a return upon receipt.",
        }

    # Restore stock for each item variant
    for item in order.items:
        if item.variant_id:
            var = db.query(ProductVariant).filter(ProductVariant.id == item.variant_id).first()
            if var:
                var.stock_qty += item.quantity

    order.status = "cancelled"
    db.commit()

    return {
        "success": True,
        "order_id": order.id,
        "message": f"Order #{order.id} has been successfully cancelled. Any charged amounts will be refunded within 3-5 business days.",
    }


def _create_support_ticket(
    db: Session,
    subject: str,
    description: str,
    order_id: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    ticket = SupportTicket(
        user_id=user_id,
        order_id=order_id,
        subject=subject,
        description=description,
        status="OPEN",
        priority="MEDIUM",
        session_id=session_id,
    )
    db.add(ticket)
    db.commit()

    return {
        "success": True,
        "ticket_id": ticket.id,
        "subject": ticket.subject,
        "status": ticket.status,
        "message": f"Support Ticket #{ticket.id} created. Our concierge team will review and contact you shortly.",
    }


def _connect_to_human(
    db: Session,
    summary: str,
    reason: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    ticket = SupportTicket(
        user_id=user_id,
        subject=f"Human Concierge Request: {reason or 'Live Escalation'}",
        description=summary,
        status="OPEN",
        priority="URGENT",
        session_id=session_id,
    )
    db.add(ticket)
    db.commit()

    return {
        "escalated": True,
        "ticket_id": ticket.id,
        "priority": "URGENT",
        "message": f"I have escalated your conversation to our Human Atelier Team (Reference #{ticket.id}). An advisor will join shortly.",
    }
