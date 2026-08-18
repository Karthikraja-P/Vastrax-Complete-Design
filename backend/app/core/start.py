"""Application startup routines."""
import os

from app.core.config import settings


def initialize_directories() -> None:
    """Create upload and result directories if they do not exist."""
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(settings.results_dir, exist_ok=True)
