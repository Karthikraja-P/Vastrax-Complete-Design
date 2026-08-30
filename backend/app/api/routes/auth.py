from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    Verify2FARequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    return await AuthService(db).register(req.full_name, req.email, req.phone_number, req.password)


@router.post("/login")
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    return await AuthService(db).login(req.email, req.password)


@router.post("/verify-2fa")
async def verify_2fa(req: Verify2FARequest, db: Session = Depends(get_db)):
    return await AuthService(db).verify_2fa(req.user_id, req.code)


@router.post("/verify-registration")
async def verify_registration(req: Verify2FARequest, db: Session = Depends(get_db)):
    return await AuthService(db).verify_registration(req.user_id, req.code)


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return AuthService(db).logout(current_user)


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    return await AuthService(db).forgot_password(req.email)


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    return AuthService(db).reset_password(req.token, req.new_password)


@router.post("/refresh")
def refresh_token(req: RefreshRequest, db: Session = Depends(get_db)):
    return AuthService(db).refresh(req.refresh_token)
