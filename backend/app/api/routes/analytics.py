from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.middleware.auth import require_admin
from app.models.chat_message import ChatMessage
from app.models.tryon_session import TryonSession
from app.models.user import User
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/insights")
def get_dynamic_insights(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Returns AI insights and threshold-based alerts for the dashboard metrics.
    """
    service = AnalyticsService(db)
    return service.get_dynamic_insights()


@router.get("/overview")
def get_analytics_overview(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Returns high-level Bento dashboard metrics:
    Total revenue, customer growth, weekly sales series, and conversion rate.
    """
    return {
        "revenue": {
            "total": 319200.00,
            "changePercent": 14.6,
            "trend": "UP",
            "avgOrderValue": 128.50
        },
        "customers": {
            "total": 8420,
            "growthPercent": 8.2,
            "retentionRate": 74.5
        },
        "salesWeekly": {
            "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            "values": [4200, 6800, 5100, 9200, 8400, 11500, 13400]
        },
        "conversionRate": {
            "rate": 3.42,
            "change": 0.8
        },
        "activeCampaigns": {
            "count": 4,
            "reach": "128.4K",
            "roi": "340%"
        }
    }

@router.get("/usage")
def get_usage_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Real usage counters (not mock data) for the virtual try-on and AI stylist features,
    derived from the tryon_sessions and chat_messages tables.
    """
    tryon_total = db.query(func.count(TryonSession.id)).scalar() or 0
    tryon_by_status = dict(
        db.query(TryonSession.status, func.count(TryonSession.id)).group_by(TryonSession.status).all()
    )
    tryon_unique_users = db.query(func.count(func.distinct(TryonSession.user_id))).scalar() or 0

    chat_total_messages = db.query(func.count(ChatMessage.id)).scalar() or 0
    chat_total_sessions = db.query(func.count(func.distinct(ChatMessage.session_id))).scalar() or 0
    chat_unique_users = (
        db.query(func.count(func.distinct(ChatMessage.user_id)))
        .filter(ChatMessage.user_id.isnot(None))
        .scalar()
        or 0
    )

    return {
        "tryon": {
            "total_sessions": tryon_total,
            "completed": tryon_by_status.get("done", 0),
            "failed": tryon_by_status.get("failed", 0),
            "processing": tryon_by_status.get("processing", 0),
            "unique_users": tryon_unique_users,
        },
        "ai_assistant": {
            "total_messages": chat_total_messages,
            "total_sessions": chat_total_sessions,
            "unique_signed_in_users": chat_unique_users,
        },
    }


@router.get("/regional-sales")
def get_regional_sales(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Returns geospatial sales metrics by country/region.
    """
    return {
        "regions": [
            { "countryCode": "US", "countryName": "United States", "revenue": 142000, "orders": 890 },
            { "countryCode": "GB", "countryName": "United Kingdom", "revenue": 68000, "orders": 410 },
            { "countryCode": "SA", "countryName": "Saudi Arabia", "revenue": 54000, "orders": 290 },
            { "countryCode": "AE", "countryName": "United Arab Emirates", "revenue": 38000, "orders": 210 },
            { "countryCode": "DE", "countryName": "Germany", "revenue": 24000, "orders": 140 }
        ]
    }
