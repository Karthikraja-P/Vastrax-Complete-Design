import hashlib
import random
import uuid
from datetime import datetime, timedelta, timezone

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
from app.models.otp import OTP, _now
from app.models.user import User
from app.services.email_service import send_email

logger = get_logger(__name__)


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def _token_hash(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    async def register(self, full_name: str, email: str, phone_number: str, password: str) -> dict:
        email = email.lower().strip()
        phone = phone_number.strip()
        
        # Check if email is registered to an active account
        existing_user = self.db.query(User).filter(User.email == email).first()
        if existing_user and existing_user.is_active:
            raise ConflictError("Email already registered")

        # Check if phone number is registered to another active account
        existing_phone = self.db.query(User).filter(User.phone_number == phone).first()
        if existing_phone and existing_phone.is_active and existing_phone.email != email:
            raise ConflictError("Phone number already registered")

        if existing_user and not existing_user.is_active:
            user = existing_user
            user.full_name = full_name.strip()
            user.phone_number = phone
            user.hashed_password = hash_password(password)
        else:
            user = User(
                id=str(uuid.uuid4()),
                full_name=full_name.strip(),
                email=email,
                phone_number=phone,
                hashed_password=hash_password(password),
                role="customer",
                is_active=False,
                is_2fa_enabled=False,
            )
            self.db.add(user)
        
        self.db.flush()

        # Invalidate existing unused OTPs for this email
        old_otps = self.db.query(OTP).filter(OTP.identifier == email, OTP.is_used == False).all()
        for o in old_otps:
            o.is_used = True

        # Generate 6-digit OTP code (10 minutes expiration)
        code = str(random.randint(100000, 999999))
        expires_at = _now() + timedelta(minutes=10)
        new_otp = OTP(
            identifier=email,
            code=code,
            expires_at=expires_at,
            is_used=False
        )
        self.db.add(new_otp)
        self.db.commit()

        # Send OTP via Email
        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background-color: #0A192F; color: #FFFFFF; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #D4AF37; font-size: 28px; margin: 0; font-weight: 600; letter-spacing: 2px;">VASTRAX</h1>
            <p style="color: #94A3B8; font-size: 14px; margin-top: 4px;">HAUTE COUTURE & LUXURY DIGITAL FITTING</p>
          </div>
          <div style="background-color: #112240; padding: 24px; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2);">
            <h2 style="color: #FFFFFF; font-size: 20px; margin-top: 0;">Verify Your Email Address</h2>
            <p style="color: #CBD5E1; font-size: 15px; line-height: 1.5;">Hello {full_name},</p>
            <p style="color: #CBD5E1; font-size: 15px; line-height: 1.5;">Welcome to VastraX! Please use the 6-digit verification code below to complete your registration:</p>
            <div style="text-align: center; margin: 28px 0;">
              <span style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #D4AF37; background: #0A192F; padding: 14px 28px; border-radius: 8px; border: 1px solid #D4AF37;">{code}</span>
            </div>
            <p style="color: #94A3B8; font-size: 13px; line-height: 1.4;">This verification code will expire in 10 minutes. If you did not request this account creation, please ignore this email.</p>
          </div>
        </div>
        """
        try:
            await send_email(to_email=email, subject="Your VastraX Verification Code", html_content=html_content)
        except Exception as exc:
            logger.warning("Failed sending OTP email to %s: %s", email, exc)

        logger.info("Verification OTP sent to email %s for user %s (code: %s)", email, user.id, code)

        return {
            "status": "requires_verification",
            "user_id": user.id,
            "email": user.email,
            "message": f"Verification code sent to {email}."
        }

    async def login(self, email_or_phone: str, password: str) -> dict:
        identifier = email_or_phone.strip()
        user = self.db.query(User).filter(
            (User.email == identifier.lower()) | (User.phone_number == identifier) | (User.phone_number == f"+91{identifier}")
        ).first()

        if not user or not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Invalid email/mobile number or password")
        if not user.is_active:
            raise ForbiddenError("Account is not verified. Please complete email verification.")

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
                "phone_number": user.phone_number,
                "role": user.role,
            },
        }

    async def verify_2fa(self, user_id: str, code: str) -> dict:
        return await self.verify_registration(user_id, code)

    async def verify_registration(self, user_id: str, code: str) -> dict:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise UnauthorizedError("User not found")

        if not user.is_active:
            clean_code = code.strip()
            otp = self.db.query(OTP).filter(
                OTP.identifier == user.email,
                OTP.code == clean_code,
                OTP.is_used == False
            ).order_by(OTP.created_at.desc()).first()

            if not otp:
                raise UnauthorizedError("Invalid verification code")

            otp_expires_at = otp.expires_at
            if otp_expires_at.tzinfo is None:
                otp_expires_at = otp_expires_at.replace(tzinfo=timezone.utc)

            if otp_expires_at < _now():
                raise UnauthorizedError("Verification code has expired. Please sign up again to receive a new code.")

            otp.is_used = True
            user.is_active = True

        access_token = create_access_token({"sub": user.id, "role": user.role})
        refresh_token = create_refresh_token(user.id)
        user.refresh_token_hash = self._token_hash(refresh_token)
        self.db.commit()
        logger.info("User verified registration via email OTP: %s", user.id)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "phone_number": user.phone_number,
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
