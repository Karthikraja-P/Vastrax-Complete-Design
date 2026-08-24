from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.middleware.auth import get_current_user, require_admin
from app.models.user import User
from app.schemas.payments import PaymentCreate, PaymentVerify, RefundIn, SimulatePaymentIn
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/initiate")
def initiate_payment(
    body: PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return PaymentService(db).initiate_payment(body, current_user)


@router.post("/verify")
def verify_payment(
    body: PaymentVerify,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return PaymentService(db).verify_payment(body, current_user)


@router.post("/simulate")
def simulate_payment(
    body: SimulatePaymentIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return PaymentService(db).simulate_payment(body.txn_id, current_user, body.success)


@router.post("/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()
    return PaymentService(db).handle_webhook(raw_body, request.headers.get("X-Razorpay-Signature"))


@router.get("/status/{txn_id}")
def get_payment_status(
    txn_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return PaymentService(db).get_payment_status(txn_id, current_user)


@router.get("/admin")
def list_payments(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return PaymentService(db).list_payments()


@router.post("/admin/refund")
def admin_refund(
    body: RefundIn,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return PaymentService(db).process_refund(body.txn_id, body.amount)
