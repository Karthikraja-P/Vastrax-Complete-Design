from fastapi import APIRouter

from app.schemas.chat import ChatRequest
from app.services.chat_service import chat as vastra_chat

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("")
def chat_endpoint(req: ChatRequest):
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    return {"message": vastra_chat(messages, req.profile)}
