import hashlib
import hmac
import json
import uuid
from decimal import Decimal

import requests
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import BadGatewayError, BadRequestError, ConflictError, ForbiddenError, NotFoundError
from app.core.logging import get_logger
from app.models.order import Order
from app.models.payment import Payment
from app.models.product_variant import ProductVariant
from app.models.user import User
from app.schemas.payments import PaymentCreate, PaymentResponse, PaymentVerify

logger = get_logger(__name__)

RAZORPAY_API_BASE = "https://api.razorpay.com/v1"


def _is_mock_mode() -> bool:
    return (
        settings.razorpay_key_id == "rzp_test_MOCK"
        or settings.razorpay_key_secret == "MOCK_SECRET"
    )


def _webhook_secret_is_default() -> bool:
    return settings.razorpay_webhook_secret in ("", "MOCK_WEBHOOK_SECRET")


def _live_razorpay_configured() -> bool:
    return (
        settings.razorpay_key_id.startswith("rzp_live_")
        and bool(settings.razorpay_key_secret)
        and not _is_mock_mode()
        and not _webhook_secret_is_default()
    )


def _razorpay_auth() -> tuple[str, str]:
    return (settings.razorpay_key_id, settings.razorpay_key_secret)


class PaymentService:
    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def readiness() -> dict:
        has_provider_credentials = (
            bool(settings.razorpay_key_id)
            and bool(settings.razorpay_key_secret)
            and not _is_mock_mode()
            and not _webhook_secret_is_default()
        )
        if settings.app_env == "production":
            razorpay_available = _live_razorpay_configured()
            simulation_available = False
        else:
            razorpay_available = has_provider_credentials
            simulation_available = _is_mock_mode()
        return {
            "razorpay_available": razorpay_available,
            "simulation_available": simulation_available,
            "checkout_available": razorpay_available or simulation_available,
        }

    def initiate_payment(self, payload: PaymentCreate, user: User) -> dict:
        order = self.db.query(Order).filter(Order.id == payload.order_id).first()
        if not order:
            raise NotFoundError("Order not found")
        if order.user_id != user.id:
            raise ForbiddenError("Access denied")
        if abs(Decimal(payload.amount) - Decimal(order.total_amount)) > Decimal("0.01"):
            raise BadRequestError("Payment amount does not match order total")
        if settings.app_env == "production" and not _live_razorpay_configured():
            raise BadRequestError("Online payments are not available right now")

        txn_id = f"TXN-VX-{uuid.uuid4().hex[:12].upper()}"
        payment = Payment(
            id=txn_id,
            order_id=payload.order_id,
            user_id=user.id,
            amount=payload.amount,
            method=payload.payment_method,
            status="pending",
        )
        self.db.add(payment)
        self.db.commit()

        if _is_mock_mode():
            return {
                "status": "success",
                "mode": "simulation",
                "txn_id": txn_id,
                "amount": int(payload.amount * 100),
                "currency": "INR",
            }

        return self._call_razorpay(payment, Decimal(order.total_amount))

    def _call_razorpay(self, payment: Payment, amount: Decimal) -> dict:
        amount_paise = int(amount * 100)
        try:
            resp = requests.post(
                f"{RAZORPAY_API_BASE}/orders",
                json={"amount": amount_paise, "currency": "INR", "receipt": payment.id},
                auth=_razorpay_auth(),
                timeout=10,
            )
            resp_data = resp.json()
            if resp.status_code in (200, 201) and resp_data.get("id"):
                payment.razorpay_order_id = resp_data["id"]
                self.db.commit()
                return {
                    "status": "success",
                    "mode": "razorpay",
                    "txn_id": payment.id,
                    "razorpay_order_id": resp_data["id"],
                    "razorpay_key_id": settings.razorpay_key_id,
                    "amount": resp_data.get("amount", amount_paise),
                    "currency": resp_data.get("currency", "INR"),
                }
            raise BadRequestError(resp_data.get("error", {}).get("description", "Razorpay order creation failed"))
        except BadRequestError:
            raise
        except Exception as exc:
            if settings.app_env == "production":
                logger.error("Razorpay order creation failed in production: %s", type(exc).__name__)
                raise BadRequestError("Online payments are not available right now") from exc
            logger.warning("Razorpay order creation failed, falling back to simulation: %s", exc)
            return {
                "status": "success",
                "mode": "simulation",
                "txn_id": payment.id,
                "amount": amount_paise,
                "currency": "INR",
                "warning": f"Real Razorpay call failed ({exc}), fell back to simulation",
            }

    def verify_payment(self, payload: PaymentVerify, user: User) -> dict:
        payment = self.db.query(Payment).filter(Payment.id == payload.txn_id).first()
        if not payment:
            raise NotFoundError("Transaction not found")
        if payment.user_id != user.id:
            raise ForbiddenError("Access denied")
        if settings.app_env == "production" and not _live_razorpay_configured():
            raise BadRequestError("Online payments are not available right now")
        if not payment.razorpay_order_id or payload.razorpay_order_id != payment.razorpay_order_id:
            raise ForbiddenError("Order mismatch")

        expected = hmac.new(
            settings.razorpay_key_secret.encode(),
            f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, payload.razorpay_signature):
            raise ForbiddenError("Signature mismatch")

        if payment.status == "refunded":
            raise ConflictError("Transaction has been refunded; payment cannot be verified")
        if payment.status == "failed":
            raise ConflictError("Transaction already failed; payment cannot be verified. Contact support for a refund")
        if (
            payment.status in ("success", "refunded")
            and payment.razorpay_payment_id
            and payment.razorpay_payment_id != payload.razorpay_payment_id
        ):
            raise ConflictError("Transaction already settled with a different payment")

        payment.razorpay_order_id = payload.razorpay_order_id
        payment.razorpay_payment_id = payload.razorpay_payment_id
        payment.razorpay_signature = payload.razorpay_signature
        self._mark_payment_success(payment)
        return {"status": "ok", "txn_id": payment.id}

    def simulate_payment(self, txn_id: str, user: User, success: bool) -> dict:
        if not _is_mock_mode() or settings.app_env == "production":
            raise ForbiddenError("Simulation is only available when Razorpay is unconfigured")

        payment = self.db.query(Payment).filter(Payment.id == txn_id).first()
        if not payment:
            raise NotFoundError("Transaction not found")
        if payment.user_id != user.id:
            raise ForbiddenError("Access denied")

        if success:
            self._mark_payment_success(payment)
        else:
            self._mark_payment_failed(payment)
        return {"status": "ok", "txn_id": payment.id}

    def _mark_payment_success(self, payment: Payment) -> None:
        if payment.status == "refunded":
            logger.error("Capture received for already-refunded payment %s; ignoring", payment.id)
            self.db.commit()
            return
        if payment.status == "success":
            self.db.commit()
            return
        if payment.status == "failed":
            # Order was cancelled and stock released; never reopen it. Needs manual refund.
            logger.error("Capture received for already-failed payment %s; not reopening order", payment.id)
            self.db.commit()
            return

        payment.status = "success"
        order = self.db.query(Order).filter(Order.id == payment.order_id).first()
        if order:
            order.status = "confirmed"
            order.payment_status = "paid"

            try:
                from app.services.order_service import _book_shiprocket, send_order_email_notification
                _book_shiprocket(order, order.user, order.address, payment_method="Prepaid")
                send_order_email_notification(order, order.user, order.address)
            except Exception as exc:
                logger.error("Failed post-payment hooks: %s", exc)

        self.db.commit()
        logger.info("Payment success: %s for order: %s", payment.id, payment.order_id)

    def _mark_payment_failed(self, payment: Payment) -> None:
        if payment.status in ("success", "failed", "refunded"):
            self.db.commit()
            return

        payment.status = "failed"
        self._restore_stock_and_cancel_order(payment.order_id)
        self.db.commit()
        logger.warning("Payment failed: %s for order: %s", payment.id, payment.order_id)

    def handle_webhook(self, raw_body: bytes, signature: str | None) -> dict:
        if settings.app_env == "production" and not _live_razorpay_configured():
            raise BadRequestError("Payment webhook is not configured")
        if _webhook_secret_is_default():
            raise BadRequestError("Webhook not configured")
        if not signature:
            raise BadRequestError("Missing X-Razorpay-Signature header")

        expected = hmac.new(settings.razorpay_webhook_secret.encode(), raw_body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise ForbiddenError("Signature mismatch")

        body = json.loads(raw_body.decode())
        event = body.get("event")
        entity = body.get("payload", {}).get("payment", {}).get("entity", {})
        razorpay_order_id = entity.get("order_id")
        if not razorpay_order_id:
            raise BadRequestError("Missing order_id in webhook payload")

        payment = self.db.query(Payment).filter(Payment.razorpay_order_id == razorpay_order_id).first()
        if not payment:
            raise NotFoundError("Transaction not found")

        if payment.status == "refunded":
            logger.error("Late %s webhook for refunded payment %s; ignoring", event, payment.id)
        elif event == "payment.captured":
            payment.razorpay_payment_id = entity.get("id") or payment.razorpay_payment_id
            self._mark_payment_success(payment)
        elif event == "payment.failed":
            self._mark_payment_failed(payment)

        return {"status": "ok"}

    def _restore_stock_and_cancel_order(self, order_id: str) -> None:
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order or order.status == "cancelled":
            return
        for item in order.items:
            variant = self.db.query(ProductVariant).filter(
                ProductVariant.id == item.variant_id
            ).first()
            if variant:
                variant.stock_qty += item.quantity
        order.status = "cancelled"
        order.payment_status = "failed"

    def get_payment_status(self, txn_id: str, user: User) -> PaymentResponse:
        payment = self.db.query(Payment).filter(Payment.id == txn_id).first()
        if not payment:
            raise NotFoundError("Transaction not found")
        if payment.user_id != user.id and user.role != "admin":
            raise ForbiddenError("Access denied")
        return PaymentResponse.model_validate(payment)

    def list_payments(self) -> list[PaymentResponse]:
        payments = (
            self.db.query(Payment).order_by(Payment.created_at.desc()).all()
        )
        return [PaymentResponse.model_validate(p) for p in payments]

    def process_refund(self, txn_id: str, amount: Decimal) -> dict:
        payment = self.db.query(Payment).filter(Payment.id == txn_id).first()
        if not payment:
            raise NotFoundError("Transaction not found")
        if payment.status != "success":
            raise ConflictError("Only a successfully captured payment can be refunded")
        if amount <= 0 or amount > Decimal(payment.amount):
            raise BadRequestError("Refund amount must be positive and not exceed the amount paid")
        if amount != Decimal(payment.amount):
            raise BadRequestError("Only full-amount refunds are supported")

        if settings.app_env == "production" and not _live_razorpay_configured():
            raise BadRequestError("Refunds are not available: live payment provider is not configured")
        if _is_mock_mode():
            # Development simulation only; never fake a refund in production.
            return self._mark_refunded(payment)
        if not payment.razorpay_payment_id:
            raise BadRequestError("No provider payment id on record; refund must be reconciled manually")

        return self._call_razorpay_refund(payment, amount)

    def _call_razorpay_refund(self, payment: Payment, amount: Decimal) -> dict:
        amount_paise = int(amount * 100)
        try:
            resp = requests.post(
                f"{RAZORPAY_API_BASE}/payments/{payment.razorpay_payment_id}/refund",
                json={"amount": amount_paise},
                auth=_razorpay_auth(),
                timeout=10,
            )
            resp_data = resp.json()
            if resp.status_code in (200, 201) and resp_data.get("id"):
                self._mark_refunded(payment)
                return {"status": "refunded", "txn_id": payment.id, "refund_id": resp_data["id"]}
            raise BadRequestError(resp_data.get("error", {}).get("description", "Razorpay refund rejected"))
        except BadRequestError:
            raise
        except Exception as exc:
            logger.error("Razorpay refund failed for %s: %s", payment.id, type(exc).__name__)
            raise BadGatewayError("Refund could not be confirmed with the payment provider; nothing was changed") from exc

    def _mark_refunded(self, payment: Payment) -> dict:
        payment.status = "refunded"
        order = self.db.query(Order).filter(Order.id == payment.order_id).first()
        if order:
            order.payment_status = "refunded"
        self.db.commit()
        return {"status": "refunded", "txn_id": payment.id}
