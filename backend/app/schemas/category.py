from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CategoryCreate(BaseModel):
    name: str
    slug: str


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None


class CategoryResponse(BaseModel):
    id: str
    name: str
    slug: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
