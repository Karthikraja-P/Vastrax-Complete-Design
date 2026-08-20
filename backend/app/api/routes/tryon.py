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
    from app.models.product import Product
    from app.services.fashn_service import detect_category, run_fashn
    from app.core.config import settings

    garment_url = payload.garment_path
    if not garment_url and payload.product_id:
        product = db.query(Product).filter(Product.id == str(payload.product_id)).first()
        if product and product.images:
            garment_url = product.images[0].s3_url

    garment_url = garment_url or "/catalog/frock_floral.jpg"
    category = payload.category or payload.garment_type or detect_category(garment_url)

    # If person photo is default or not provided, use default mannequin
    default_person = os.path.join(settings.upload_dir, "default_mannequin.jpg")
    os.makedirs(settings.upload_dir, exist_ok=True)
    if not os.path.exists(default_person):
        # Create a lightweight placeholder if missing
        with open(default_person, "wb") as f:
            f.write(b"")

    result_path = run_fashn(
        person_image_path=default_person,
        garment_image_path=garment_url,
        garment_type=category,
        results_dir=settings.results_dir,
    )
    result_filename = os.path.basename(result_path)

    return {
        "session_id": f"ses_{uuid.uuid4().hex[:8]}",
        "status": "COMPLETED",
        "result_image_url": f"/results/{result_filename}",
        "category_used": category,
        "model": "FASHN VTON 1.5",
    }


@router.post("/start")
async def start_tryon(
    person_image: UploadFile = File(...),
    product_id: str = Form(...),
    garment_type: str = Form(default=None),
    save_history: bool = Form(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await TryonService(db).start_tryon(
        person_image, product_id, garment_type, save_history, current_user
    )


@router.get("/status/{job_id}")
def get_tryon_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return TryonService(db).get_status(job_id, current_user)


@router.get("/result/{job_id}")
def get_tryon_result(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return TryonService(db).get_result(job_id, current_user)


@router.get("/history")
def tryon_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return TryonService(db).get_history(current_user)


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
