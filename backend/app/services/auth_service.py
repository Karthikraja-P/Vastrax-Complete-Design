import hashlib
import uuid
from datetime import timezone

from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    UnauthorizedError,
)
from app.core.logging import get_logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.services.email_service import send_email

logger = get_logger(__name__)


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def _token_hash(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    def register(self, full_name: str, email: str, phone_number: str | None, password: str) -> dict:
        email = email.lower().strip()
        if self.db.query(User).filter(User.email == email).first():
            raise ConflictError("Email already registered")
        if phone_number:
            if self.db.query(User).filter(User.phone_number == phone_number).first():
                raise ConflictError("Phone number already registered")

        user = User(
            id=str(uuid.uuid4()),
            full_name=full_name,
            email=email,
            phone_number=phone_number,
            hashed_password=hash_password(password),
            role="customer",
            is_active=True,
        )
        self.db.add(user)
        self.db.flush()  # get the id without committing

        access_token = create_access_token({"sub": user.id, "role": user.role})
        refresh_token = create_refresh_token(user.id)
        user.refresh_token_hash = self._token_hash(refresh_token)
        self.db.commit()
        logger.info("New user registered: %s", user.id)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "role": user.role,
            },
        }

    def login(self, email: str, password: str) -> dict:
        email = email.lower().strip()
        user = self.db.query(User).filter(User.email == email).first()
        if not user or not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Invalid email or password")
        if not user.is_active:
            raise ForbiddenError("Account is disabled")

        access_token = create_access_token({"sub": user.id, "role": user.role})
        refresh_token = create_refresh_token(user.id)
        user.refresh_token_hash = self._token_hash(refresh_token)
        self.db.commit()
        logger.info("User logged in: %s", user.id)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "role": user.role,
            },
        }

    def logout(self, user: User) -> dict:
        user.refresh_token_hash = None
        self.db.commit()
        return {"message": "Logged out successfully"}

    async def forgot_password(self, email: str) -> dict:
        generic_response = {"message": "If that email is registered, a reset link has been sent."}
        user = self.db.query(User).filter(User.email == email.lower().strip()).first()
        if not user:
            return generic_response

        reset_token = create_access_token({"sub": user.id, "purpose": "reset"})
        reset_link = f"{settings.frontend_url.split(',')[0].strip()}/reset-password?token={reset_token}"
        try:
            await send_email(
                user.email,
                "Reset your VastraX password",
                f'<p>We received a request to reset your password.</p>'
                f'<p><a href="{reset_link}">Click here to reset your password</a></p>'
                f'<p>If you did not request this, you can safely ignore this email.</p>',
            )
        except Exception as exc:
            logger.error("Failed to send password reset email for user %s: %s", user.id, exc)

        logger.info("Password reset requested for user: %s", user.id)
        return generic_response

    def reset_password(self, token: str, new_password: str) -> dict:
        try:
            payload = decode_token(token)
            if payload.get("purpose") != "reset":
                raise BadRequestError("Invalid reset token")
            user_id = payload.get("sub")
        except JWTError:
            raise BadRequestError("Invalid or expired reset token")

        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise BadRequestError("User not found")
        user.hashed_password = hash_password(new_password)
        self.db.commit()
        logger.info("Password reset for user: %s", user_id)
        return {"message": "Password updated successfully"}

    def refresh(self, refresh_token: str) -> dict:
        try:
            payload = decode_token(refresh_token)
            if payload.get("purpose") != "refresh":
                raise UnauthorizedError("Invalid refresh token")
            user_id = payload.get("sub")
            if not user_id:
                raise UnauthorizedError("Invalid refresh token")
        except JWTError:
            raise UnauthorizedError("Refresh token expired or invalid")

        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise UnauthorizedError("User not found")
        if not user.is_active:
            raise ForbiddenError("Account is disabled")

        stored_hash = user.refresh_token_hash or ""
        if stored_hash and stored_hash != self._token_hash(refresh_token):
            raise UnauthorizedError("Refresh token has been revoked")

        new_access = create_access_token({"sub": user.id, "role": user.role})
        new_refresh = create_refresh_token(user.id)
        user.refresh_token_hash = self._token_hash(new_refresh)
        self.db.commit()

        return {
            "access_token": new_access,
            "refresh_token": new_refresh,
            "token_type": "bearer",
        }
