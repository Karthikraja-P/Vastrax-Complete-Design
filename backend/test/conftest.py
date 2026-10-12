"""Keep backend tests isolated from the developer\x27s local production settings."""
import os
import tempfile
_test_dir = tempfile.TemporaryDirectory(prefix="vastrax-backend-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_test_dir.name}/test.db"
os.environ["JWT_SECRET_KEY"] = "e2e-test-key-e2e-test-key-e2e-test-key"
os.environ["APP_ENV"] = "development"
os.environ["RAZORPAY_KEY_ID"] = "rzp_test_MOCK"
os.environ["RAZORPAY_KEY_SECRET"] = "MOCK_SECRET"
os.environ["RAZORPAY_WEBHOOK_SECRET"] = "MOCK_WEBHOOK_SECRET"
