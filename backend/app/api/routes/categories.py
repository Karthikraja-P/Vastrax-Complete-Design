from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.middleware.auth import require_admin
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryUpdate
from app.services.category_service import CategoryService

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("")
def list_categories(db: Session = Depends(get_db)):
    return CategoryService(db).list_categories()


@router.get("/{category_id}")
def get_category(category_id: str, db: Session = Depends(get_db)):
    return CategoryService(db).get_category(category_id)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_category(
    body: CategoryCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return CategoryService(db).create_category(body)


@router.put("/{category_id}")
def update_category(
    category_id: str,
    body: CategoryUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return CategoryService(db).update_category(category_id, body)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    CategoryService(db).delete_category(category_id)
