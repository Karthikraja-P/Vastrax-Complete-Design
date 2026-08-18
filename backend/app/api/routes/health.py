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
def health():
    return {
        "status": "ok"
    }
