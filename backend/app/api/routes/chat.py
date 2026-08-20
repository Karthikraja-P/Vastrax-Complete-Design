import json
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.chat_message import ChatMessage
from app.models.product import Product
from app.schemas.chat import ChatRequest
from app.services.chat_service import chat as vastra_chat

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("")
def chat_endpoint(req: ChatRequest, db: Session = Depends(get_db)):
    session_id = req.session_id or f"ses_{uuid.uuid4().hex[:12]}"
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    
    # Save the latest user message to DB if present
    if req.messages and req.messages[-1].role == "user":
        user_msg = ChatMessage(
            session_id=session_id,
            user_id=req.user_id,
            sender="user",
            content=req.messages[-1].content,
        )
        db.add(user_msg)
        db.commit()

    # Generate stylist response
    reply_text = vastra_chat(messages, req.profile, db=db)

    # Extract suggested products from reply tags e.g. [PRODUCT:vtx-frock-floral]
    suggested = []
    try:
        import re
        product_ids = re.findall(r"\[PRODUCT:([^\]]+)\]", reply_text)
        if product_ids:
            found_products = db.query(Product).filter(Product.id.in_(product_ids)).all()
            for fp in found_products:
                cat_name = fp.category.name if fp.category else "tops"
                img_url = fp.images[0].s3_url if fp.images else "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?q=80&w=400&auto=format&fit=crop"
                suggested.append({
                    "id": fp.id,
                    "name": fp.name,
                    "price": f"₹{fp.price_selling:,.0f}" if fp.price_selling else "₹1,999",
                    "image": img_url,
                    "category": cat_name
                })
    except Exception:
        pass

    # Save assistant message to DB
    assistant_msg = ChatMessage(
        session_id=session_id,
        user_id=req.user_id,
        sender="stylist",
        content=reply_text,
        suggested_products=json.dumps(suggested) if suggested else None
    )
    db.add(assistant_msg)
    db.commit()

    return {
        "message": reply_text,
        "session_id": session_id,
        "suggested_products": suggested
    }


@router.get("/history")
def get_chat_history(
    session_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Retrieve previous conversation messages for a customer or session."""
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
    db: Session = Depends(get_db)
):
    """Clear chat history for a session or customer."""
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
