from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.exceptions import ConflictError, NotFoundError
from app.models.category import Category
from app.models.product import Product
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate


class CategoryService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_categories(self) -> list[CategoryResponse]:
        cats = self.db.query(Category).order_by(Category.name).all()
        counts = dict(self.db.query(Product.category_id, func.count(Product.id)).group_by(Product.category_id).all())
        return [CategoryResponse.model_validate(c).model_copy(update={"count": counts.get(c.id, 0)}) for c in cats]

    def get_category(self, category_id: str) -> CategoryResponse:
        cat = self.db.query(Category).filter(Category.id == category_id).first()
        if not cat:
            raise NotFoundError("Category not found")
        return CategoryResponse.model_validate(cat)

    def create_category(self, payload: CategoryCreate) -> CategoryResponse:
        if self.db.query(Category).filter(Category.slug == payload.slug).first():
            raise ConflictError(f"Category slug '{payload.slug}' already exists")
        cat = Category(**payload.model_dump())
        self.db.add(cat)
        self.db.commit()
        self.db.refresh(cat)
        return CategoryResponse.model_validate(cat)

    def update_category(self, category_id: str, payload: CategoryUpdate) -> CategoryResponse:
        cat = self.db.query(Category).filter(Category.id == category_id).first()
        if not cat:
            raise NotFoundError("Category not found")
        if payload.slug and payload.slug != cat.slug:
            if self.db.query(Category).filter(Category.slug == payload.slug).first():
                raise ConflictError(f"Category slug '{payload.slug}' already exists")
            cat.slug = payload.slug
        for k in ("name", "description", "is_active", "image_url"):
            if k in payload.model_fields_set:
                setattr(cat, k, getattr(payload, k))
        self.db.commit()
        self.db.refresh(cat)
        return CategoryResponse.model_validate(cat)

    def delete_category(self, category_id: str) -> None:
        cat = self.db.query(Category).filter(
            (Category.id == category_id) | (Category.slug == category_id)
        ).first()
        if not cat:
            return
        self.db.delete(cat)
        self.db.commit()
