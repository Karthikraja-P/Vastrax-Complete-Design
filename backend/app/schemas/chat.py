from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel


class ChatMessageSchema(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessageSchema]
    profile: dict = {}
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    context_url: Optional[str] = None
    cart_items: Optional[list] = None


class ChatHistoryItem(BaseModel):
    id: str
    sender: str
    text: str
    timestamp: str
    suggested_products: Optional[list] = None

