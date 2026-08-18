from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.middleware.auth import require_admin
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])

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
