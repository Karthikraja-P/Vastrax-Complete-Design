import logging
import resend
from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError

logger = logging.getLogger(__name__)

# Initialize the resend API key from our environment variables securely
resend.api_key = settings.resend_api_key

async def send_email(to_email: str, subject: str, html_content: str) -> dict:
    """
    A generic, reusable function to send an email using Resend.
    
    Args:
        to_email (str): The recipient's email address.
        subject (str): The subject line of the email.
        html_content (str): The HTML body of the email.
        
    Returns:
        dict: The response from the Resend API, containing the email ID or error.
    """
    
    if not settings.resend_api_key:
        raise ServiceUnavailableError("Email delivery is temporarily unavailable")

    resend.api_key = settings.resend_api_key
    params = {
        "from": settings.resend_from_email,
        "to": [to_email],
        "subject": subject,
        "html": html_content,
    }

    try:
        # Resend SDK call
        response = resend.Emails.send(params)
        logger.info(f"Email sent successfully to {to_email}. Response: {response}")
        return response
    except Exception as exc:
        logger.error("Email provider delivery failed (%s)", type(exc).__name__)
        raise ServiceUnavailableError("Email delivery is temporarily unavailable") from exc
