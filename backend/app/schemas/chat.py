import base64
import binascii
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class ChatMessageSchema(BaseModel):
    role: str
    content: str
    image_data: Optional[str] = Field(default=None, max_length=4_194_327, repr=False)

    @field_validator("image_data")
    @classmethod
    def validate_temporary_image(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        prefix, separator, encoded = value.partition(",")
        if prefix != "data:image/jpeg;base64" or not separator:
            raise ValueError("Only processed JPEG images are accepted")
        try:
            image_bytes = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Invalid image data") from exc
        if not image_bytes or len(image_bytes) > 3 * 1024 * 1024:
            raise ValueError("Image must be no larger than 3 MB after processing")
        if not image_bytes.startswith(b"\xff\xd8\xff"):
            raise ValueError("Image data is not a valid JPEG")
        return value


class ChatRequest(BaseModel):
    messages: List[ChatMessageSchema]
    profile: dict = {}
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    context_url: Optional[str] = None
    cart_items: Optional[list] = None
    wishlist_product_ids: Optional[List[str]] = None


class ChatHistoryItem(BaseModel):
    id: str
    sender: str
    text: str
    timestamp: str
    suggested_products: Optional[list] = None

