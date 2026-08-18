from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.shiprocket_service import (
    cancel_shipment_by_awb,
    check_serviceability,
    create_return_shipment,
    generate_label,
    schedule_pickup,
)

router = APIRouter(prefix="/shipping", tags=["shipping"])


class ShippingRatesRequest(BaseModel):
    delivery_pincode: str
    weight: float = 0.5
    cod: bool = False


class LabelRequest(BaseModel):
    shipment_id: str


class PickupRequest(BaseModel):
    shipment_id: str
    pickup_date: str


class CancelRequest(BaseModel):
    awb_code: str


class ReturnRequest(BaseModel):
    order_id: str
    return_data: dict


@router.post("/rates")
def get_shipping_rates(body: ShippingRatesRequest):
    pincode = body.delivery_pincode.strip()
    if len(pincode) != 6 or not pincode.isdigit():
        raise HTTPException(status_code=400, detail="Invalid Indian pincode. Must be exactly 6 digits.")
    result = check_serviceability(pincode, body.weight, body.cod)
    if result.get("status") != 200:
        raise HTTPException(status_code=400, detail=result.get("message", "Serviceability check failed"))
    return result


@router.post("/label")
def get_shipping_label(body: LabelRequest):
    result = generate_label(body.shipment_id)
    if result.get("status") != 200:
        raise HTTPException(status_code=400, detail="Failed to generate shipping label")
    return result


@router.post("/pickup")
def book_shipping_pickup(body: PickupRequest):
    result = schedule_pickup(body.shipment_id, body.pickup_date)
    if result.get("status") != 200:
        raise HTTPException(status_code=400, detail="Failed to schedule courier pickup")
    return result


@router.post("/cancel")
def cancel_shipping_shipment(body: CancelRequest):
    result = cancel_shipment_by_awb(body.awb_code)
    if result.get("status") != 200:
        raise HTTPException(status_code=400, detail="Failed to cancel shipment")
    return result


@router.post("/return")
def create_reverse_return(body: ReturnRequest):
    result = create_return_shipment(body.order_id, body.return_data)
    if result.get("status") != 200:
        raise HTTPException(status_code=400, detail="Failed to create return shipment")
    return result
