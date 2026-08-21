"""Business logic for virtual try-on sessions."""
import os
import shutil
import uuid
from datetime import datetime, timezone

from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import NotFoundError, ForbiddenError, BadRequestError, InternalError
from app.core.logging import get_logger
from app.repositories.product_repository import ProductRepository
from app.repositories.tryon_repository import TryonRepository
from app.utils.file_utils import resolve_garment, try_remove

logger = get_logger(__name__)


class TryonService:
    """Handles try-on session creation, status tracking, and history retrieval."""

    def __init__(
        self,
        tryon_repo: TryonRepository | None = None,
        product_repo: ProductRepository | None = None,
    ) -> None:
        self._tryon_repo = tryon_repo or TryonRepository()
        self._product_repo = product_repo or ProductRepository()

    async def start_tryon(
        self,
        person_image: UploadFile,
        product_id: str,
        garment_type: str | None,
        save_history: bool,
        current_user: dict,
    ) -> dict:
        """Run FASHN inference for a product and persist the session record."""
        from app.services.fashn_service import detect_category, run_fashn

        session_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        person_path: str | None = None
        garment_local: str | None = None
        garment_is_tmp = False

        os.makedirs(settings.upload_dir, exist_ok=True)
        os.makedirs(settings.results_dir, exist_ok=True)

        try:
            ext = os.path.splitext(person_image.filename or "person")[1] or ".jpg"
            person_path = os.path.join(settings.upload_dir, f"person_{uuid.uuid4().hex[:8]}{ext}")
            with open(person_path, "wb") as f:
                shutil.copyfileobj(person_image.file, f)

            product = self._product_repo.get_by_id(product_id)
            if not product:
                raise NotFoundError("Product not found")
            images = product.get("images", [])
            if not images:
                raise BadRequestError("Product has no images for try-on")

            garment_url = images[0].get("s3_url", "")
            garment_local, garment_is_tmp = resolve_garment(garment_url)

            if not os.path.exists(garment_local):
                raise NotFoundError(f"Garment image not found: {garment_url}")

            category = (
                garment_type
                if garment_type in ("tops", "bottoms", "one-pieces")
                else detect_category(garment_url)
            )

            session = {
                "id": session_id,
                "user_id": current_user["id"],
                "product_id": product_id,
                "user_photo_url": person_path if save_history else "",
                "result_image_url": "",
                "fashn_job_id": session_id,
                "status": "processing",
                "created_at": now,
            }
            self._tryon_repo.create(session)

            result_path = run_fashn(
                person_image_path=person_path,
                garment_image_path=garment_local,
                garment_type=category,
                results_dir=settings.results_dir,
            )
            result_url = f"/results/{os.path.basename(result_path)}"
            self._tryon_repo.mark_done(session_id, result_url)
            logger.info("Try-on complete: %s for user: %s", session_id, current_user["id"])

            return {"status": "done", "job_id": session_id, "result_url": result_url, "category_used": category}

        except (NotFoundError, BadRequestError, ForbiddenError):
            self._tryon_repo.mark_failed(session_id)
            raise
        except Exception as exc:
            self._tryon_repo.mark_failed(session_id)
            logger.error("Try-on failed for session %s: %s", session_id, exc)
            raise InternalError(str(exc))
        finally:
            try_remove(person_path)
            if garment_is_tmp:
                try_remove(garment_local)

    def get_status(self, job_id: str, current_user: dict) -> dict:
        """Return the current processing status of a try-on session."""
        session = self._tryon_repo.get_by_id(job_id)
        if not session:
            raise NotFoundError("Session not found")
        if session.get("user_id") != current_user["id"]:
            raise ForbiddenError("Access denied")
        return {"job_id": job_id, "status": session.get("status"), "result_url": session.get("result_image_url", "")}

    def get_result(self, job_id: str, current_user: dict) -> dict:
        """Return the result image URL for a completed try-on session."""
        session = self._tryon_repo.get_by_id(job_id)
        if not session:
            raise NotFoundError("Session not found")
        if session.get("user_id") != current_user["id"]:
            raise ForbiddenError("Access denied")
        if session.get("status") != "done":
            raise BadRequestError("Result not yet ready")
        return {"result_url": session.get("result_image_url", "")}

    def get_history(self, current_user: dict) -> list:
        """Return all try-on sessions for the authenticated user, newest first."""
        sessions = self._tryon_repo.list_by_user(current_user["id"])
        sessions.sort(key=lambda s: s.get("created_at", ""), reverse=True)
        return sessions

    async def try_on(
        self,
        person_image: UploadFile,
        garment_path: str,
        garment_type: str | None = None,
    ) -> dict:
        """Legacy single-garment try-on endpoint (no session persistence)."""
        from app.services.fashn_service import detect_category, run_fashn

        person_path: str | None = None
        garment_local: str | None = None
        is_tmp = False

        try:
            ext = os.path.splitext(person_image.filename or "person")[1] or ".jpg"
            person_path = os.path.join(settings.upload_dir, f"person_{uuid.uuid4().hex[:8]}{ext}")
            with open(person_path, "wb") as fh:
                shutil.copyfileobj(person_image.file, fh)

            garment_local, is_tmp = resolve_garment(garment_path)

            if not os.path.exists(garment_local):
                raise NotFoundError(f"Garment image not found: {garment_path}")

            category = (
                garment_type
                if garment_type in ("tops", "bottoms", "one-pieces")
                else detect_category(garment_path)
            )

            result_path = run_fashn(
                person_image_path=person_path,
                garment_image_path=garment_local,
                garment_type=category,
                results_dir=settings.results_dir,
            )

            return {
                "status": "success",
                "result_url": f"/results/{os.path.basename(result_path)}",
                "category_used": category,
                "model": "FASHN VTON 1.5",
            }

        except (NotFoundError, BadRequestError):
            raise
        except Exception as exc:
            raise InternalError(str(exc))
        finally:
            try_remove(person_path)
            if is_tmp:
                try_remove(garment_local)

    async def try_on_combo(
        self,
        person_image: UploadFile,
        top_path: str,
        bottom_path: str,
    ) -> dict:
        """Legacy combo try-on: applies top garment then bottom garment sequentially."""
        from app.services.fashn_service import run_fashn

        person_path: str | None = None
        top_local: str | None = None
        bottom_local: str | None = None
        intermediate: str | None = None
        top_is_tmp = bottom_is_tmp = False

        try:
            ext = os.path.splitext(person_image.filename or "person")[1] or ".jpg"
            person_path = os.path.join(settings.upload_dir, f"person_{uuid.uuid4().hex[:8]}{ext}")
            with open(person_path, "wb") as fh:
                shutil.copyfileobj(person_image.file, fh)

            top_local, top_is_tmp = resolve_garment(top_path)
            bottom_local, bottom_is_tmp = resolve_garment(bottom_path)

            if not os.path.exists(top_local):
                raise NotFoundError(f"Top garment not found: {top_path}")
            if not os.path.exists(bottom_local):
                raise NotFoundError(f"Bottom garment not found: {bottom_path}")

            intermediate = run_fashn(
                person_image_path=person_path,
                garment_image_path=top_local,
                garment_type="tops",
                results_dir=settings.upload_dir,
            )

            result_path = run_fashn(
                person_image_path=intermediate,
                garment_image_path=bottom_local,
                garment_type="bottoms",
                results_dir=settings.results_dir,
            )

            return {
                "status": "success",
                "result_url": f"/results/{os.path.basename(result_path)}",
                "category_used": "combo (tops + bottoms)",
                "model": "FASHN VTON 1.5",
            }

        except (NotFoundError, BadRequestError):
            raise
        except Exception as exc:
            raise InternalError(str(exc))
        finally:
            try_remove(person_path)
            try_remove(intermediate)
            if top_is_tmp:
                try_remove(top_local)
            if bottom_is_tmp:
                try_remove(bottom_local)
