from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TryonSubmitRequest(BaseModel):
    product_id: str | int | None = None
    garment_path: str | None = None
    user_photo_base64: str | None = None
    category: str | None = None
    garment_type: str | None = None


class TryonSessionResponse(BaseModel):
    id: str
    user_id: str
    product_id: str | None
    status: str
    result_image_url: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
