from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.middleware.auth import get_current_user
from app.services.tryon_service import TryonService

router = APIRouter(prefix="/tryon", tags=["tryon"])
_service = TryonService()


@router.post("/start")
async def start_tryon(
    person_image: UploadFile = File(...),
    product_id: str = Form(...),
    garment_type: str = Form(default=None),
    save_history: bool = Form(default=False),
    current_user: dict = Depends(get_current_user),
):
    return await _service.start_tryon(person_image, product_id, garment_type, save_history, current_user)


@router.get("/status/{job_id}")
def get_tryon_status(job_id: str, current_user: dict = Depends(get_current_user)):
    return _service.get_status(job_id, current_user)


@router.get("/result/{job_id}")
def get_tryon_result(job_id: str, current_user: dict = Depends(get_current_user)):
    return _service.get_result(job_id, current_user)


@router.get("/history")
def tryon_history(current_user: dict = Depends(get_current_user)):
    return _service.get_history(current_user)


@router.post("/")
async def try_on(
    person_image: UploadFile = File(...),
    garment_path: str = Form(...),
    garment_type: str = Form(None),
):
    return await _service.try_on(
        person_image,
        garment_path,
        garment_type,
    )


@router.post("/combo")
async def try_on_combo(
    person_image: UploadFile = File(...),
    top_path: str = Form(...),
    bottom_path: str = Form(...),
):
    return await _service.try_on_combo(
        person_image,
        top_path,
        bottom_path,
    )
