import re

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.core.config import settings


class ProductImageFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200 and re.fullmatch(r"products/[a-f0-9]{64}\.webp", path):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


def mount_static_files(app: FastAPI) -> None:
    app.mount("/results", StaticFiles(directory=settings.results_dir), name="results")
    app.mount("/api/v1/results", StaticFiles(directory=settings.results_dir), name="api_v1_results")
    app.mount("/user_uploads", ProductImageFiles(directory=settings.upload_dir), name="user_uploads")
