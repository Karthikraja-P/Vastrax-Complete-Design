import os
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "sqlite:////home/pkr/Vastrax-Complete-Design/backend/vastrax.db"

    # AWS (S3 for image uploads only — no DynamoDB)
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_default_region: str = "ap-south-1"
    aws_s3_bucket: str = "vastrax-assets"
    aws_lambda_function_name: str = ""

    # JWT
    jwt_secret_key: str = ""
    access_token_expire_minutes: int = 60

    # Razorpay
    razorpay_key_id: str = "rzp_test_MOCK"
    razorpay_key_secret: str = "MOCK_SECRET"
    razorpay_webhook_secret: str = "MOCK_WEBHOOK_SECRET"

    # App
    allowed_origins: str = "*"
    frontend_url: str = "http://localhost:3000,https://d11ldjfc82x9pb.cloudfront.net"
    debug: bool = False

    # Directories (computed below if not set explicitly)
    upload_dir: str = ""
    results_dir: str = ""

    # FASHN VTON
    fashn_tryon_url: str = ""
    fashn_venv: str = "/home/pkr/fashn-tryon/venv/bin/python"
    fashn_script: str = "/home/pkr/fashn-tryon/fashn-vton-1.5/examples/basic_inference.py"
    fashn_weights: str = "/home/pkr/fashn-tryon/fashn-vton-1.5/weights"
    fashn_output: str = "/home/pkr/fashn-tryon/fashn-vton-1.5/results/output_00.png"
    fashn_results: str = "/home/pkr/fashn-tryon/fashn-vton-1.5/results"

    # Anthropic
    anthropic_api_key: str = ""

    # Resend Email
    resend_api_key: str = ""
    resend_from_email: str = "onboarding@resend.dev"

    @model_validator(mode="after")
    def _resolve_dirs(self) -> "Settings":
        _backend = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".."))
        _is_lambda = bool(self.aws_lambda_function_name)

        if not self.upload_dir:
            self.upload_dir = "/tmp/user_uploads" if _is_lambda else os.path.join(_backend, "user_uploads")
        if not self.results_dir:
            self.results_dir = "/tmp/results" if _is_lambda else os.path.join(_backend, "results")

        if not self.jwt_secret_key:
            self.jwt_secret_key = os.getenv("SECRET_KEY", "vastrax-jwt-secret-key-min-32-chars-long!!")
        if not self.aws_access_key_id:
            self.aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID", "")
        if not self.aws_secret_access_key:
            self.aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY", "")
        if not self.aws_s3_bucket:
            self.aws_s3_bucket = os.getenv("AWS_S3_BUCKET", "vastrax-assets")

        return self


settings = Settings()
