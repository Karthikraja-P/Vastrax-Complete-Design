import random
import os
import httpx
from datetime import timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.db.database import get_db
from app.models.otp import OTP
from app.services.email_service import send_email

router = APIRouter()

class OTPSendRequest(BaseModel):
    email: EmailStr | None = None
    phone_number: str | None = None

class OTPVerifyRequest(BaseModel):
    email: EmailStr | None = None
    phone_number: str | None = None
    code: str
    first_name: str | None = None
    last_name: str | None = None

def generate_otp_code() -> str:
    """Generates a random 6-digit OTP."""
    return str(random.randint(100000, 999999))

@router.post("/send", status_code=status.HTTP_200_OK)
async def send_otp(request: OTPSendRequest, db: Session = Depends(get_db)):
    """
    Generate a 6-digit OTP, store it in the database, and send it via email or SMS.
    """
    if not request.email and not request.phone_number:
        raise HTTPException(status_code=400, detail="Either email or phone_number must be provided.")
        
    identifier = request.phone_number if request.phone_number else request.email

    # 1. Invalidate any existing unused OTPs for this identifier to prevent spam
    existing_otps = db.query(OTP).filter(OTP.identifier == identifier, OTP.is_used == False).all()
    for otp in existing_otps:
        otp.is_used = True
    
    # 2. Generate new OTP and expiration time (e.g., 10 minutes from now)
    code = generate_otp_code()
    from app.models.otp import _now
    expires_at = _now() + timedelta(minutes=10)
    
    # 3. Save to database
    new_otp = OTP(
        identifier=identifier,
        code=code,
        expires_at=expires_at,
        is_used=False
    )
    db.add(new_otp)
    db.commit()
    
    # 4. Dispatch Email or SMS
    if request.phone_number:
        # Send SMS via Fast2SMS / MSG91
        try:
            sms_api_key = os.getenv("SMS_API_KEY")
            if not sms_api_key:
                raise ValueError("SMS_API_KEY is missing from environment variables")
                
            async with httpx.AsyncClient() as client:
                # Fast2SMS requires numbers without the '+' sign, just country code or local
                # If +91 is present, we strip the + or just pass it depending on the provider
                clean_phone = request.phone_number.replace("+", "")
                
                payload = {
                    "variables_values": code,
                    "route": "otp",
                    "numbers": clean_phone,
                }
                headers = {
                    "authorization": sms_api_key,
                    "Content-Type": "application/x-www-form-urlencoded"
                }
                
                response = await client.post("https://www.fast2sms.com/dev/bulkV2", data=payload, headers=headers)
                
                if response.status_code >= 400:
                    raise Exception(f"SMS Provider returned {response.status_code}: {response.text}")
                    
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to send OTP SMS: {str(e)}")
    else:
        # Send Email via Resend
        html_content = f"""
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>VastraX Verification Code</h2>
            <p>Your one-time password (OTP) is:</p>
            <h1 style="letter-spacing: 5px; color: #D4AF37;">{code}</h1>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, you can safely ignore this email.</p>
        </div>
        """
        try:
            await send_email(
                to_email=request.email,
                subject="Your VastraX Verification Code",
                html_content=html_content
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail="Failed to send OTP email.")
        
    return {"message": "OTP sent successfully"}

@router.post("/verify", status_code=status.HTTP_200_OK)
async def verify_otp(request: OTPVerifyRequest, db: Session = Depends(get_db)):
    """
    Verify the 6-digit OTP provided by the user.
    """
    if not request.email and not request.phone_number:
        raise HTTPException(status_code=400, detail="Either email or phone_number must be provided.")
        
    identifier = request.phone_number if request.phone_number else request.email

    from app.models.otp import _now
    
    # Find the latest unused OTP for this identifier
    otp = db.query(OTP).filter(
        OTP.identifier == identifier,
        OTP.code == request.code,
        OTP.is_used == False
    ).first()
    
    if not otp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP")
        
    otp_expires_at = otp.expires_at
    if otp_expires_at.tzinfo is None:
        otp_expires_at = otp_expires_at.replace(tzinfo=timezone.utc)

    if otp_expires_at < _now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP has expired")
        
    # Mark as used
    otp.is_used = True
    
    # ---------------------------------------------------------
    # REAL DATABASE INTEGRATION: Fetch or Create User
    # ---------------------------------------------------------
    from app.models.user import User
    
    # Check if user already exists
    if request.phone_number:
        user = db.query(User).filter(User.phone_number == request.phone_number).first()
    else:
        user = db.query(User).filter(User.email == request.email).first()
    
    if not user:
        # Create a new user if they don't exist
        # We handle both single full_name or split first/last names
        full_name = None
        if request.first_name or request.last_name:
            full_name = f"{request.first_name or ''} {request.last_name or ''}".strip()
            
        user = User(
            email=request.email or f"{request.phone_number}@vastrax-mobile.local",
            phone_number=request.phone_number,
            full_name=full_name,
            hashed_password="NOPASSWORD_OTP", # Users via OTP do not have passwords
            role="customer",
            is_active=True
        )
        db.add(user)
    
    db.commit()
    db.refresh(user)
    
    # Generate JWT
    from app.core.security import create_access_token
    access_token = create_access_token({"sub": user.id})
    
    # Return the real user details to the frontend
    return {
        "message": "OTP verified successfully",
        "access_token": access_token,
        "user": {
            "id": user.id,
            "name": user.full_name,
            "email": user.email,
            "phone_number": user.phone_number,
            "role": user.role
        }
    }
