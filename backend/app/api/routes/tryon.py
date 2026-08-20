import os
import uuid
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services.tryon_service import TryonService

router = APIRouter(prefix="/try-on", tags=["tryon"])


from app.schemas.tryon import TryonSubmitRequest


@router.post("/submit")
async def submit_tryon(
    payload: TryonSubmitRequest,
    db: Session = Depends(get_db),
):
    """Unified try-on submission endpoint for JSON clients and frontend modals."""
    import base64
    from app.models.product import Product
    from app.services.fashn_service import detect_category, run_fashn
    from app.utils.file_utils import resolve_garment, try_remove
    from app.core.config import settings

    garment_url = payload.garment_path
    if not garment_url and payload.product_id:
        product = db.query(Product).filter(Product.id == str(payload.product_id)).first()
        if product and product.images:
            garment_url = product.images[0].s3_url

    garment_url = garment_url or "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=800&auto=format&fit=crop"
    category = payload.category or payload.garment_type or detect_category(garment_url)

    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(settings.results_dir, exist_ok=True)

    # 1. Resolve Person image
    person_path = None
    is_person_tmp = False
    if payload.user_photo_base64 and payload.user_photo_base64.startswith("data:image"):
        try:
            header, encoded = payload.user_photo_base64.split(",", 1)
            ext = ".png" if "png" in header else ".jpg"
            person_path = os.path.join(settings.upload_dir, f"person_{uuid.uuid4().hex[:8]}{ext}")
            with open(person_path, "wb") as pf:
                pf.write(base64.b64decode(encoded))
            is_person_tmp = True
        except Exception:
            person_path = None

    if not person_path or not os.path.exists(person_path):
        person_path = os.path.join(settings.upload_dir, "default_mannequin.jpg")
        if not os.path.exists(person_path) or os.path.getsize(person_path) == 0:
            sample_model_url = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=500&auto=format&fit=crop"
            try:
                import urllib.request
                urllib.request.urlretrieve(sample_model_url, person_path)
            except Exception:
                pass

    # 2. Resolve Garment image
    garment_local = None
    is_garment_tmp = False
    try:
        garment_local, is_garment_tmp = resolve_garment(garment_url)
    except Exception:
        garment_local = garment_url

    try:
        result_path = run_fashn(
            person_image_path=person_path,
            garment_image_path=garment_local,
            garment_type=category,
            results_dir=settings.results_dir,
        )
        result_filename = os.path.basename(result_path)
    finally:
        if is_person_tmp and person_path:
            try_remove(person_path)
        if is_garment_tmp and garment_local:
            try_remove(garment_local)

    return {
        "session_id": f"ses_{uuid.uuid4().hex[:8]}",
        "status": "COMPLETED",
        "result_image_url": f"/results/{result_filename}",
        "category_used": category,
        "model": "FASHN VTON 1.5",
    }


@router.post("")
@router.post("/")
async def try_on(
    person_image: UploadFile = File(...),
    garment_path: str = Form(...),
    garment_type: str = Form(None),
    db: Session = Depends(get_db),
):
    return await TryonService(db).try_on(person_image, garment_path, garment_type)


@router.post("/combo")
async def try_on_combo(
    person_image: UploadFile = File(...),
    top_path: str = Form(...),
    bottom_path: str = Form(...),
    db: Session = Depends(get_db),
):
    return await TryonService(db).try_on_combo(person_image, top_path, bottom_path)
