from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate


class CategoryService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_categories(self) -> list[CategoryResponse]:
        cats = self.db.query(Category).order_by(Category.name).all()
        return [CategoryResponse.model_validate(c) for c in cats]

    def get_category(self, category_id: str) -> CategoryResponse:
        cat = self.db.query(Category).filter(Category.id == category_id).first()
        if not cat:
            raise NotFoundError("Category not found")
        return CategoryResponse.model_validate(cat)

    def create_category(self, payload: CategoryCreate) -> CategoryResponse:
        if self.db.query(Category).filter(Category.slug == payload.slug).first():
            raise ConflictError(f"Category slug '{payload.slug}' already exists")
        cat = Category(name=payload.name, slug=payload.slug)
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
        if payload.name is not None:
            cat.name = payload.name
        self.db.commit()
        self.db.refresh(cat)
        return CategoryResponse.model_validate(cat)

    def delete_category(self, category_id: str) -> None:
        cat = self.db.query(Category).filter(Category.id == category_id).first()
        if not cat:
            raise NotFoundError("Category not found")
        self.db.delete(cat)
        self.db.commit()
