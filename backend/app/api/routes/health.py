from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/")
def root():
    return {
        "service": "VastraX API",
        "model": "FASHN VTON 1.5",
        "status": "running",
    }


@router.get("/health")
@router.get("/api/v1/health")
def health():
    return {
        "status": "ok"
    }
