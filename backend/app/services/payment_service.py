import base64
import hashlib
import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import requests
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.core.logging import get_logger
from app.models.order import Order
from app.models.payment import Payment
from app.models.product_variant import ProductVariant
from app.models.user import User
from app.schemas.payments import PaymentCreate, PaymentResponse

logger = get_logger(__name__)


def _is_mock_mode() -> bool:
    return (
        settings.phonepe_merchant_id == "MERCHANT_ID_MOCK"
        or settings.phonepe_salt_key == "SALT_KEY_MOCK"
    )


def _calculate_checksum(payload_b64: str, api_endpoint: str) -> str:
    string_to_hash = payload_b64 + api_endpoint + settings.phonepe_salt_key
    sha256_hash = hashlib.sha256(string_to_hash.encode()).hexdigest()
    return f"{sha256_hash}###{settings.phonepe_salt_index}"


class PaymentService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def initiate_payment(self, payload: PaymentCreate, user: User) -> dict:
        order = self.db.query(Order).filter(Order.id == payload.order_id).first()
        if not order:
            raise NotFoundError("Order not found")
        if order.user_id != user.id:
            raise ForbiddenError("Access denied")

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
            sim_url = (
                f"{settings.frontend_url}/checkout/payment-simulation"
                f"?txn_id={txn_id}&amount={payload.amount}&order_id={payload.order_id}"
            )
            return {
                "status": "success",
                "redirect_url": sim_url,
                "txn_id": txn_id,
                "mode": "simulation",
            }

        return self._call_phonepe(txn_id, payload.order_id, float(payload.amount), payload.payment_method, user)

    def _call_phonepe(
        self, txn_id: str, order_id: str, amount: float, payment_method: str, user: User
    ) -> dict:
        phonepe_url = (
            "https://api.phonepe.com/apis/hermes/pg/v1/pay"
            if settings.phonepe_env == "PRODUCTION"
            else "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay"
        )
        payload = {
            "merchantId": settings.phonepe_merchant_id,
            "merchantTransactionId": txn_id,
            "merchantUserId": user.id,
            "amount": int(amount * 100),
            "redirectUrl": f"{settings.frontend_url}/checkout/success?txn_id={txn_id}",
            "redirectMode": "REDIRECT",
            "callbackUrl": f"{settings.frontend_url}/api/v1/payments/webhook",
            "mobileNumber": (user.phone_number or "").replace(" ", "").replace("+91", "")[-10:],
            "paymentInstrument": {"type": "PAY_PAGE"},
        }
        payload_b64 = base64.b64encode(json.dumps(payload).encode()).decode()
        checksum = _calculate_checksum(payload_b64, "/pg/v1/pay")
        try:
            resp = requests.post(
                phonepe_url,
                json={"request": payload_b64},
                headers={"Content-Type": "application/json", "X-VERIFY": checksum},
                timeout=10,
            )
            resp_data = resp.json()
            if resp.status_code == 200 and resp_data.get("success"):
                redirect_url = resp_data["data"]["instrumentResponse"]["redirectInfo"]["url"]
                return {"status": "success", "redirect_url": redirect_url, "txn_id": txn_id, "mode": "production"}
            raise BadRequestError(resp_data.get("message", "PhonePe initiation failed"))
        except (BadRequestError, ForbiddenError):
            raise
        except Exception as exc:
            logger.warning("PhonePe call failed, falling back to simulation: %s", exc)
            sim_url = (
                f"{settings.frontend_url}/checkout/payment-simulation"
                f"?txn_id={txn_id}&amount={amount}&order_id={order_id}"
            )
            return {
                "status": "success",
                "redirect_url": sim_url,
                "txn_id": txn_id,
                "mode": "simulation",
                "warning": f"Real PhonePe call failed ({exc}), fell back to simulation",
            }

    def handle_webhook(self, raw_body: bytes, x_verify: str | None) -> dict:
        if not x_verify:
            raise BadRequestError("Missing X-VERIFY header")

        if not _is_mock_mode():
            calculated = hashlib.sha256(raw_body + settings.phonepe_salt_key.encode()).hexdigest()
            expected = f"{calculated}###{settings.phonepe_salt_index}"
            if x_verify != expected:
                raise ForbiddenError("Signature mismatch")

        body_json = json.loads(raw_body.decode())
        resp_b64 = body_json.get("response")
        if not resp_b64:
            raise BadRequestError("Missing response field")

        decoded = json.loads(base64.b64decode(resp_b64).decode())
        code = decoded.get("code")
        success = decoded.get("success", False)
        data = decoded.get("data", {})
        txn_id = data.get("merchantTransactionId")
        if not txn_id:
            raise BadRequestError("Missing transaction ID in response data")

        payment = self.db.query(Payment).filter(Payment.id == txn_id).first()
        if not payment:
            raise NotFoundError("Transaction not found")

        if success and code == "PAYMENT_SUCCESS":
            payment.status = "success"
            order = self.db.query(Order).filter(Order.id == payment.order_id).first()
            if order:
                order.status = "confirmed"
                order.payment_status = "paid"

                try:
                    from app.services.order_service import _book_shiprocket
                    _book_shiprocket(order, order.user, order.address)
                except Exception as exc:
                    logger.error("Failed to book shipment on payment webhook: %s", exc)

            self.db.commit()
            logger.info("Payment success: %s for order: %s", txn_id, payment.order_id)
        else:
            payment.status = "failed"
            self._restore_stock_and_cancel_order(payment.order_id)
            self.db.commit()
            logger.warning("Payment failed: %s for order: %s", txn_id, payment.order_id)

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

        if _is_mock_mode():
            payment.status = "refunded"
            order = self.db.query(Order).filter(Order.id == payment.order_id).first()
            if order:
                order.payment_status = "refunded"
            self.db.commit()
            return {"status": "refunded", "txn_id": txn_id}

        return self._call_phonepe_refund(txn_id, float(amount), payment.order_id)

    def _call_phonepe_refund(self, txn_id: str, amount: float, order_id: str) -> dict:
        phonepe_url = (
            "https://api.phonepe.com/apis/hermes/pg/v1/refund"
            if settings.phonepe_env == "PRODUCTION"
            else "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/refund"
        )
        refund_txn_id = f"REFUND-{uuid.uuid4().hex[:12].upper()}"
        payload = {
            "merchantId": settings.phonepe_merchant_id,
            "merchantTransactionId": refund_txn_id,
            "originalTransactionId": txn_id,
            "amount": int(amount * 100),
            "callbackUrl": f"{settings.frontend_url}/api/v1/payments/webhook",
        }
        payload_b64 = base64.b64encode(json.dumps(payload).encode()).decode()
        checksum = _calculate_checksum(payload_b64, "/pg/v1/refund")
        try:
            resp = requests.post(
                phonepe_url,
                json={"request": payload_b64},
                headers={"Content-Type": "application/json", "X-VERIFY": checksum},
                timeout=10,
            )
            resp_data = resp.json()
            if resp.status_code == 200 and resp_data.get("success"):
                payment = self.db.query(Payment).filter(Payment.id == txn_id).first()
                if payment:
                    payment.status = "refunded"
                order = self.db.query(Order).filter(Order.id == order_id).first()
                if order:
                    order.payment_status = "refunded"
                self.db.commit()
                return {"status": "refunded", "txn_id": txn_id, "refund_txn_id": refund_txn_id}
            raise BadRequestError(resp_data.get("message", "PhonePe refund call rejected"))
        except (BadRequestError,):
            raise
        except Exception as exc:
            logger.warning("PhonePe refund failed, applying local refund: %s", exc)
            payment = self.db.query(Payment).filter(Payment.id == txn_id).first()
            if payment:
                payment.status = "refunded"
            order = self.db.query(Order).filter(Order.id == order_id).first()
            if order:
                order.payment_status = "refunded"
            self.db.commit()
            return {
                "status": "refunded",
                "txn_id": txn_id,
                "warning": f"Real PhonePe refund failed ({exc})",
            }
