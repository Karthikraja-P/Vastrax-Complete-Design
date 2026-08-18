from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.core.config import settings


def mount_static_files(app: FastAPI) -> None:
    app.mount("/results", StaticFiles(directory=settings.results_dir), name="results")
