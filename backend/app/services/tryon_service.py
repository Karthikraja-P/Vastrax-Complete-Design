import os
import re
import shutil
import uuid

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import BadRequestError, ForbiddenError, InternalError, NotFoundError
from app.core.logging import get_logger
from app.models.product import Product
from app.models.tryon_session import TryonSession
from app.models.user import User
from app.schemas.tryon import TryonSessionResponse
from app.utils.file_utils import resolve_garment, try_remove

logger = get_logger(__name__)

_TWO_PIECE_SET_NAME = re.compile(
    r"\bcoord(?:inate)?\b|\bco[- ]?ord\b|\btwo[- ]?piece\b|\b2[- ]?piece\b|\bset\b|skirt\s*(?:and|&)\s*top|top\s*(?:and|&)\s*skirt",
    re.IGNORECASE,
)


def _normalize_two_piece_person_image(image_path: str) -> None:
    """Center-crop square try-on photos to FASHN's portrait framing.

    FASHN's person parser can miss lower-body garments when a full-length model
    is packed into a square canvas. Keep the full height and trim only the side
    margins, leaving already-portrait photos untouched.
    """
    from PIL import Image, ImageOps

    with Image.open(image_path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        width, height = image.size
        aspect_ratio = width / height
        if not 0.9 <= aspect_ratio <= 1.1:
            return

        target_width = min(width, round(height * 0.75))
        left = (width - target_width) // 2
        image.crop((left, 0, left + target_width, height)).save(image_path)


class TryonService:
    def __init__(self, db: Session | None = None) -> None:
        self.db = db

    async def start_tryon(
        self,
        person_image: UploadFile,
        product_id: str,
        garment_type: str | None,
        save_history: bool,
        user: User,
    ) -> dict:
        from app.services.fashn_service import detect_category, run_fashn

        session_id = str(uuid.uuid4())
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

            product = self.db.query(Product).filter(Product.id == product_id).first()
            if not product:
                raise NotFoundError("Product not found")
            if not product.images:
                raise BadRequestError("Product has no images for try-on")

            garment_url = product.images[0].s3_url
            garment_local, garment_is_tmp = resolve_garment(garment_url)

            if not os.path.exists(garment_local):
                raise NotFoundError(f"Garment image not found: {garment_url}")

            category = (
                garment_type
                if garment_type in ("tops", "bottoms", "one-pieces")
                else detect_category(garment_url)
            )

            session = TryonSession(
                id=session_id,
                user_id=user.id,
                product_id=product_id,
                user_photo_url=person_path if save_history else None,
                result_image_url=None,
                fashn_job_id=session_id,
                status="processing",
            )
            self.db.add(session)
            self.db.commit()

            from app.core.gpu_queue import gpu_queue
            import asyncio

            async with gpu_queue.acquire(f"tryon_start_{session_id}"):
                result_path = await asyncio.to_thread(
                    run_fashn,
                    person_image_path=person_path,
                    garment_image_path=garment_local,
                    garment_type=category,
                    results_dir=settings.results_dir,
                )
            result_url = f"/results/{os.path.basename(result_path)}"

            session.status = "done"
            session.result_image_url = result_url
            self.db.commit()
            logger.info("Try-on complete: %s for user: %s", session_id, user.id)

            return {"status": "done", "job_id": session_id, "result_url": result_url, "category_used": category}

        except (NotFoundError, BadRequestError, ForbiddenError, HTTPException):
            self._mark_failed(session_id)
            raise
        except Exception as exc:
            self._mark_failed(session_id)
            logger.error("Try-on failed for session %s: %s", session_id, exc)
            raise InternalError(str(exc))
        finally:
            try_remove(person_path)
            if garment_is_tmp:
                try_remove(garment_local)

    def _mark_failed(self, session_id: str) -> None:
        session = self.db.query(TryonSession).filter(TryonSession.id == session_id).first()
        if session:
            session.status = "failed"
            self.db.commit()

    def get_status(self, job_id: str, user: User) -> dict:
        session = self.db.query(TryonSession).filter(TryonSession.id == job_id).first()
        if not session:
            raise NotFoundError("Session not found")
        if session.user_id != user.id:
            raise ForbiddenError("Access denied")
        return {
            "job_id": job_id,
            "status": session.status,
            "result_url": session.result_image_url or "",
        }

    def get_result(self, job_id: str, user: User) -> dict:
        session = self.db.query(TryonSession).filter(TryonSession.id == job_id).first()
        if not session:
            raise NotFoundError("Session not found")
        if session.user_id != user.id:
            raise ForbiddenError("Access denied")
        if session.status != "done":
            raise BadRequestError("Result not yet ready")
        return {"result_url": session.result_image_url or ""}

    def get_history(self, user: User) -> list[TryonSessionResponse]:
        sessions = (
            self.db.query(TryonSession)
            .filter(TryonSession.user_id == user.id)
            .order_by(TryonSession.created_at.desc())
            .all()
        )
        return [TryonSessionResponse.model_validate(s) for s in sessions]

    def _log_session(
        self, user: User | None, product_id: str | None, status: str, result_image_url: str | None = None
    ) -> None:
        """Best-effort usage record for admin analytics. Never lets logging break the try-on response."""
        if not self.db or not user:
            return
        try:
            self.db.add(
                TryonSession(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    product_id=product_id,
                    result_image_url=result_image_url,
                    status=status,
                )
            )
            self.db.commit()
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Failed to log try-on usage session: %s", exc)
            self.db.rollback()

    async def try_on(
        self,
        person_image: UploadFile,
        garment_path: str,
        garment_type: str | None = None,
        user: User | None = None,
        product_id: str | None = None,
    ) -> dict:
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
            from app.core.gpu_queue import gpu_queue
            import asyncio

            async with gpu_queue.acquire(f"tryon_direct_{uuid.uuid4().hex[:6]}"):
                result_path = await asyncio.to_thread(
                    run_fashn,
                    person_image_path=person_path,
                    garment_image_path=garment_local,
                    garment_type=category,
                    results_dir=settings.results_dir,
                )
            result_url = f"/results/{os.path.basename(result_path)}"
            self._log_session(user, product_id, "done", result_url)
            return {
                "status": "success",
                "result_url": result_url,
                "category_used": category,
                "model": "FASHN VTON 1.5",
            }
        except (NotFoundError, BadRequestError):
            self._log_session(user, product_id, "failed")
            raise
        except HTTPException:
            raise
        except Exception as exc:
            self._log_session(user, product_id, "failed")
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
        user: User | None = None,
        product_id: str | None = None,
    ) -> dict:
        from app.services.fashn_service import run_fashn

        person_path: str | None = None
        top_local: str | None = None
        bottom_local: str | None = None
        full_look_local: str | None = None
        intermediate: str | None = None
        top_is_tmp = bottom_is_tmp = full_look_is_tmp = False

        try:
            ext = os.path.splitext(person_image.filename or "person")[1] or ".jpg"
            person_path = os.path.join(settings.upload_dir, f"person_{uuid.uuid4().hex[:8]}{ext}")
            with open(person_path, "wb") as fh:
                shutil.copyfileobj(person_image.file, fh)

            _normalize_two_piece_person_image(person_path)

            top_local, top_is_tmp = resolve_garment(top_path)
            bottom_local, bottom_is_tmp = resolve_garment(bottom_path)

            if not os.path.exists(top_local):
                raise NotFoundError(f"Top garment not found: {top_path}")
            if not os.path.exists(bottom_local):
                raise NotFoundError(f"Bottom garment not found: {bottom_path}")

            full_look_reference = None
            product = None
            if product_id and self.db:
                product = self.db.query(Product).filter(Product.id == str(product_id)).first()
                full_look_reference = next(
                    (image for image in (product.images if product else []) if image.tryon_role == "set"),
                    None,
                )
            if product and _TWO_PIECE_SET_NAME.search(product.name or "") and not full_look_reference:
                raise BadRequestError(
                    "This two-piece set needs a complete outfit photo marked Full Look before try-on can run."
                )
            if full_look_reference:
                full_look_local, full_look_is_tmp = resolve_garment(full_look_reference.s3_url)
                if not os.path.exists(full_look_local):
                    raise NotFoundError(f"Full outfit reference not found: {full_look_reference.s3_url}")

            from app.core.gpu_queue import gpu_queue
            import asyncio

            async with gpu_queue.acquire(f"tryon_combo_{uuid.uuid4().hex[:6]}"):
                if full_look_local:
                    # A complete modeled outfit preserves the real set silhouette and
                    # hem. FASHN transfers that reference onto the uploaded person in one pass.
                    result_path = await asyncio.to_thread(
                        run_fashn,
                        person_image_path=person_path,
                        garment_image_path=full_look_local,
                        garment_type="one-pieces",
                        results_dir=settings.results_dir,
                        garment_photo_type="model",
                        segmentation_free=True,
                    )
                    category_used = "adaptive full-look reference"
                else:
                    # Without a full-look reference, retain the two-pass separate garment flow.
                    intermediate = await asyncio.to_thread(
                        run_fashn,
                        person_image_path=person_path,
                        garment_image_path=bottom_local,
                        garment_type="bottoms",
                        results_dir=settings.upload_dir,
                        garment_photo_type="flat-lay",
                        segmentation_free=True,
                    )
                    result_path = await asyncio.to_thread(
                        run_fashn,
                        person_image_path=intermediate,
                        garment_image_path=top_local,
                        garment_type="tops",
                        results_dir=settings.results_dir,
                        garment_photo_type="flat-lay",
                    )
                    category_used = "combo (tops + bottoms)"
            result_url = f"/results/{os.path.basename(result_path)}"
            self._log_session(user, product_id, "done", result_url)
            return {
                "status": "success",
                "result_url": result_url,
                "category_used": category_used,
                "model": "FASHN VTON 1.5",
            }
        except (NotFoundError, BadRequestError):
            self._log_session(user, product_id, "failed")
            raise
        except HTTPException:
            raise
        except Exception as exc:
            self._log_session(user, product_id, "failed")
            raise InternalError(str(exc))
        finally:
            try_remove(person_path)
            try_remove(intermediate)
            if top_is_tmp:
                try_remove(top_local)
            if bottom_is_tmp:
                try_remove(bottom_local)
            if full_look_is_tmp:
                try_remove(full_look_local)
