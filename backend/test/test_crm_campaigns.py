import asyncio
import re
import uuid

import pytest

from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.main import app
from app.models.marketing_consent import CRMMarketingConsentEvent
from app.models.user import User


@pytest.fixture()
def business_admin():
    suffix = uuid.uuid4().hex[:10]
    db = SessionLocal()
    admin = User(id=f"admin-{suffix}", email=f"admin-{suffix}@example.test", hashed_password="test", role="admin", is_active=True)
    customer = User(id=f"customer-{suffix}", email=f"customer-{suffix}@example.com", full_name="Beta Customer", hashed_password="test", role="customer", is_active=True)
    db.add_all([admin, customer])
    db.commit()
    admin_id, customer_id = admin.id, customer.id
    db.close()
    return {"suffix": suffix, "customer_id": customer_id, "token": create_access_token({"sub": admin_id})}


def test_email_campaign_targets_current_consent_and_unsubscribe_is_effective(business_admin, monkeypatch):
    customer_id = business_admin["customer_id"]
    db = SessionLocal()
    customer = db.get(User, customer_id)
    customer.email = f"consented-{business_admin['suffix']}@example.com"
    expected_email = customer.email
    no_consent = User(
        id=f"no-consent-{business_admin['suffix']}",
        email=f"no-consent-{business_admin['suffix']}@example.com",
        hashed_password="test", role="customer", is_active=True,
    )
    admin_id = f"admin-{business_admin['suffix']}"
    db.add_all([
        no_consent,
        CRMMarketingConsentEvent(customer_id=customer_id, channel="email", granted=True,
                                 source="customer_account", actor_id=customer_id),
    ])
    db.commit()
    db.close()

    captured = []
    async def fake_send_email(to_email, subject, html_content):
        captured.append((to_email, subject, html_content))
        return {"id": "resend-test-id"}

    monkeypatch.setattr("app.api.routes.marketing.send_email", fake_send_email)
    monkeypatch.setattr("app.api.routes.marketing.settings.resend_api_key", "test-key")
    token = create_access_token({"sub": admin_id})
    headers = {"Authorization": f"Bearer {token}"}
    client = TestClient(app)

    assert client.get("/api/v1/crm/campaigns").status_code == 401
    audience = client.get("/api/v1/crm/campaigns/audience?segment=all_consented", headers=headers)
    assert audience.status_code == 200, audience.text
    assert audience.json()["eligible_count"] == 1

    created = client.post("/api/v1/crm/campaigns", headers=headers, json={
        "name": "Spring edit", "segment": "all_consented",
        "subject": "New season", "body": "Hello <script>alert(1)</script>",
    })
    assert created.status_code == 201, created.text
    campaign_id = created.json()["id"]
    queued = client.post(f"/api/v1/crm/campaigns/{campaign_id}/send", headers=headers)
    assert queued.status_code == 202, queued.text
    assert queued.json()["audience_count"] == 1
    assert len(captured) == 1
    recipient, subject, body = captured[0]
    assert recipient == expected_email and subject == "New season"
    assert "&lt;script&gt;" in body
    assert "Unsubscribe from marketing emails" in body

    unsubscribe_token = re.search(r"token=([^\"&]+)", body).group(1)
    unsubscribed = client.post("/api/v1/crm/marketing/unsubscribe", json={"token": unsubscribe_token})
    assert unsubscribed.status_code == 200, unsubscribed.text
    assert unsubscribed.json()["unsubscribed"] is True
    assert client.get("/api/v1/crm/campaigns/audience?segment=all_consented", headers=headers).json()["eligible_count"] == 0
    assert client.post("/api/v1/crm/marketing/unsubscribe", json={"token": unsubscribe_token}).status_code == 200
    another_draft = client.post("/api/v1/crm/campaigns", headers=headers, json={
        "name": "After opt-out", "segment": "all_consented", "subject": "Offer", "body": "Details",
    })
    no_recipients = client.post(f"/api/v1/crm/campaigns/{another_draft.json()['id']}/send", headers=headers)
    assert no_recipients.status_code == 409
    assert no_recipients.json()["detail"] == "No active customers currently qualify and have email marketing consent"

    db = SessionLocal()
    from app.models.marketing_campaign import CRMCampaign, CRMCampaignDelivery
    saved = db.get(CRMCampaign, campaign_id)
    delivery = db.query(CRMCampaignDelivery).filter_by(campaign_id=campaign_id).one()
    assert saved.status == "sent" and saved.sent_count == 1 and saved.failed_count == 0
    assert delivery.status == "sent"
    db.close()


def test_campaign_send_requires_provider_and_fresh_consent(business_admin, monkeypatch):
    token = create_access_token({"sub": f"admin-{business_admin['suffix']}"})
    headers = {"Authorization": f"Bearer {token}"}
    client = TestClient(app)
    created = client.post("/api/v1/crm/campaigns", headers=headers, json={
        "name": "Draft", "segment": "all_consented", "subject": "Offer", "body": "Details",
    })
    assert created.status_code == 201, created.text
    monkeypatch.setattr("app.api.routes.marketing.settings.resend_api_key", "")
    blocked = client.post(f"/api/v1/crm/campaigns/{created.json()['id']}/send", headers=headers)
    assert blocked.status_code == 503
    assert blocked.json()["detail"] == "Email campaign delivery is unavailable until RESEND_API_KEY is configured"
    db = SessionLocal()
    from app.models.marketing_campaign import CRMCampaign
    assert db.get(CRMCampaign, created.json()["id"]).status == "draft"
    db.close()


def test_queued_campaign_skips_customer_who_withdrew_consent_before_delivery(business_admin, monkeypatch):
    from app.models.marketing_campaign import CRMCampaign, CRMCampaignDelivery
    from app.api.routes.marketing import dispatch_campaign

    db = SessionLocal()
    customer = db.get(User, business_admin["customer_id"])
    email = customer.email
    db.add(CRMMarketingConsentEvent(
        customer_id=customer.id, channel="email", granted=True,
        source="customer_account", actor_id=customer.id,
    ))
    campaign = CRMCampaign(
        name="Queued test", channel="email", segment="all_consented",
        subject="Test", body="Test body", status="queued", audience_count=1,
        created_by=f"admin-{business_admin['suffix']}",
    )
    db.add(campaign)
    db.flush()
    db.add(CRMCampaignDelivery(
        campaign_id=campaign.id, customer_id=customer.id, recipient_email=email, status="queued",
    ))
    db.add(CRMMarketingConsentEvent(
        customer_id=customer.id, channel="email", granted=False,
        source="customer_account", actor_id=customer.id,
    ))
    campaign_id = campaign.id
    db.commit()
    db.close()

    sent = []
    async def fake_send_email(*args):
        sent.append(args)
        return {"id": "should-not-send"}
    monkeypatch.setattr("app.api.routes.marketing.send_email", fake_send_email)
    asyncio.run(dispatch_campaign(campaign_id))

    db = SessionLocal()
    campaign = db.get(CRMCampaign, campaign_id)
    delivery = db.query(CRMCampaignDelivery).filter_by(campaign_id=campaign_id).one()
    assert sent == []
    assert campaign.status == "skipped" and campaign.skipped_count == 1
    assert delivery.status == "skipped"
    db.close()
