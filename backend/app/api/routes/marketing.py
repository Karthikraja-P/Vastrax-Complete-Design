"""Consent-aware CRM campaign drafts and email delivery."""
from datetime import datetime, timedelta, timezone
import hashlib
import html
import secrets
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import SessionLocal, get_db
from app.middleware.auth import require_business_permission
from app.models.marketing_consent import CRMMarketingConsentEvent
from app.models.marketing_campaign import CRMCampaign, CRMCampaignDelivery, CRMMarketingUnsubscribeToken
from app.models.order import Order
from app.models.user import User
from app.services.email_service import send_email

router = APIRouter(tags=["crm-campaigns"])
SEGMENTS = {"all_consented", "repeat_customers", "recent_90_days", "inactive_90_days"}
MAX_CAMPAIGN_RECIPIENTS = 1000


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    segment: Literal["all_consented", "repeat_customers", "recent_90_days", "inactive_90_days"]
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=10000)


class CampaignUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    segment: Literal["all_consented", "repeat_customers", "recent_90_days", "inactive_90_days"] | None = None
    subject: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = Field(default=None, min_length=1, max_length=10000)


class UnsubscribeRequest(BaseModel):
    token: str = Field(min_length=32, max_length=128)


def _eligible_customers(db: Session, segment: str) -> list[User]:
    if segment not in SEGMENTS:
        raise HTTPException(422, "Unsupported audience segment")
    orders = db.query(
        Order.user_id.label("customer_id"),
        func.count(Order.id).label("order_count"),
        func.max(Order.placed_at).label("last_order_at"),
    ).filter(Order.status != "cancelled").group_by(Order.user_id).subquery()

    latest_consent = db.query(
        CRMMarketingConsentEvent.customer_id.label("customer_id"),
        CRMMarketingConsentEvent.granted.label("granted"),
        func.row_number().over(
            partition_by=CRMMarketingConsentEvent.customer_id,
            order_by=(CRMMarketingConsentEvent.recorded_at.desc(), CRMMarketingConsentEvent.id.desc()),
        ).label("rank"),
    ).filter(CRMMarketingConsentEvent.channel == "email").subquery()
    consented_ids = {
        row[0] for row in db.query(latest_consent.c.customer_id).filter(
            latest_consent.c.rank == 1, latest_consent.c.granted.is_(True)
        ).all()
    }
    if not consented_ids:
        return []

    query = db.query(User).filter(
        User.id.in_(consented_ids),
        User.role == "customer",
        User.is_active.is_(True),
        User.email.isnot(None),
        User.email != "",
    )
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=90)
    if segment == "repeat_customers":
        query = query.join(orders, orders.c.customer_id == User.id).filter(orders.c.order_count >= 2)
    elif segment == "recent_90_days":
        query = query.join(orders, orders.c.customer_id == User.id).filter(orders.c.last_order_at >= cutoff)
    elif segment == "inactive_90_days":
        query = query.join(orders, orders.c.customer_id == User.id).filter(orders.c.last_order_at < cutoff)
    return query.order_by(User.created_at.asc(), User.id.asc()).limit(MAX_CAMPAIGN_RECIPIENTS + 1).all()


def _campaign_json(campaign: CRMCampaign, delivery_counts: dict[str, int] | None = None) -> dict:
    return {
        "id": campaign.id, "name": campaign.name, "channel": campaign.channel, "segment": campaign.segment,
        "subject": campaign.subject, "body": campaign.body, "status": campaign.status,
        "audience_count": campaign.audience_count, "sent_count": campaign.sent_count,
        "failed_count": campaign.failed_count, "skipped_count": campaign.skipped_count, "created_at": campaign.created_at,
        "sent_at": campaign.sent_at, "delivery_counts": delivery_counts or {},
    }


@router.get("/crm/campaigns", dependencies=[Depends(require_business_permission("crm"))])
def list_campaigns(db: Session = Depends(get_db)):
    campaigns = db.query(CRMCampaign).order_by(CRMCampaign.created_at.desc()).limit(100).all()
    results = []
    for campaign in campaigns:
        counts = dict(db.query(CRMCampaignDelivery.status, func.count(CRMCampaignDelivery.id)).filter(
            CRMCampaignDelivery.campaign_id == campaign.id
        ).group_by(CRMCampaignDelivery.status).all())
        results.append(_campaign_json(campaign, counts))
    return results


@router.get("/crm/campaigns/audience", dependencies=[Depends(require_business_permission("crm"))])
def preview_audience(segment: str, db: Session = Depends(get_db)):
    if segment not in SEGMENTS:
        raise HTTPException(422, "Unsupported audience segment")
    recipients = _eligible_customers(db, segment)
    if len(recipients) > MAX_CAMPAIGN_RECIPIENTS:
        return {"segment": segment, "eligible_count": len(recipients), "limit_exceeded": True}
    return {"segment": segment, "eligible_count": len(recipients), "limit_exceeded": False}


@router.post("/crm/campaigns", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_business_permission("crm"))])
def create_campaign(body: CampaignCreate, author: User = Depends(require_business_permission("crm")), db: Session = Depends(get_db)):
    name = body.name.strip()
    subject = body.subject.strip()
    content = body.body.strip()
    if not name or not subject or not content:
        raise HTTPException(422, "Campaign name, subject, and body are required")
    campaign = CRMCampaign(name=name, channel="email", segment=body.segment, subject=subject, body=content, created_by=author.id)
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return _campaign_json(campaign)


@router.patch("/crm/campaigns/{campaign_id}", dependencies=[Depends(require_business_permission("crm"))])
def update_campaign(campaign_id: str, body: CampaignUpdate, db: Session = Depends(get_db)):
    campaign = db.get(CRMCampaign, campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    if campaign.status != "draft":
        raise HTTPException(409, "Only a draft campaign can be edited")
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(422, "Provide at least one campaign field to update")
    for field, value in updates.items():
        if value is None:
            raise HTTPException(422, f"{field.replace('_', ' ').capitalize()} cannot be null")
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise HTTPException(422, f"{field.replace('_', ' ').capitalize()} cannot be blank")
        setattr(campaign, field, value)
    db.commit()
    db.refresh(campaign)
    return _campaign_json(campaign)


@router.delete("/crm/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_business_permission("crm"))])
def delete_campaign(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.get(CRMCampaign, campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    if campaign.status != "draft":
        raise HTTPException(409, "Only a draft campaign can be deleted")
    db.delete(campaign)
    db.commit()


@router.post("/crm/campaigns/{campaign_id}/send", status_code=status.HTTP_202_ACCEPTED,
             dependencies=[Depends(require_business_permission("crm"))])
def send_campaign(campaign_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not settings.resend_api_key:
        raise HTTPException(503, "Email campaign delivery is unavailable until RESEND_API_KEY is configured")
    campaign = db.query(CRMCampaign).filter(CRMCampaign.id == campaign_id).with_for_update().first()
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    if campaign.status != "draft":
        raise HTTPException(409, "Only a draft campaign can be sent")
    recipients = _eligible_customers(db, campaign.segment)
    if len(recipients) > MAX_CAMPAIGN_RECIPIENTS:
        raise HTTPException(409, "This campaign exceeds the 1,000-recipient send limit")
    if not recipients:
        raise HTTPException(409, "No active customers currently qualify and have email marketing consent")
    claimed = db.query(CRMCampaign).filter(
        CRMCampaign.id == campaign.id, CRMCampaign.status == "draft"
    ).update({"status": "queued", "audience_count": len(recipients)}, synchronize_session=False)
    if claimed != 1:
        db.rollback()
        raise HTTPException(409, "This campaign has already been queued")
    for customer in recipients:
        db.add(CRMCampaignDelivery(
            campaign_id=campaign.id, customer_id=customer.id, recipient_email=customer.email, status="queued"
        ))
    db.commit()
    background_tasks.add_task(dispatch_campaign, campaign.id)
    return {"id": campaign.id, "status": "queued", "audience_count": len(recipients)}


def _current_email_consent(db: Session, customer_id: str) -> bool:
    latest = db.query(CRMMarketingConsentEvent).filter(
        CRMMarketingConsentEvent.customer_id == customer_id,
        CRMMarketingConsentEvent.channel == "email",
    ).order_by(CRMMarketingConsentEvent.recorded_at.desc(), CRMMarketingConsentEvent.id.desc()).first()
    return bool(latest and latest.granted)


def _message_html(body: str, unsubscribe_url: str) -> str:
    safe_body = html.escape(body).replace("\n", "<br>")
    safe_url = html.escape(unsubscribe_url, quote=True)
    return (
        f"<div style=\"font-family:Arial,sans-serif;line-height:1.6;white-space:normal\">{safe_body}</div>"
        f"<hr><p style=\"font-size:12px;color:#666\">You received this message because you opted in to Vastrax email updates. "
        f"<a href=\"{safe_url}\">Unsubscribe from marketing emails</a></p>"
    )


async def dispatch_campaign(campaign_id: str) -> None:
    db = SessionLocal()
    try:
        campaign = db.get(CRMCampaign, campaign_id)
        if not campaign or campaign.status not in ("queued", "sending"):
            return
        campaign.status = "sending"
        db.commit()
        deliveries = db.query(CRMCampaignDelivery).filter(
            CRMCampaignDelivery.campaign_id == campaign.id,
            CRMCampaignDelivery.status == "queued",
        ).order_by(CRMCampaignDelivery.created_at.asc(), CRMCampaignDelivery.id.asc()).all()
        base_url = settings.frontend_url.split(",")[0].strip().rstrip("/")
        for delivery in deliveries:
            if not _current_email_consent(db, delivery.customer_id):
                delivery.status = "skipped"
                delivery.error_detail = "Consent was withdrawn before delivery"
                db.commit()
                continue
            customer = db.get(User, delivery.customer_id)
            if not customer or not customer.is_active or customer.role != "customer":
                delivery.status = "skipped"
                delivery.error_detail = "Customer account is not active"
                db.commit()
                continue
            raw_token = secrets.token_urlsafe(32)
            db.add(CRMMarketingUnsubscribeToken(
                token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
                customer_id=customer.id,
            ))
            db.commit()
            unsubscribe_url = f"{base_url}/storefront/unsubscribe?token={raw_token}"
            if not customer.email:
                delivery.status = "skipped"
                delivery.error_detail = "Customer has no deliverable email address"
                db.commit()
                continue
            delivery.recipient_email = customer.email
            try:
                result = await send_email(
                    customer.email,
                    campaign.subject,
                    _message_html(campaign.body, unsubscribe_url),
                )
                if isinstance(result, dict) and (result.get("error") or result.get("status") in ("failed", "skipped")):
                    raise RuntimeError(str(result.get("error") or result.get("status")))
                delivery.status = "sent"
                delivery.provider_message_id = str(result.get("id"))[:200] if isinstance(result, dict) and result.get("id") else None
                delivery.sent_at = datetime.now(timezone.utc)
            except Exception as exc:
                delivery.status = "failed"
                delivery.error_detail = f"Provider send failed ({type(exc).__name__})"
            db.commit()

        counts = dict(db.query(CRMCampaignDelivery.status, func.count(CRMCampaignDelivery.id)).filter(
            CRMCampaignDelivery.campaign_id == campaign.id
        ).group_by(CRMCampaignDelivery.status).all())
        sent = counts.get("sent", 0)
        failed = counts.get("failed", 0)
        queued = counts.get("queued", 0)
        skipped = counts.get("skipped", 0)
        campaign.sent_count = sent
        campaign.failed_count = failed
        campaign.skipped_count = skipped
        campaign.status = "partial" if sent and (failed or queued or skipped) else "sent" if sent else "skipped" if skipped and not failed and not queued else "failed"
        if campaign.status == "sent":
            campaign.sent_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        db.rollback()
        # Keep campaign in a retryable state; it is never silently labeled as sent.
    finally:
        db.close()


@router.post("/crm/marketing/unsubscribe", status_code=status.HTTP_200_OK)
def unsubscribe_from_email(body: UnsubscribeRequest, db: Session = Depends(get_db)):
    digest = hashlib.sha256(body.token.encode("utf-8")).hexdigest()
    token = db.get(CRMMarketingUnsubscribeToken, digest)
    if not token:
        raise HTTPException(404, "Unsubscribe link is invalid")
    latest = _current_email_consent(db, token.customer_id)
    if latest:
        db.add(CRMMarketingConsentEvent(
            customer_id=token.customer_id, channel="email", granted=False,
            source="email_unsubscribe", actor_id=token.customer_id,
        ))
    token.used_at = token.used_at or datetime.now(timezone.utc)
    db.commit()
    return {"unsubscribed": True}
