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
from app.models.payment_refund import PaymentRefund
from app.models.returns import SalesReturn
from app.models.product_variant import ProductVariant
from app.models.user import User
from app.schemas.payments import PaymentCreate, PaymentResponse, PaymentVerify
from app.services.erp_posting_service import post_payment_receipt, post_refund

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
            try:
                resp_data = resp.json()
            except ValueError:
                resp_data = {}
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
            logger.error("Razorpay order API returned HTTP %s without a valid order id", resp.status_code)
            self._mark_payment_failed(payment)
            raise BadGatewayError("Razorpay could not create the payment order. Please try again.")
        except BadGatewayError:
            raise
        except Exception as exc:
            self._mark_payment_failed(payment)
            logger.error("Razorpay order creation failed: %s", type(exc).__name__)
            raise BadGatewayError("Razorpay could not create the payment order. Please try again.") from exc

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
        if payment.status in ("success", "partially_refunded", "refunded"):
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
                _book_shiprocket(order, order.user, order.address)
                send_order_email_notification(order, order.user, order.address)
            except Exception as exc:
                logger.error("Failed post-payment hooks: %s", exc)

        post_payment_receipt(self.db, payment)
        self.db.commit()
        logger.info("Payment success: %s for order: %s", payment.id, payment.order_id)

    def _mark_payment_failed(self, payment: Payment) -> None:
        if payment.status in ("success", "partially_refunded", "refunded", "failed"):
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
        payload = body.get("payload", {})
        if event in ("refund.processed", "refund.failed"):
            entity = payload.get("refund", {}).get("entity", {})
            gateway_refund_id = entity.get("id")
            if not gateway_refund_id:
                raise BadRequestError("Missing refund id in webhook payload")
            refund = self.db.query(PaymentRefund).filter(PaymentRefund.gateway_refund_id == gateway_refund_id).first()
            if not refund:
                gateway_payment_id = entity.get("payment_id")
                payment = self.db.query(Payment).filter(Payment.razorpay_payment_id == gateway_payment_id).first()
                if not payment:
                    raise NotFoundError("Transaction not found")
                refund = PaymentRefund(
                    payment_id=payment.id,
                    gateway_refund_id=gateway_refund_id,
                    amount=(Decimal(entity.get("amount", 0)) / Decimal("100")).quantize(Decimal("0.01")),
                    status="pending",
                    source="gateway_webhook",
                )
                self.db.add(refund)
                self.db.flush()
            payment = self.db.query(Payment).filter(Payment.id == refund.payment_id).with_for_update().first()
            if not payment:
                raise NotFoundError("Transaction not found")
            if refund.status not in ("processed", "failed"):
                refund.status = "processed" if event == "refund.processed" else "failed"
                self._sync_refund_totals(payment)
                post_refund(self.db, refund)
                self.db.commit()
            return {"status": "ok"}

        entity = payload.get("payment", {}).get("entity", {})
        razorpay_order_id = entity.get("order_id")
        if not razorpay_order_id:
            raise BadRequestError("Missing order_id in webhook payload")
        payment = self.db.query(Payment).filter(Payment.razorpay_order_id == razorpay_order_id).first()
        if not payment:
            raise NotFoundError("Transaction not found")
        if event == "payment.captured":
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

    def _sync_refund_totals(self, payment: Payment) -> tuple[Decimal, Decimal]:
        refunds = self.db.query(PaymentRefund).filter(PaymentRefund.payment_id == payment.id).all()
        processed = sum((Decimal(row.amount) for row in refunds if row.status == "processed"), Decimal("0.00"))
        reserved = sum((Decimal(row.amount) for row in refunds if row.status in ("pending", "unknown")), Decimal("0.00"))
        if processed >= Decimal(payment.amount):
            payment.status = "refunded"
            order_status = "refunded"
        elif processed > 0:
            payment.status = "partially_refunded"
            order_status = "partially_refunded"
        elif payment.status not in ("failed", "pending"):
            payment.status = "success"
            order_status = "paid"
        else:
            order_status = None
        order = self.db.query(Order).filter(Order.id == payment.order_id).first()
        if order and order_status:
            order.payment_status = order_status
        return processed, reserved

    def process_refund(
        self,
        txn_id: str,
        amount: Decimal,
        *,
        created_by_id: str | None = None,
        return_id: str | None = None,
    ) -> dict:
        payment = self.db.query(Payment).filter(Payment.id == txn_id).with_for_update().first()
        if not payment:
            raise NotFoundError("Transaction not found")
        if settings.app_env == "production" and not _live_razorpay_configured():
            raise BadRequestError("Refunds are not available: live payment provider is not configured")
        if Decimal(amount) <= 0:
            raise BadRequestError("Refund amount must be greater than zero")
        if payment.status not in ("success", "partially_refunded"):
            raise BadRequestError("Only captured payments can be refunded")
        if return_id:
            return_case = self.db.query(SalesReturn).filter(SalesReturn.id == return_id).first()
            if not return_case or return_case.order_id != payment.order_id:
                raise BadRequestError("Return case does not belong to this payment")
            if return_case.status != "received":
                raise BadRequestError("Returned items must be received before issuing a return refund")

        processed, reserved = self._sync_refund_totals(payment)
        remaining = Decimal(payment.amount) - processed - reserved
        if Decimal(amount) > remaining:
            raise BadRequestError(f"Refund exceeds the remaining refundable amount ({remaining:.2f})")

        refund = PaymentRefund(
            payment_id=payment.id,
            return_id=return_id,
            amount=Decimal(amount).quantize(Decimal("0.01")),
            status="processed" if _is_mock_mode() else "pending",
            source="simulation" if _is_mock_mode() else "admin",
            created_by=created_by_id,
        )
        self.db.add(refund)
        self.db.flush()
        if _is_mock_mode():
            processed, _ = self._sync_refund_totals(payment)
            post_refund(self.db, refund)
            self.db.commit()
            return {"status": "refunded" if processed >= Decimal(payment.amount) else "partially_refunded",
                    "txn_id": payment.id, "refund_id": refund.id, "amount": str(refund.amount),
                    "refunded_amount": str(processed)}

        if not payment.razorpay_payment_id:
            self.db.rollback()
            raise BadRequestError("Gateway payment id is missing; refund cannot be submitted safely")

        # Reserve the amount before the network request. If the outcome is ambiguous,
        # the reservation remains visible and prevents an accidental duplicate refund.
        self.db.commit()
        amount_paise = int(refund.amount * 100)
        try:
            resp = requests.post(
                f"{RAZORPAY_API_BASE}/payments/{payment.razorpay_payment_id}/refund",
                json={"amount": amount_paise, "notes": {"vastrax_refund_id": refund.id}},
                auth=_razorpay_auth(),
                timeout=10,
            )
            try:
                data = resp.json()
            except ValueError:
                data = {}
            if resp.status_code not in (200, 201) or not data.get("id"):
                refund.status = "failed"
                self.db.commit()
                message = data.get("error", {}).get("description", "Razorpay refund was rejected")
                raise BadRequestError(message)
            returned_payment_id = data.get("payment_id")
            returned_amount = data.get("amount")
            if returned_payment_id and returned_payment_id != payment.razorpay_payment_id:
                refund.status = "unknown"
                self.db.commit()
                raise BadRequestError("Gateway refund response did not match this payment; reconcile before retrying")
            if returned_amount is not None and int(returned_amount) != amount_paise:
                refund.status = "unknown"
                self.db.commit()
                raise BadRequestError("Gateway refund amount did not match; reconcile before retrying")
            refund.gateway_refund_id = data["id"]
            gateway_status = data.get("status")
            refund.status = gateway_status if gateway_status in ("processed", "failed") else "pending"
            self._sync_refund_totals(payment)
            if refund.status == "processed":
                post_refund(self.db, refund)
            self.db.commit()
            self.db.refresh(refund)
            return {"status": refund.status, "txn_id": payment.id, "refund_id": refund.id,
                    "gateway_refund_id": refund.gateway_refund_id, "amount": str(refund.amount)}
        except BadRequestError:
            raise
        except Exception as exc:
            self.db.rollback()
            reserved_refund = self.db.query(PaymentRefund).filter(PaymentRefund.id == refund.id).first()
            if reserved_refund:
                reserved_refund.status = "unknown"
                self.db.commit()
            logger.error("Refund request outcome is ambiguous for %s: %s", refund.id, exc)
            raise BadRequestError("Refund status could not be confirmed. It is reserved for reconciliation; do not submit it again.") from exc
