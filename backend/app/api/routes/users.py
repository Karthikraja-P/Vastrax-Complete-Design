from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from typing import Literal
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.middleware.auth import get_current_user, require_admin
from app.models.user import User
from app.models.business_team import BusinessTeamPermission
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


# ── Orders ─────────────────────────────────────────────────────────────────────

@router.get("/me/orders")
def get_user_orders(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.services.order_service import OrderService
    return OrderService(db).list_user_orders(current_user)


# ── Wishlist ───────────────────────────────────────────────────────────────────

@router.get("/me/wishlist")
def get_wishlist(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return UserService(db).get_wishlist(current_user)


@router.post("/me/wishlist")
def add_to_wishlist_body(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product_id = str(body.get("product_id") or body.get("id") or "").strip()
    return UserService(db).add_to_wishlist(current_user, product_id)


@router.post("/me/wishlist/{product_id}")
def toggle_wishlist(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return UserService(db).toggle_wishlist(current_user, product_id)


@router.delete("/me/wishlist/{product_id}")
def remove_from_wishlist(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return UserService(db).remove_from_wishlist(current_user, product_id)


# ── Admin ──────────────────────────────────────────────────────────────────────

@router.get("/admin")
def admin_customers(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return UserService(db).list_customers()

@router.get("/admin/admins")
def admin_admins(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return UserService(db).list_admins()


class BusinessTeamAccessUpdate(BaseModel):
    email: EmailStr
    permissions: list[Literal["crm", "erp"]] = Field(min_length=1, max_length=2)


@router.get("/admin/business-team")
def list_business_team(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(BusinessTeamPermission, User).join(
        User, User.id == BusinessTeamPermission.user_id
    ).filter(User.is_active.is_(True), User.role != "admin").order_by(
        User.email, BusinessTeamPermission.permission
    ).all()
    members: dict[str, dict] = {}
    for grant, user in rows:
        members.setdefault(user.id, {
            "user_id": user.id, "full_name": user.full_name, "email": user.email,
            "permissions": [],
        })["permissions"].append(grant.permission)
    return list(members.values())


@router.put("/admin/business-team")
def update_business_team_access(
    body: BusinessTeamAccessUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == str(body.email).lower(), User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(404, "Ask the team member to create and verify a Vastrax account first")
    if user.role == "admin":
        raise HTTPException(409, "Admins already have full business access")
    desired = set(body.permissions)
    existing = {
        grant.permission: grant
        for grant in db.query(BusinessTeamPermission).filter(BusinessTeamPermission.user_id == user.id).all()
    }
    for permission, grant in existing.items():
        if permission not in desired:
            db.delete(grant)
    for permission in desired - set(existing):
        db.add(BusinessTeamPermission(user_id=user.id, permission=permission, granted_by=admin.id))
    db.commit()
    return {"user_id": user.id, "email": user.email, "permissions": sorted(desired)}


@router.delete("/admin/business-team/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_business_team_access(
    user_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    db.query(BusinessTeamPermission).filter(BusinessTeamPermission.user_id == user_id).delete(synchronize_session=False)
    db.commit()


@router.get("/admin/{user_id}")
def admin_customer_detail(
    user_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return UserService(db).get_customer_detail(user_id)
