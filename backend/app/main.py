"""VastraX API — application factory.

Startup order matters:
  1. Logging configured before anything else so all init messages are captured.
  2. Directories created before static-file mounting so mounts don't fail.
  3. CORS middleware registered before routes (FastAPI middleware ordering).
"""
from fastapi import FastAPI

from app.core.config import settings
from app.api.router import api_router
from app.middleware.cors import setup_cors
from app.core.start import initialize_directories
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging
from app.core.static_files import mount_static_files


setup_logging(debug=settings.debug)
initialize_directories()

app = FastAPI(
    title="VastraX API",
    description="Virtual try-on and AI style advisor for VastraX boutique",
    version="1.0.0",
)

register_exception_handlers(app)
setup_cors(app)
app.include_router(api_router)
mount_static_files(app)


