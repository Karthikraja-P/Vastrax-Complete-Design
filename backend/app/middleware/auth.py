from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_token
from app.db.database import get_db
from app.models.user import User
from app.models.business_team import BusinessTeamPermission

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Decode JWT and load the active user. Rejects the request if credentials are missing, invalid, or the user is not found/inactive."""
    if not credentials or not credentials.credentials:
        raise UnauthorizedError("Not authenticated")

    try:
        payload = decode_token(credentials.credentials)
        if payload.get("purpose") != "access":
            raise UnauthorizedError("Invalid token purpose")
    except UnauthorizedError:
        raise
    except Exception:
        raise UnauthorizedError("Invalid or expired token")

    user_id: str = payload.get("sub", "")
    if not user_id:
        raise UnauthorizedError("Invalid or expired token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise UnauthorizedError("User not found or inactive")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Raise 403 if the authenticated user is not an admin."""
    if str(current_user.role).lower() != "admin":
        raise ForbiddenError("Admin access required")
    return current_user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Return the authenticated user, or None for public endpoints."""
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("purpose") != "access":
            return None
        user_id = payload.get("sub", "")
        if not user_id:
            return None
        return db.query(User).filter(User.id == user_id).first()
    except Exception:
        return None


BUSINESS_MODULES = {"crm", "erp"}


def business_permissions_for_user(db: Session, user_id: str) -> list[str]:
    return [row.permission for row in db.query(BusinessTeamPermission.permission).filter(
        BusinessTeamPermission.user_id == user_id,
        BusinessTeamPermission.permission.in_(BUSINESS_MODULES),
    ).order_by(BusinessTeamPermission.permission).all()]


def require_business_permission(permission: str):
    if permission not in BUSINESS_MODULES:
        raise ValueError(f"Unsupported business permission: {permission}")

    def _require_permission(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if str(current_user.role).lower() == "admin":
            return current_user
        grant = db.query(BusinessTeamPermission.id).filter(
            BusinessTeamPermission.user_id == current_user.id,
            BusinessTeamPermission.permission == permission,
        ).first()
        if not grant:
            raise ForbiddenError(f"{permission.upper()} access required")
        return current_user

    return _require_permission
