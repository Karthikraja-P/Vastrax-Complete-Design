from fastapi import APIRouter, Depends

from app.core.gpu_queue import gpu_queue
from app.middleware.auth import require_admin
from app.models.user import User

router = APIRouter(prefix="/gpu", tags=["GPU"])


@router.get("/queue")
def queue_status(_: User = Depends(require_admin)):
    return gpu_queue.snapshot()
