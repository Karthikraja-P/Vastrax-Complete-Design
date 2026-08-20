import asyncio
from app.services.email_service import send_email

async def main():
    print("Sending test email using Resend...")
    try:
        response = await send_email(
            to_email="7stechnolab@gmail.com",
            subject="VastraX - Resend Test Email",
            html_content="<h1>Resend is working!</h1>\n<p>This is a test email from the VastraX FastAPI backend.</p>"
        )
        print("Success! Response from Resend:", response)
    except Exception as e:
        print("Failed to send email. Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
