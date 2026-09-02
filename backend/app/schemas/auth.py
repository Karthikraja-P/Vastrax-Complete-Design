from pydantic import BaseModel, EmailStr, model_validator
from typing import Optional


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone_number: Optional[str] = None
    mobile: Optional[str] = None
    password: str

    @property
    def final_phone_number(self) -> str:
        return (self.phone_number or self.mobile or "+919999999999").strip()


class LoginRequest(BaseModel):
    email: Optional[str] = None
    mobile: Optional[str] = None
    phone_number: Optional[str] = None
    identifier: Optional[str] = None
    email_or_phone: Optional[str] = None
    password: str

    @property
    def login_identifier(self) -> str:
        return (
            self.email or 
            self.mobile or 
            self.phone_number or 
            self.identifier or 
            self.email_or_phone or 
            ""
        ).strip()


class Verify2FARequest(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None
    identifier: Optional[str] = None
    code: Optional[str] = None
    otp: Optional[str] = None

    @property
    def verification_code(self) -> str:
        return (self.code or self.otp or "").strip()

    @property
    def user_identifier(self) -> str:
        return (self.user_id or self.email or self.identifier or "").strip()


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict
