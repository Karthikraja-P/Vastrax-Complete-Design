import asyncio
import os
import shutil
import tempfile
import uuid
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.middleware.auth import get_current_user, get_optional_user, require_admin
from app.models.user import User
from app.services.tryon_service import TryonService

router = APIRouter(prefix="/try-on", tags=["tryon"])


ADMIN_TRYON_MODELS = {
    "aanya": {
        "name": "Aanya",
        "description": "Long waves · medium-brown complexion · average build",
        "filename": "aanya-wavy.webp",
    },
    "meera": {
        "name": "Meera",
        "description": "Shoulder-length curls · deep complexion · tall, lean build",
        "filename": "meera-curls.webp",
    },
    "kavya": {
        "name": "Kavya",
        "description": "Long braid · golden-brown complexion · curvy build",
        "filename": "kavya-braid.webp",
    },
    "skirt-storefront-reference": {
        "name": "Green-top model",
        "description": "Green-top person photo; can be selected as the try-on model",
        "filename": "skirt-and-top-model.webp",
        "product_photo": True,
    },
}


def _admin_model_path(model_id: str) -> Path:
    model = ADMIN_TRYON_MODELS.get(model_id)
    if not model:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Choose a model from the available model list")
    if model.get("product_photo"):
        from app.core.config import settings
        return Path(settings.upload_dir) / "products" / model["filename"]
    return Path(__file__).resolve().parents[2] / "assets" / "admin_tryon_models" / model["filename"]


@router.get("/admin-models")
def list_admin_tryon_models():
    return [
        {
            "id": model_id,
            "name": model["name"],
            "description": model["description"],
            "image_url": f"/api/v1/try-on/admin-models/{model_id}/image",
        }
        for model_id, model in ADMIN_TRYON_MODELS.items()
        if _admin_model_path(model_id).is_file()
    ]


@router.get("/admin-models/{model_id}/image")
def get_admin_tryon_model_image(model_id: str):
    path = _admin_model_path(model_id)
    if not path.is_file():
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Model image is unavailable")
    return FileResponse(
        path,
        media_type="image/webp",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.post("/admin-preview")
async def generate_admin_tryon_preview(
    model_id: str | None = Form(None),
    garment_type: str = Form("tops"),
    person_image: UploadFile | None = File(None),
    garment_image: UploadFile | None = File(None),
    bottom_image: UploadFile | None = File(None),
    set_image: UploadFile | None = File(None),
    full_look_reference: bool = Form(False),
    _: User = Depends(require_admin),
):
    """Preview a product on an uploaded person photo or a curated model."""
    from app.core.config import settings
    from app.core.exceptions import BadRequestError, InternalError

    if not person_image and not model_id:
        raise BadRequestError("Upload a person photo for virtual try-on")
    model_path = _admin_model_path(model_id) if model_id and not person_image else None
    if model_path and not model_path.is_file():
        from app.core.exceptions import ServiceUnavailableError
        raise ServiceUnavailableError("The selected model image is unavailable")
    if garment_type not in {"tops", "bottoms", "one-pieces"}:
        raise BadRequestError("Choose a supported garment type")
    if set_image and (garment_image or bottom_image):
        raise BadRequestError("Choose either one complete set photo or separate garment photos")
    if full_look_reference and not set_image:
        raise BadRequestError("Choose a full-look reference photo")
    if not set_image and not garment_image:
        raise BadRequestError("Choose a product photo or a complete set photo")
    if bottom_image and garment_type != "tops":
        raise BadRequestError("For a top + bottom preview, set the primary garment type to top")

    accepted_types = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}

    async def read_image(upload: UploadFile, label: str) -> tuple[bytes, str]:
        extension = accepted_types.get(upload.content_type or "")
        if not extension:
            raise BadRequestError(f"Upload the {label} as a JPG, PNG, or WEBP image")
        content = await upload.read(10 * 1024 * 1024 + 1)
        if not content or len(content) > 10 * 1024 * 1024:
            raise BadRequestError(f"The {label} image must be under 10 MB")
        try:
            from PIL import Image
            with Image.open(BytesIO(content)) as image:
                image.verify()
        except Exception as exc:
            raise BadRequestError(f"The selected {label} image is not a valid image") from exc
        return content, extension

    set_mode = set_image is not None
    primary_image = set_image or garment_image
    assert primary_image is not None
    top_content, top_extension = await read_image(primary_image, "complete set" if set_mode else ("top" if bottom_image else "product"))
    bottom_content: bytes | None = None
    bottom_extension: str | None = None
    if bottom_image and not set_mode:
        bottom_content, bottom_extension = await read_image(bottom_image, "bottom")
    elif set_mode and not full_look_reference:
        # Legacy complete-set mode applies the image in separate top and bottom passes.
        bottom_content, bottom_extension = top_content, top_extension
    person_content, person_extension = await read_image(person_image, "person") if person_image else (None, None)

    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(settings.results_dir, exist_ok=True)
    preview_results_dir = tempfile.mkdtemp(prefix="admin-tryon-", dir=settings.results_dir)
    temp_paths: list[str] = []
    result_transferring = False
    try:
        def save_temp(content: bytes, extension: str, prefix: str) -> str:
            handle = tempfile.NamedTemporaryFile(prefix=prefix, suffix=extension, dir=settings.upload_dir, delete=False)
            with handle:
                handle.write(content)
            temp_paths.append(handle.name)
            return handle.name

        top_path = save_temp(top_content, top_extension, "admin-tryon-set-" if set_mode else "admin-tryon-top-")
        person_path = save_temp(person_content, person_extension, "admin-tryon-person-") if person_content and person_extension else str(model_path)
        bottom_path = top_path if set_mode and not full_look_reference else (save_temp(bottom_content, bottom_extension, "admin-tryon-bottom-") if bottom_content and bottom_extension else None)
        from app.core.gpu_queue import gpu_queue
        from app.services.fashn_service import run_fashn

        async with gpu_queue.acquire("tryon_admin_preview"):
            if full_look_reference:
                from app.services.tryon_service import _normalize_two_piece_person_image

                _normalize_two_piece_person_image(person_path)
                result_path = await asyncio.to_thread(
                    run_fashn,
                    person_image_path=person_path,
                    garment_image_path=top_path,
                    garment_type="one-pieces",
                    results_dir=preview_results_dir,
                    garment_photo_type="model",
                    segmentation_free=True,
                )
            elif bottom_path:
                # The catalog editor uses the same two-pass flow as storefront try-on:
                # fit the bottom first (so long skirts can replace source trousers),
                # then fit the top. Square uploaded model photos need portrait framing
                # or FASHN may silently leave the original lower garment unchanged.
                from app.services.tryon_service import _normalize_two_piece_person_image

                _normalize_two_piece_person_image(person_path)
                result_path = await asyncio.to_thread(
                    run_fashn,
                    person_image_path=person_path,
                    garment_image_path=bottom_path,
                    garment_type="bottoms",
                    results_dir=preview_results_dir,
                    garment_photo_type="flat-lay",
                    segmentation_free=True,
                )
                if not result_path or not os.path.isfile(result_path):
                    raise InternalError("Virtual try-on did not produce the bottom preview")
                result_path = await asyncio.to_thread(
                    run_fashn,
                    person_image_path=result_path,
                    garment_image_path=top_path,
                    garment_type="tops",
                    results_dir=preview_results_dir,
                    garment_photo_type="flat-lay",
                )
            else:
                result_path = await asyncio.to_thread(
                    run_fashn,
                    person_image_path=person_path,
                    garment_image_path=top_path,
                    garment_type=garment_type,
                    results_dir=preview_results_dir,
                )
        if not result_path or not os.path.isfile(result_path):
            raise InternalError("Virtual try-on did not produce a preview image")
        result_transferring = True
        return FileResponse(
            result_path,
            media_type="image/png",
            filename="virtual-try-on.png",
            background=BackgroundTask(shutil.rmtree, preview_results_dir, ignore_errors=True),
        )
    except (BadRequestError, InternalError):
        raise
    except Exception as exc:
        raise InternalError("Virtual try-on could not create a preview. Please try again.") from exc
    finally:
        for path in temp_paths:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass
        if not result_transferring:
            shutil.rmtree(preview_results_dir, ignore_errors=True)


from app.schemas.tryon import TryonSubmitRequest


@router.post("/submit")
async def submit_tryon(
    payload: TryonSubmitRequest,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Unified try-on submission endpoint for JSON clients and frontend modals."""
    import base64
    from app.models.product import Product
    from app.services.fashn_service import detect_category, run_fashn
    from app.utils.file_utils import resolve_garment, try_remove
    from app.core.config import settings

    garment_url = payload.garment_path
    category = payload.category or payload.garment_type
    if payload.product_id:
        product = db.query(Product).filter(Product.id == str(payload.product_id)).first()
        if product:
            if not garment_url and product.images:
                garment_url = product.images[0].s3_url
            p_cat = str(product.category_id or "").lower()
            p_name = str(product.name or "").lower()
            if any(w in p_cat or w in p_name for w in ["dress", "frock", "gown", "lehenga", "one-piece", "cat-dresses"]):
                category = "one-pieces"
            elif any(w in p_cat or w in p_name for w in ["pant", "trouser", "skirt", "bottom", "jean", "denim", "palazzo", "cat-bottoms"]):
                category = "bottoms"
            elif any(w in p_cat or w in p_name for w in ["top", "tee", "shirt", "t-shirt", "jacket", "hoodie", "cat-tops"]):
                category = "tops"

    garment_url = garment_url or "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=800&auto=format&fit=crop"
    category = category or detect_category(garment_url)

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

    session_id = f"ses_{uuid.uuid4().hex[:8]}"
    try:
        from app.core.gpu_queue import gpu_queue
        import asyncio

        async with gpu_queue.acquire(f"tryon_submit_{session_id}"):
            result_path = await asyncio.to_thread(
                run_fashn,
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
        "session_id": session_id,
        "status": "COMPLETED",
        "result_image_url": f"/results/{result_filename}",
        "category_used": category,
        "model": "FASHN VTON 1.5",
    }



@router.post("")
@router.post("/")
async def try_on(
    person_image: UploadFile = File(...),
    garment_path: str | None = Form(None),
    garment_type: str | None = Form(None),
    product_id: str | None = Form(None),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    g_path = garment_path
    g_type = garment_type
    if product_id:
        from app.models.product import Product
        product = db.query(Product).filter(Product.id == str(product_id)).first()
        if product:
            if not g_path and product.images:
                g_path = product.images[0].s3_url
            p_cat = str(product.category_id or "").lower()
            p_name = str(product.name or "").lower()
            if any(w in p_cat or w in p_name for w in ["dress", "frock", "gown", "lehenga", "one-piece", "cat-dresses"]):
                g_type = "one-pieces"
            elif any(w in p_cat or w in p_name for w in ["pant", "trouser", "skirt", "bottom", "jean", "denim", "palazzo", "cat-bottoms"]):
                g_type = "bottoms"
            elif any(w in p_cat or w in p_name for w in ["top", "tee", "shirt", "t-shirt", "jacket", "hoodie", "cat-tops"]):
                g_type = "tops"
    
    if not g_path:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Either garment_path or a valid product_id must be provided")

    return await TryonService(db).try_on(
        person_image, g_path, g_type, user=current_user, product_id=product_id
    )


@router.post("/combo")
async def try_on_combo(
    person_image: UploadFile = File(...),
    top_path: str = Form(...),
    bottom_path: str = Form(...),
    product_id: str = Form(None),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    return await TryonService(db).try_on_combo(
        person_image, top_path, bottom_path, user=current_user, product_id=product_id
    )
