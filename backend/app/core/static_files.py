from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.core.config import settings


def mount_static_files(app: FastAPI) -> None:
    app.mount("/results", StaticFiles(directory=settings.results_dir), name="results")
    app.mount("/api/v1/results", StaticFiles(directory=settings.results_dir), name="api_v1_results")
    app.mount("/user_uploads", StaticFiles(directory=settings.upload_dir), name="user_uploads")
    app.mount("/api/v1/user_uploads", StaticFiles(directory=settings.upload_dir), name="api_v1_user_uploads")

