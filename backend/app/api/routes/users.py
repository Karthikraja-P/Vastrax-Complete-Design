from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.middleware.auth import get_current_user, require_admin
from app.models.user import User
from app.schemas.user import AddressCreate, AddressUpdate, ChangePasswordRequest, UserUpdate
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


# ── Profile ────────────────────────────────────────────────────────────────────

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return UserService(db).get_profile(current_user)


@router.put("/me")
def update_me(
    body: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return UserService(db).update_profile(current_user, body)


@router.post("/me/change-password")
def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return UserService(db).change_password(current_user, body)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    UserService(db).delete_account(current_user)


# ── Addresses ─────────────────────────────────────────────────────────────────

@router.get("/me/addresses")
def list_addresses(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return UserService(db).list_addresses(current_user)


@router.post("/me/addresses", status_code=status.HTTP_201_CREATED)
def add_address(
    body: AddressCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return UserService(db).add_address(current_user, body)


@router.put("/me/addresses/{address_id}")
def update_address(
    address_id: str,
    body: AddressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return UserService(db).update_address(current_user, address_id, body)


@router.delete("/me/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(
    address_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    UserService(db).delete_address(current_user, address_id)


# ── Wishlist ───────────────────────────────────────────────────────────────────

@router.get("/me/wishlist")
def get_wishlist(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return UserService(db).get_wishlist(current_user)


@router.post("/me/wishlist/{product_id}")
def toggle_wishlist(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return UserService(db).toggle_wishlist(current_user, product_id)


# ── Admin ──────────────────────────────────────────────────────────────────────

@router.get("/admin")
def admin_customers(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return UserService(db).list_customers()

@router.get("/admin/admins")
def admin_admins(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return UserService(db).list_admins()


@router.get("/admin/{user_id}")
def admin_customer_detail(
    user_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return UserService(db).get_customer_detail(user_id)
