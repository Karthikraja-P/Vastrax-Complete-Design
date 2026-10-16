import json
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from fastapi.responses import StreamingResponse

from app.db.database import get_db
from app.middleware.auth import get_optional_user
from app.models.user import User
from app.core.exceptions import ForbiddenError
from app.models.chat_message import ChatMessage
from app.models.product import Product
from app.schemas.chat import ChatRequest
from app.services.chat_service import chat as vastra_chat, chat_stream as vastra_chat_stream

router = APIRouter(prefix="/chat", tags=["chat"])


def _verified_user_id(claimed_user_id: str | None, current_user: User | None) -> str | None:
    if claimed_user_id and (not current_user or claimed_user_id not in (current_user.id, current_user.email)):
        raise ForbiddenError("Cannot use another user's chat identity")
    return current_user.id if current_user else None


def _authorize_session(db: Session, session_id: str, current_user: User | None) -> None:
    owners = {
        owner for (owner,) in db.query(ChatMessage.user_id)
        .filter(ChatMessage.session_id == session_id, ChatMessage.user_id.isnot(None))
        .distinct().all()
    }
    if owners and (not current_user or not owners.issubset({current_user.id, current_user.email})):
        raise ForbiddenError("Chat session access denied")


def _save_user_message(db: Session, req: ChatRequest, session_id: str, user_id: str | None) -> None:
    """Persist the latest user turn only once the stylist has answered, so outages leave no orphan message."""
    if req.messages and req.messages[-1].role == "user":
        db.add(ChatMessage(
            session_id=session_id,
            user_id=user_id,
            sender="user",
            content=req.messages[-1].content,
        ))
        db.commit()


@router.post("")
def chat_endpoint(
    req: ChatRequest,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    session_id = req.session_id or f"ses_{uuid.uuid4().hex[:12]}"
    user_id = _verified_user_id(req.user_id, current_user)
    _authorize_session(db, session_id, current_user)
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    
    # Generate stylist response with secure tool calling
    reply_text, executed_tools = vastra_chat(
        messages,
        req.profile,
        db=db,
        context_url=req.context_url,
        cart_items=req.cart_items,
        user_id=user_id,
        session_id=session_id,
    )

    _save_user_message(db, req, session_id, user_id)

    # Extract suggested products from reply tags e.g. [PRODUCT:vtx-frock-floral]
    # and match against live published catalog so recommendations are guaranteed to be available on the webpage
    suggested = []
    seen_ids = set()
    try:
        import re
        product_ids = re.findall(r"\[PRODUCT:([^\]]+)\]", reply_text, re.IGNORECASE)
        # 1. Add explicitly tagged products
        if product_ids:
            found_products = db.query(Product).filter(Product.id.in_(product_ids), Product.is_published == True).all()
            for fp in found_products:
                if fp.id not in seen_ids:
                    seen_ids.add(fp.id)
                    cat_name = fp.category.name if fp.category else "tops"
                    img_url = fp.images[0].s3_url if fp.images else "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?q=80&w=400&auto=format&fit=crop"
                    suggested.append({
                        "id": fp.id,
                        "name": fp.name,
                        "price": f"₹{fp.price_selling:,.0f}" if fp.price_selling else "₹1,999",
                        "image": img_url,
                        "category": cat_name
                    })

        # 2. Fallback scan: if LLM mentioned published product names without tags, still include them!
        all_published = db.query(Product).filter(Product.is_published == True).all()
        reply_lower = reply_text.lower()
        for p in all_published:
            if p.id not in seen_ids:
                if (p.name and len(p.name) > 3 and p.name.lower() in reply_lower) or (p.id and p.id.lower() in reply_lower):
                    seen_ids.add(p.id)
                    cat_name = p.category.name if p.category else "tops"
                    img_url = p.images[0].s3_url if p.images else "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?q=80&w=400&auto=format&fit=crop"
                    suggested.append({
                        "id": p.id,
                        "name": p.name,
                        "price": f"₹{p.price_selling:,.0f}" if p.price_selling else "₹1,999",
                        "image": img_url,
                        "category": cat_name
                    })
    except Exception:
        pass

    is_escalated = any(t.get("tool") == "connect_to_human" for t in (executed_tools or []))

    # Save assistant message to DB
    assistant_msg = ChatMessage(
        session_id=session_id,
        user_id=user_id,
        sender="stylist",
        content=reply_text,
        suggested_products=json.dumps(suggested) if suggested else None,
        tool_calls=json.dumps(executed_tools) if executed_tools else None,
        is_escalated=is_escalated,
    )
    db.add(assistant_msg)
    db.commit()

    return {
        "message": reply_text,
        "session_id": session_id,
        "suggested_products": suggested,
        "executed_tools": executed_tools,
        "is_escalated": is_escalated,
    }


@router.post("/stream")
def chat_stream_endpoint(
    req: ChatRequest,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    session_id = req.session_id or f"ses_{uuid.uuid4().hex[:12]}"
    user_id = _verified_user_id(req.user_id, current_user)
    _authorize_session(db, session_id, current_user)
    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    # The provider call runs eagerly: an outage raises here, before anything is persisted.
    events = vastra_chat_stream(
        messages=messages,
        profile=req.profile,
        db=db,
        context_url=req.context_url,
        cart_items=req.cart_items,
        user_id=user_id,
        session_id=session_id,
    )
    _save_user_message(db, req, session_id, user_id)
    return StreamingResponse(events, media_type="text/event-stream")


@router.get("/history")
def get_chat_history(
    session_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Retrieve previous conversation messages for a customer or session."""
    _verified_user_id(user_id, current_user)
    if session_id:
        _authorize_session(db, session_id, current_user)
    if not session_id and not user_id:
        return {"messages": []}

    query = db.query(ChatMessage)
    if session_id:
        query = query.filter(ChatMessage.session_id == session_id)
    elif user_id:
        query = query.filter(ChatMessage.user_id == user_id)

    db_messages = query.order_by(ChatMessage.created_at.asc()).limit(50).all()

    results = []
    for m in db_messages:
        suggested = None
        if m.suggested_products:
            try:
                suggested = json.loads(m.suggested_products)
            except Exception:
                suggested = None
        results.append({
            "id": m.id,
            "sender": m.sender,
            "text": m.content,
            "timestamp": m.created_at.strftime("%I:%M %p"),
            "suggestedProducts": suggested
        })

    return {"messages": results}


@router.delete("/history")
def clear_chat_history(
    session_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Clear chat history for a session or customer."""
    _verified_user_id(user_id, current_user)
    if session_id:
        _authorize_session(db, session_id, current_user)
    if not session_id and not user_id:
        return {"success": False, "detail": "session_id or user_id required"}

    query = db.query(ChatMessage)
    if session_id:
        query = query.filter(ChatMessage.session_id == session_id)
    elif user_id:
        query = query.filter(ChatMessage.user_id == user_id)

    deleted_count = query.delete(synchronize_session=False)
    db.commit()

    return {"success": True, "deleted_count": deleted_count}
