from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, UnauthorizedError
from app.core.logging import get_logger
from app.core.security import hash_password, verify_password
from app.models.address import Address
from app.models.chat_message import ChatMessage
from app.models.product import Product
from app.models.tryon_session import TryonSession
from app.models.user import User
from app.models.wishlist import Wishlist
from app.schemas.user import (
    AddressCreate,
    AddressResponse,
    AddressUpdate,
    ChangePasswordRequest,
    UserResponse,
    UserUpdate,
)

logger = get_logger(__name__)


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ── Profile ────────────────────────────────────────────────────────────────

    def get_profile(self, user: User) -> UserResponse:
        return UserResponse.model_validate(user)

    def update_profile(self, user: User, payload: UserUpdate) -> UserResponse:
        if payload.full_name is not None:
            user.full_name = payload.full_name
        if payload.phone_number is not None:
            existing = (
                self.db.query(User)
                .filter(User.phone_number == payload.phone_number, User.id != user.id)
                .first()
            )
            if existing:
                raise ConflictError("Phone number already in use")
            user.phone_number = payload.phone_number
        self.db.commit()
        self.db.refresh(user)
        return UserResponse.model_validate(user)

    def change_password(self, user: User, payload: ChangePasswordRequest) -> dict:
        if not verify_password(payload.old_password, user.hashed_password):
            raise UnauthorizedError("Current password is incorrect")
        user.hashed_password = hash_password(payload.new_password)
        self.db.commit()
        return {"message": "Password changed successfully"}

    def delete_account(self, user: User) -> None:
        self.db.delete(user)
        self.db.commit()

    # ── Addresses ──────────────────────────────────────────────────────────────

    def list_addresses(self, user: User) -> list[AddressResponse]:
        return [AddressResponse.model_validate(a) for a in user.addresses]

    def add_address(self, user: User, payload: AddressCreate) -> AddressResponse:
        if payload.is_default:
            for addr in user.addresses:
                addr.is_default = False

        new_addr = Address(
            user_id=user.id,
            label=payload.label,
            address_line1=payload.address_line1,
            city=payload.city,
            state=payload.state,
            pincode=payload.pincode,
            is_default=payload.is_default,
        )
        self.db.add(new_addr)
        self.db.commit()
        self.db.refresh(new_addr)
        return AddressResponse.model_validate(new_addr)

    def update_address(self, user: User, address_id: str, payload: AddressUpdate) -> AddressResponse:
        addr = self.db.query(Address).filter(
            Address.id == address_id, Address.user_id == user.id
        ).first()
        if not addr:
            raise NotFoundError("Address not found")

        if payload.is_default:
            for a in user.addresses:
                a.is_default = False

        if payload.label is not None:
            addr.label = payload.label
        if payload.address_line1 is not None:
            addr.address_line1 = payload.address_line1
        if payload.city is not None:
            addr.city = payload.city
        if payload.state is not None:
            addr.state = payload.state
        if payload.pincode is not None:
            addr.pincode = payload.pincode
        if payload.is_default is not None:
            addr.is_default = payload.is_default

        self.db.commit()
        self.db.refresh(addr)
        return AddressResponse.model_validate(addr)

    def delete_address(self, user: User, address_id: str) -> None:
        addr = self.db.query(Address).filter(
            Address.id == address_id, Address.user_id == user.id
        ).first()
        if not addr:
            raise NotFoundError("Address not found")
        self.db.delete(addr)
        self.db.commit()

    # ── Wishlist ───────────────────────────────────────────────────────────────

    def get_wishlist(self, user: User) -> list:
        from app.schemas.products import ProductResponse
        wishlist_entries = (
            self.db.query(Wishlist).filter(Wishlist.user_id == user.id).all()
        )
        result = []
        for entry in wishlist_entries:
            product = self.db.query(Product).filter(Product.id == entry.product_id).first()
            if product:
                result.append(ProductResponse.model_validate(product))
        return result

    def toggle_wishlist(self, user: User, product_id: str) -> dict:
        product = self.db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise NotFoundError("Product not found")

        entry = self.db.query(Wishlist).filter(
            Wishlist.user_id == user.id, Wishlist.product_id == product_id
        ).first()

        if entry:
            self.db.delete(entry)
            action = "removed"
        else:
            self.db.add(Wishlist(user_id=user.id, product_id=product_id))
            action = "added"

        self.db.commit()
        return {"product_id": product_id, "action": action}

    # ── Admin ──────────────────────────────────────────────────────────────────

    def _usage_counts(self, user_ids: list[str]) -> tuple[dict[str, int], dict[str, int]]:
        """Batch-fetch try-on and AI-stylist usage counts for a set of users in two queries."""
        if not user_ids:
            return {}, {}
        tryon_counts = dict(
            self.db.query(TryonSession.user_id, func.count(TryonSession.id))
            .filter(TryonSession.user_id.in_(user_ids))
            .group_by(TryonSession.user_id)
            .all()
        )
        chat_counts = dict(
            self.db.query(ChatMessage.user_id, func.count(ChatMessage.id))
            .filter(ChatMessage.user_id.in_(user_ids))
            .group_by(ChatMessage.user_id)
            .all()
        )
        return tryon_counts, chat_counts

    def list_customers(self) -> list[UserResponse]:
        users = self.db.query(User).all()
        tryon_counts, chat_counts = self._usage_counts([u.id for u in users])
        return [
            UserResponse.model_validate(u).model_copy(
                update={
                    "tryon_count": tryon_counts.get(u.id, 0),
                    "chat_message_count": chat_counts.get(u.id, 0),
                }
            )
            for u in users
        ]

    def list_admins(self) -> list[UserResponse]:
        users = self.db.query(User).filter(User.role == "admin").all()
        return [UserResponse.model_validate(u) for u in users]

    def get_customer_detail(self, user_id: str) -> UserResponse:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise NotFoundError("User not found")
        tryon_counts, chat_counts = self._usage_counts([user_id])
        return UserResponse.model_validate(user).model_copy(
            update={
                "tryon_count": tryon_counts.get(user_id, 0),
                "chat_message_count": chat_counts.get(user_id, 0),
            }
        )
