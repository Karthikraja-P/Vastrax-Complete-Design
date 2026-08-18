from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TryonSessionResponse(BaseModel):
    id: str
    user_id: str
    product_id: str
    status: str
    result_image_url: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
