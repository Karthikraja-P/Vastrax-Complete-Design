from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import SessionLocal, get_db
from app.middleware.auth import require_admin
from app.models.user import User
from app.models.product import Product
from app.core.config import settings
from app.services.glb import normalize_embedded_image_mime
import asyncio
import logging
import os
import time
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/3d", tags=["3D Generation"])
_JOBS: dict[str, dict] = {}
_JOB_TASKS: dict[str, asyncio.Task] = {}
_MAX_RETAINED_JOBS = 100


def _prune_jobs() -> None:
    completed = sorted(
        ((job_id, job.get("created_at", 0)) for job_id, job in _JOBS.items()
         if job.get("status") in {"completed", "failed"} and job_id not in _JOB_TASKS),
        key=lambda item: item[1],
    )
    for job_id, _ in completed[:-_MAX_RETAINED_JOBS]:
        _JOBS.pop(job_id, None)


async def _run_generation(job_id: str, product_id: str | None, category_id: str | None,
                          product_name: str | None, photo_paths: dict[str, tuple[str, str]]) -> None:
    from app.core.gpu_queue import gpu_queue

    generator_url = os.getenv("GENERATOR_3D_URL", "http://172.17.0.1:8081")
    _JOBS[job_id].update(status="queued", message="Waiting for virtual try-on jobs to clear the GPU.")
    try:
        async with gpu_queue.acquire(f"3d_reconstruct_{job_id}"):
            _JOBS[job_id].update(status="processing", message="Generating and texturing the 3D model.")
            import httpx

            files = {}
            handles = []
            try:
                for field, (path, content_type) in photo_paths.items():
                    handle = open(path, "rb")
                    handles.append(handle)
                    files[field] = (os.path.basename(path), handle, content_type)

                data = {}
                if product_id:
                    data["product_id"] = product_id
                if category_id:
                    data["category_id"] = category_id
                if product_name:
                    data["product_name"] = product_name

                async with httpx.AsyncClient(timeout=1260.0) as client:
                    response = await client.post(
                        f"{generator_url}/generate",
                        files=files,
                        data=data,
                        headers={"X-Generator-Key": os.environ["GENERATOR_3D_SECRET"]},
                    )
                    if response.status_code != 200:
                        logger.warning("3D generator returned %s: %s", response.status_code, response.text[:500])
                        raise RuntimeError("3D reconstruction failed. No model was attached; please retry.")
                    result = response.json()
                    model_url = result.get("model_url")
                    generation_mode = result.get("generation_mode", "unknown")
                    if generation_mode != "hunyuan_textured":
                        raise RuntimeError("Hunyuan did not return a textured garment-specific model. No model was attached.")
                    if not model_url or not model_url.startswith("/models/3d/"):
                        raise RuntimeError("3D service returned an invalid model path.")
                    model_response = await client.get(f"{generator_url}{model_url}")
                    model_bytes = model_response.content
                    if (model_response.status_code != 200 or not model_bytes.startswith(b"glTF")
                            or len(model_bytes) > 100 * 1024 * 1024):
                        raise RuntimeError("3D service returned an invalid model file.")
            finally:
                for handle in handles:
                    handle.close()

            try:
                model_bytes = normalize_embedded_image_mime(model_bytes)
            except ValueError as exc:
                logger.warning("3D service returned a malformed GLB: %s", exc)
                raise RuntimeError("3D service returned a malformed model file.") from exc

            os.makedirs(settings.results_dir, exist_ok=True)
            model_path = os.path.join(settings.results_dir, f"{job_id}.glb")
            temp_path = f"{model_path}.tmp"
            with open(temp_path, "wb") as model_file:
                model_file.write(model_bytes)
            os.replace(temp_path, model_path)
            model_url = f"/results/{job_id}.glb"

            if product_id:
                db = SessionLocal()
                try:
                    product = db.query(Product).filter(Product.id == product_id).first()
                    if product:
                        product.model_path = model_url
                        db.commit()
                finally:
                    db.close()

            _JOBS[job_id].update(
                status="completed",
                message="Textured 3D model is ready to preview.",
                model_url=model_url,
                generation_mode=generation_mode,
            )
    except Exception as exc:
        logger.exception("3D generation job %s failed: %s", job_id, exc)
        message = exc.detail if isinstance(exc, HTTPException) else str(exc)
        _JOBS[job_id].update(status="failed", message=message, error=message)
    finally:
        for path, _ in photo_paths.values():
            try:
                os.remove(path)
            except OSError:
                pass
        _JOB_TASKS.pop(job_id, None)


@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_3d_mesh(
    product_id: str = Form(None),
    category_id: str = Form(None),
    product_name: str = Form(None),
    front_image: UploadFile = File(...),
    side_image: UploadFile = File(...),
    back_image: UploadFile = File(...),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    # Queue the admin job and return immediately so public HTTP proxies do not time it out.
    job_id = f"job_3d_{uuid.uuid4().hex[:8]}"
    if product_id:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        category_id = category_id or product.category_id or ""
        product_name = product_name or product.name or ""

    uploads_dir = settings.upload_dir
    os.makedirs(uploads_dir, exist_ok=True)
    photo_paths: dict[str, tuple[str, str]] = {}
    try:
        for field, upload in (("front_image", front_image), ("side_image", side_image), ("back_image", back_image)):
            suffix = os.path.splitext(os.path.basename(upload.filename or "photo.jpg"))[1].lower()
            if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
                suffix = ".jpg"
            path = os.path.join(uploads_dir, f"{job_id}_{field}{suffix}")
            content = await upload.read()
            if not content:
                raise HTTPException(status_code=400, detail=f"{field.replace('_', ' ').capitalize()} is empty")
            with open(path, "wb") as target:
                target.write(content)
            photo_paths[field] = (path, upload.content_type or "image/jpeg")
    except Exception:
        for path, _ in photo_paths.values():
            try:
                os.remove(path)
            except OSError:
                pass
        raise

    _prune_jobs()
    _JOBS[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "message": "3D reconstruction queued.",
        "created_at": time.time(),
    }
    _JOB_TASKS[job_id] = asyncio.create_task(
        _run_generation(job_id, product_id, category_id, product_name, photo_paths)
    )
    return {"job_id": job_id, "status": "queued", "message": "3D reconstruction queued."}


@router.get("/jobs/{job_id}")
def get_3d_job(job_id: str, current_user: User = Depends(require_admin)):
    job = _JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="3D generation job not found or expired")
    return {key: value for key, value in job.items() if key != "created_at"}
