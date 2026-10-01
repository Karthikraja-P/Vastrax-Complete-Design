from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.middleware.auth import require_admin
from app.models.user import User
from app.models.product import Product
from app.core.exceptions import NotFoundError
import logging
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/3d", tags=["3D Generation"])


@router.post("/generate", status_code=status.HTTP_200_OK)
async def generate_3d_mesh(
    product_id: str = Form(None),
    category_id: str = Form(None),
    product_name: str = Form(None),
    front_image: UploadFile = File(...),
    side_image: UploadFile = File(None),
    back_image: UploadFile = File(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Triggers 3D neural reconstruction & texture painting pipeline via 3D generator on port 8081.
    Protected by global GPU execution queue.
    """
    import os
    import httpx
    from app.core.gpu_queue import gpu_queue

    job_id = f"job_3d_{uuid.uuid4().hex[:8]}"
    generator_url = os.getenv("GENERATOR_3D_URL", "http://172.17.0.1:8081")
    model_url = f"/models/3d/{job_id}.glb"
    generation_mode = "unknown"

    async with gpu_queue.acquire(f"3d_reconstruct_{job_id}"):
        try:
            # Read files
            front_bytes = await front_image.read()
            files = {
                "front_image": (front_image.filename or "front.jpg", front_bytes, front_image.content_type or "image/jpeg")
            }
            if side_image:
                side_bytes = await side_image.read()
                files["side_image"] = (side_image.filename or "side.jpg", side_bytes, side_image.content_type or "image/jpeg")
            if back_image:
                back_bytes = await back_image.read()
                files["back_image"] = (back_image.filename or "back.jpg", back_bytes, back_image.content_type or "image/jpeg")

            data = {}
            if product_id:
                data["product_id"] = product_id
                product = db.query(Product).filter(Product.id == product_id).first()
                if product:
                    data["category_id"] = category_id or product.category_id or ""
                    data["product_name"] = product_name or product.name or ""
            else:
                if category_id:
                    data["category_id"] = category_id
                if product_name:
                    data["product_name"] = product_name

            # Call 3D generator service
            async with httpx.AsyncClient(timeout=1260.0) as client:
                resp = await client.post(
                    f"{generator_url}/generate",
                    files=files,
                    data=data,
                    headers={"X-Generator-Key": os.environ["GENERATOR_3D_SECRET"]},
                )
                if resp.status_code == 200:
                    res_json = resp.json()
                    model_url = res_json.get("model_url", model_url)
                    generation_mode = res_json.get("generation_mode", "unknown")
                else:
                    logger.warning(f"3D generator returned {resp.status_code}: {resp.text}")
                    raise HTTPException(status_code=502, detail="3D generator failed")
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("3D generator service failed: %s", e)
            raise HTTPException(status_code=503, detail="3D generator unavailable")

        if product_id:
            product = db.query(Product).filter(Product.id == product_id).first()
            if product:
                product.model_path = model_url
                db.commit()

    return {
        "status": "success" if generation_mode == "hunyuan_textured" else ("partial" if generation_mode == "hunyuan_untextured" else "template"),
        "job_id": job_id,
        "model_url": model_url,
        "generation_mode": generation_mode,
        "message": (
            "Textured neural 3D model generated" if generation_mode == "hunyuan_textured"
            else "Neural 3D shape generated without texture" if generation_mode == "hunyuan_untextured"
            else "Template mesh created; Hunyuan reconstruction unavailable"
        )
    }



@router.post("/products/{product_id}/generate-3d", status_code=status.HTTP_200_OK)
def generate_product_3d(
    product_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise NotFoundError("Product not found")

    model_url = "/models/3d/garment_perfect.glb"
    product.model_path = model_url
    db.commit()

    return {
        "status": "template_assigned",
        "product_id": product.id,
        "model_url": model_url,
        "message": f"Template 3D model assigned to {product.name}"
    }
