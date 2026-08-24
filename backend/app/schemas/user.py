from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict


class AddressCreate(BaseModel):
    label: str
    address_line1: str
    city: str
    state: str
    pincode: str
    is_default: bool = False


class AddressUpdate(BaseModel):
    label: Optional[str] = None
    address_line1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    is_default: Optional[bool] = None


class AddressResponse(BaseModel):
    id: str
    label: str
    address_line1: str
    city: str
    state: str
    pincode: str
    is_default: bool

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone_number: Optional[str] = None
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class UserResponse(BaseModel):
    id: str
    full_name: str | None
    email: EmailStr
    phone_number: str | None
    role: str
    is_active: bool
    created_at: datetime
    tryon_count: int = 0
    chat_message_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class UserDetailResponse(UserResponse):
    addresses: list[AddressResponse] = []
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
