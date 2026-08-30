import os
import httpx
import logging

logger = logging.getLogger(__name__)

class SMSService:
    """
    Handles SMS 2FA via 2factor.in
    """
    def __init__(self):
        self.api_key = os.getenv("TWO_FACTOR_API_KEY", "").strip()
        self.base_url = "https://2factor.in/API/V1"
        self.is_mock = not self.api_key or self.api_key == "your_2factor_api_key"

    async def send_2fa_code(self, phone_number: str) -> str:
        """
        Sends an OTP to the given phone number.
        Returns the session_id to be stored in the database.
        """
        if self.is_mock:
            # Generate a mock session ID and log it
            import uuid
            session_id = f"mock_session_{uuid.uuid4().hex[:8]}"
            logger.info(f"========== MOCK SMS ==========")
            logger.info(f"Sending OTP to {phone_number}")
            logger.info(f"MOCK SESSION ID: {session_id}")
            logger.info(f"Use any 6-digit code (e.g. 123456) to verify.")
            logger.info(f"==============================")
            return session_id

        # Real 2Factor.in Call
        url = f"{self.base_url}/{self.api_key}/SMS/{phone_number}/AUTOGEN"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                if data.get("Status") == "Success":
                    return data.get("Details")
                else:
                    logger.error(f"2Factor API Error: {data}")
                    raise Exception("Failed to send OTP")
            except Exception as e:
                logger.error(f"SMS send failed: {e}")
                raise

    async def verify_2fa_code(self, session_id: str, otp_code: str) -> bool:
        """
        Verifies the OTP code for the given session ID.
        """
        if self.is_mock:
            logger.info(f"MOCK VERIFY: Session {session_id} with code {otp_code}")
            # In mock mode, any 6-digit code works
            return len(otp_code) == 6 and otp_code.isdigit()

        # Real 2Factor.in Call
        url = f"{self.base_url}/{self.api_key}/SMS/VERIFY/{session_id}/{otp_code}"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                if data.get("Status") == "Success" and data.get("Details") == "OTP Matched":
                    return True
                return False
            except Exception as e:
                logger.error(f"SMS verification failed: {e}")
                return False
