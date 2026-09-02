from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict


class AddressCreate(BaseModel):
    label: Optional[str] = "Home"
    address_line1: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = "City"
    state: Optional[str] = "State"
    pincode: Optional[str] = None
    postal_code: Optional[str] = None
    is_default: bool = False

    @property
    def final_address_line1(self) -> str:
        return self.address_line1 or self.address or "Address"

    @property
    def final_pincode(self) -> str:
        return self.pincode or self.postal_code or "400001"

    @property
    def final_label(self) -> str:
        return self.label or "Home"


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
