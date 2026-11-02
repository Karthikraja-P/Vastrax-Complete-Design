import os
import re
import requests
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger("vastrax.shiprocket")
API_BASE = "https://apiv2.shiprocket.in/v1/external"


def _mock_shipping_enabled() -> bool:
    try:
        from app.core.config import settings
        return str(getattr(settings, "app_env", "")).strip().lower() not in {"production", "prod"}
    except Exception:
        return os.getenv("APP_ENV", "development").strip().lower() not in {"production", "prod"}


def _is_production() -> bool:
    return not _mock_shipping_enabled()


def _failure(message: str, status: int = 503) -> dict:
    return {"status": status, "error": message, "message": message}


def _pickup_location() -> str:
    try:
        from app.core.config import settings
        value = getattr(settings, "shiprocket_pickup_location", "Primary")
    except Exception:
        value = "Primary"
    return os.getenv("SHIPROCKET_PICKUP_LOCATION", value).strip() or "Primary"


def _get_credentials() -> tuple[str, str, str]:
    try:
        from app.core.config import settings
        cfg_email = getattr(settings, "shiprocket_email", "")
        cfg_pass = getattr(settings, "shiprocket_password", "")
        cfg_pin = getattr(settings, "pickup_pincode", "625706")
    except Exception:
        cfg_email = ""
        cfg_pass = ""
        cfg_pin = "625706"

    email = os.getenv("SHIPROCKET_EMAIL", cfg_email)
    password = os.getenv("SHIPROCKET_PASSWORD", cfg_pass)
    pincode = os.getenv("PICKUP_PINCODE", cfg_pin)
    return email.strip(), password.strip(), pincode.strip()


# Global cached token
_cached_token = None
_token_expiry = None

def get_token() -> str:
    """
    Authenticate with Shiprocket API and cache the token.
    If credentials are not configured, returns None to signal mock fallback.
    """
    global _cached_token, _token_expiry
    email, password, _ = _get_credentials()
    if not email or not password:
        return None

    # Check if cached token is still valid
    if _cached_token and _token_expiry and datetime.now(timezone.utc) < _token_expiry:
        return _cached_token

    try:
        url = "https://apiv2.shiprocket.in/v1/external/auth/login"
        payload = {
            "email": email,
            "password": password
        }
        resp = requests.post(url, json=payload, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            _cached_token = data.get("token")
            if not _cached_token:
                logger.error("Shiprocket auth response did not contain a token")
                return None
            # Tokens are typically valid for 10 days; cache it for 9 days safely
            _token_expiry = datetime.now(timezone.utc) + timedelta(days=9)
            return _cached_token
        else:
            logger.warning("Shiprocket authentication failed with HTTP %s", resp.status_code)
            return None
    except Exception as e:
        logger.error("Shiprocket authentication request failed: %s", type(e).__name__)
        return None

def check_serviceability(delivery_pincode: str, total_weight: float = 0.5, cod: bool = False) -> dict:
    """
    Get shipping rates and estimated delivery dates from Shiprocket.
    Falls back to high-quality simulated data if auth token is unavailable.
    """
    _, _, pickup_pincode = _get_credentials()
    if not re.fullmatch(r"\d{6}", str(delivery_pincode or "")):
        return _failure("Enter a valid 6-digit delivery pincode", 400)
    if total_weight <= 0:
        return _failure("Shipment weight must be greater than zero", 400)
    token = get_token()
    if token:
        try:
            url = "https://apiv2.shiprocket.in/v1/external/courier/serviceability/"
            params = {
                "pickup_postcode": pickup_pincode,
                "delivery_postcode": delivery_pincode,
                "weight": total_weight,
                "cod": 1 if cod else 0
            }
            headers = {"Authorization": f"Bearer {token}"}
            resp = requests.get(url, params=params, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                data["status"] = 200
                return data
            logger.warning("Shiprocket serviceability returned HTTP %s", resp.status_code)
        except Exception as e:
            logger.error("Shiprocket serviceability failed: %s", type(e).__name__)

    if _is_production():
        return _failure("Live Shiprocket rates are unavailable. Check credentials and retry.")

    # Simulated/Mock serviceability response
    # Standard rates based on general distance simulation
    try:
        deliv_int = int(delivery_pincode)
    except ValueError:
        deliv_int = 600000

    # Calculate mock rates/days based on pincode difference to feel realistic
    diff = abs(int(pickup_pincode) - deliv_int)
    days = 2 + (diff % 4) # 2 to 5 days
    rate = 60.0 + (diff % 120) # ₹60 to ₹180 shipping cost

    est_date = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")

    return {
        "status": 200,
        "mock": True,
        "data": {
            "available_courier_companies": [
                {
                    "courier_company_id": 43,
                    "courier_name": "Delhivery Direct",
                    "rate": str(rate),
                    "etd": est_date,
                    "min_weight": 0.5
                },
                {
                    "courier_company_id": 10,
                    "courier_name": "Blue Dart Express",
                    "rate": str(rate + 40.0),
                    "etd": (datetime.now() + timedelta(days=max(1, days - 1))).strftime("%Y-%m-%d"),
                    "min_weight": 0.5
                },
                {
                    "courier_company_id": 25,
                    "courier_name": "Xpressbees",
                    "rate": str(max(40.0, rate - 15.0)),
                    "etd": (datetime.now() + timedelta(days=days + 1)).strftime("%Y-%m-%d"),
                    "min_weight": 0.5
                }
            ]
        }
    }

def create_shipment_order(order_id: str, customer_info: dict, items: list, total_amount: float, payment_method: str = "Prepaid", weight: float = 0.5) -> dict:
    """
    Create a draft shipment in Shiprocket for a customer order.
    """
    _, _, pickup_pincode = _get_credentials()
    if not re.fullmatch(r"\d{6}", str(customer_info.get("pincode", ""))):
        return _failure("A valid 6-digit customer pincode is required", 400)
    token = get_token()
    if token:
        try:
            url = "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc"
            # Format billing customer name
            full_name = customer_info.get("name", "Valued Customer")
            name_parts = full_name.split(" ", 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""

            # Standardized address details
            raw_addr = customer_info.get("address", "N/A")
            addr_parts = [p.strip() for p in raw_addr.split(",") if p.strip()]
            city = customer_info.get("city") or (addr_parts[-1] if addr_parts else "")
            state = customer_info.get("state") or ""
            pincode = customer_info.get("pincode", pickup_pincode)

            payload = {
                "order_id": order_id,
                "order_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "pickup_location": _pickup_location(),
                "billing_customer_name": first_name,
                "billing_last_name": last_name,
                "billing_address": raw_addr[:190],
                "billing_address_2": customer_info.get("address_line2", "")[:190],
                "billing_city": city,
                "billing_pincode": pincode,
                "billing_state": state,
                "billing_country": "India",
                "billing_email": customer_info.get("email", "vastrax.shop@gmail.com"),
                "billing_phone": customer_info.get("phone", ""),
                "shipping_is_billing": True,
                "order_items": [
                    {
                        "name": it.get("name", "Premium Garment"),
                        "sku": it.get("sku") or it.get("variant_id", "GENERIC-SKU"),
                        "units": it.get("quantity", 1),
                        "selling_price": str(it.get("unit_price", 0.0))
                    }
                    for it in items
                ],
                "payment_method": "COD" if payment_method in ("Cash on Delivery", "COD") else "Prepaid",
                "sub_total": sum(float(it.get("unit_price", 0)) * int(it.get("quantity", 1)) for it in items),
                "length": 10,
                "breadth": 10,
                "height": 5,
                "weight": max(0.1, float(weight))
            }
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            resp = requests.post(url, json=payload, headers=headers, timeout=15)
            if resp.status_code in (200, 201):
                data = resp.json()
                data["status"] = resp.status_code
                return data
            try:
                error = resp.json()
                return _failure(str(error.get("message") or error.get("errors") or "Shiprocket rejected shipment creation"), resp.status_code)
            except ValueError:
                return _failure("Shiprocket rejected shipment creation", resp.status_code)
        except Exception as e:
            logger.error("Shiprocket order create failed: %s", type(e).__name__)

    if _is_production():
        return _failure("Live Shiprocket shipment creation failed. No shipment was booked.")

    # Mock response for successful shipment creation
    import uuid
    mock_shipment_id = f"{10000000 + abs(hash(order_id)) % 89999999}"
    return {
        "status": 200,
        "mock": True,
        "order_id": order_id,
        "shipment_id": mock_shipment_id,
        "awb_code": f"SR{uuid.uuid4().hex[:10].upper()}",
        "courier_name": "Delhivery Direct (Mock)"
    }

def track_shipment(shipment_id: str) -> dict:
    """
    Fetch tracking updates for a shipment.
    Returns custom history timeline if real API isn't available.
    """
    token = get_token()
    if token and str(shipment_id).isdigit():
        try:
            url = f"https://apiv2.shiprocket.in/v1/external/courier/track/shipment/{shipment_id}"
            headers = {"Authorization": f"Bearer {token}"}
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                data["status"] = resp.status_code
                return data
        except Exception as e:
            logger.error(f"Error tracking Shiprocket shipment: {e}")

    if _is_production():
        return _failure("Live tracking is unavailable for this shipment")
    # Simulated tracking milestones based on date/id
    # Ensure tracking updates return standard formats
    return {
        "status": 200,
        "mock": True,
        "tracking_data": {
            "shipment_track": [
                {
                    "id": shipment_id,
                    "current_status": "Shipped",
                    "scans": [
                        {"activity": "Shipment picked up from boutique hub", "date": datetime.now().strftime("%Y-%m-%d %H:%M"), "location": "Chennai Warehouse"},
                        {"activity": "Order manifest created & packed", "date": (datetime.now() - timedelta(hours=4)).strftime("%Y-%m-%d %H:%M"), "location": "Chennai Hub"}
                    ]
                }
            ]
        }
    }

def generate_label(shipment_id: str) -> dict:
    """
    Generate printable shipping label PDF URL from Shiprocket.
    """
    token = get_token()
    if token and str(shipment_id).isdigit():
        try:
            url = "https://apiv2.shiprocket.in/v1/external/courier/generate/label"
            payload = {"shipment_id": [int(shipment_id)]}
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                data["status"] = resp.status_code
                return data
        except Exception as e:
            logger.error(f"Error generating Shiprocket label: {e}")

    if _is_production():
        return _failure("Shiprocket label generation is unavailable")
    # Mock shipping label PDF URL
    return {
        "status": 200,
        "mock": True,
        "label_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        "response": "Label generated successfully (Simulated)"
    }

def schedule_pickup(shipment_id: str, pickup_date: str) -> dict:
    """
    Schedule courier pickup for a shipment.
    """
    token = get_token()
    if token and str(shipment_id).isdigit():
        try:
            url = "https://apiv2.shiprocket.in/v1/external/courier/generate/pickup"
            payload = {
                "shipment_id": [int(shipment_id)],
                "pickup_date": [pickup_date]
            }
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                data["status"] = resp.status_code
                return data
        except Exception as e:
            logger.error(f"Error booking Shiprocket pickup: {e}")

    if _is_production():
        return _failure("Shiprocket pickup scheduling is unavailable")
    # Mock scheduling success response
    return {
        "status": 200,
        "mock": True,
        "pickup_status": "Scheduled",
        "pickup_date": pickup_date,
        "response": "Courier pickup booked successfully (Simulated)"
    }

def cancel_shipment_by_awb(awb_code: str) -> dict:
    """
    Cancel a shipment order in Shiprocket using its AWB code.
    """
    token = get_token()
    if token and not str(awb_code).startswith(("SR", "MOCK-")):
        try:
            url = "https://apiv2.shiprocket.in/v1/external/orders/cancel/shipment/awbs"
            payload = {"awbs": [awb_code]}
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                data["status"] = resp.status_code
                return data
        except Exception as e:
            logger.error(f"Error cancelling Shiprocket shipment: {e}")

    if _is_production():
        return _failure("Shiprocket cancellation is unavailable")
    # Mock cancellation success response
    return {
        "status": 200,
        "mock": True,
        "response": "Shipment cancelled successfully in Shiprocket aggregator (Simulated)"
    }

def create_return_shipment(order_id: str, return_data: dict) -> dict:
    """
    Initiate a return reverse shipment in Shiprocket.
    """
    token = get_token()
    if token:
        try:
            url = "https://apiv2.shiprocket.in/v1/external/orders/create/return"
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            resp = requests.post(url, json=return_data, headers=headers, timeout=10)
            if resp.status_code in (200, 201):
                data = resp.json()
                data["status"] = resp.status_code
                return data
        except Exception as e:
            logger.error(f"Error creating Shiprocket return shipment: {e}")

    if _is_production():
        return _failure("Shiprocket return shipment creation is unavailable")
    # Mock reverse shipment return response
    import uuid
    return {
        "status": 200,
        "mock": True,
        "order_id": f"RET-{order_id}",
        "shipment_id": f"{30000000 + abs(hash(order_id)) % 89999999}",
        "awb_code": f"RETSR{uuid.uuid4().hex[:10].upper()}",
        "courier_name": "Delhivery Reverse Logistics (Mock)"
    }



def get_return_destination() -> dict:
    """Read the configured seller return address from the Shiprocket account."""
    token = get_token()
    if not token:
        return _failure("Shiprocket authentication unavailable; return destination could not be loaded")
    try:
        resp = requests.get(
            f"{API_BASE}/settings/company/pickup",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        if resp.status_code != 200:
            return _failure("Could not load the VastraX return address from Shiprocket", resp.status_code)
        payload = resp.json().get("data") or {}
        if isinstance(payload, list):
            locations = [row for row in payload if isinstance(row, dict)]
            company_name = ""
        elif isinstance(payload, dict):
            primary = payload.get("shipping_address")
            locations = [row for row in primary if isinstance(row, dict)] if isinstance(primary, list) else ([primary] if isinstance(primary, dict) else [])
            locations.extend(row for row in (payload.get("recent_addresses") or []) if isinstance(row, dict))
            company_name = payload.get("company_name") or ""
        else:
            locations = []
            company_name = ""
        expected = _pickup_location().casefold()
        address = next(
            (row for row in locations if str(row.get("pickup_location") or "").strip().casefold() == expected),
            None,
        )
        if address is None:
            return _failure("The configured Shiprocket return pickup location was not found")
        result = {
            "name": address.get("name") or company_name,
            "address": address.get("address"),
            "address_2": address.get("address_2") or "",
            "city": address.get("city"),
            "state": address.get("state"),
            "country": address.get("country") or "India",
            "pincode": address.get("pin_code"),
            "email": address.get("email"),
            "phone": address.get("phone"),
            "pickup_location": address.get("pickup_location"),
        }
        required = ("name", "address", "city", "state", "pincode", "phone")
        if any(not str(result.get(key) or "").strip() for key in required):
            return _failure("The configured Shiprocket return address is missing required contact or address details")
        return {"status": 200, "data": result}
    except Exception as exc:
        logger.error("Could not load Shiprocket return destination: %s", type(exc).__name__)
        return _failure("Could not load the VastraX return address from Shiprocket")


def assign_awb(shipment_id: str, courier_id: int | None = None) -> dict:
    """Assign a carrier and AWB to a previously created Shiprocket shipment."""
    if not str(shipment_id).isdigit():
        if _is_production():
            return _failure("Cannot assign an AWB to a non-provider shipment id")
        return {"status": 200, "mock": True, "awb_code": f"MOCK-{shipment_id}", "courier_name": "Development courier"}
    token = get_token()
    if not token:
        return _failure("Shiprocket authentication unavailable; AWB was not assigned") if _is_production() else {
            "status": 200, "mock": True, "awb_code": f"MOCK-{shipment_id}", "courier_name": "Development courier"
        }
    payload = {"shipment_id": int(shipment_id)}
    if courier_id is not None:
        payload["courier_id"] = int(courier_id)
    try:
        resp = requests.post(f"{API_BASE}/courier/assign/awb", json=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, timeout=15)
        data = resp.json()
        if resp.status_code not in (200, 201):
            return _failure(str(data.get("message") or "Shiprocket AWB assignment failed"), resp.status_code)
        awb = data.get("awb_code") or data.get("response", {}).get("data", {}).get("awb_code")
        if not awb:
            err_msg = (
                data.get("response", {}).get("data", {}).get("awb_assign_error")
                or data.get("message")
                or "Shiprocket did not return an AWB after assignment"
            )
            return _failure(str(err_msg))
        data.update({"status": resp.status_code, "awb_code": awb, "courier_name": data.get("courier_name") or data.get("response", {}).get("data", {}).get("courier_name") or "Shiprocket courier"})
        return data
    except Exception as exc:
        logger.error("Shiprocket AWB assignment failed: %s", type(exc).__name__)
        return _failure("Shiprocket AWB assignment failed")


def generate_manifest(shipment_id: str) -> dict:
    """Generate a manifest for a shipment after AWB assignment and pickup request."""
    if not str(shipment_id).isdigit():
        return _failure("A valid Shiprocket shipment id is required", 400)
    token = get_token()
    if not token:
        return _failure("Shiprocket authentication unavailable")
    try:
        resp = requests.post(f"{API_BASE}/manifests/generate", json={"shipment_id": [int(shipment_id)]},
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, timeout=15)
        data = resp.json()
        data["status_code"] = resp.status_code
        if resp.status_code not in (200, 201):
            data["error"] = data.get("message") or "Shiprocket manifest generation failed"
        return data
    except Exception as exc:
        logger.error("Shiprocket manifest generation failed: %s", type(exc).__name__)
        return _failure("Shiprocket manifest generation failed")


def select_shipping_quote(result: dict) -> dict:
    """Select the cheapest live serviceability result and normalize its amount."""
    data = result.get("data") or {}
    companies = data.get("available_courier_companies") or result.get("available_courier_companies") or []
    choices = []
    for courier in companies:
        try:
            price = courier.get("rate") or courier.get("freight_charge")
            if price is None:
                continue
            amount = float(price)
            if amount < 0:
                continue
            choices.append({
                "courier_id": int(courier.get("courier_company_id") or courier.get("id")),
                "courier_name": str(courier.get("courier_name") or "Shiprocket courier"),
                "rate": amount,
                "etd": courier.get("etd") or courier.get("estimated_delivery_days"),
            })
        except (TypeError, ValueError):
            continue
    if not choices:
        return _failure("No Shiprocket courier is available for this pincode")
    return min(choices, key=lambda item: item["rate"])


def get_ndr_shipments(page: int = 1, per_page: int = 100, search: str | None = None) -> dict:
    """Fetch Shiprocket's live non-delivery report for admin review."""
    token = get_token()
    if not token:
        return _failure("Shiprocket authentication unavailable; NDR cases could not be loaded")
    try:
        params = {"page": page, "per_page": per_page}
        if search:
            params["search"] = search.strip()
        resp = requests.get(
            f"{API_BASE}/ndr/all",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        try:
            payload = resp.json()
        except ValueError:
            payload = {}
        if resp.status_code != 200:
            logger.warning("Shiprocket NDR list returned HTTP %s", resp.status_code)
            return _failure(str(payload.get("message") or "Shiprocket NDR list is unavailable"), resp.status_code)
        rows = payload.get("data") or []
        if isinstance(rows, dict):
            rows = rows.get("data") or rows.get("shipments") or []
        if not isinstance(rows, list):
            rows = []
        return {"status": 200, "data": rows, "meta": payload.get("meta") or {}}
    except Exception as exc:
        logger.error("Shiprocket NDR list request failed: %s", type(exc).__name__)
        return _failure("Shiprocket NDR list is unavailable")


def submit_ndr_action(awb: str, action: str, comments: str, phone: str | None = None, deferred_date: str | None = None) -> dict:
    """Submit an admin-authorized reattempt or RTO action for a verified NDR AWB."""
    token = get_token()
    if not token:
        return _failure("Shiprocket authentication unavailable; no NDR action was submitted")
    if action not in {"re-attempt", "return"}:
        return _failure("Unsupported Shiprocket NDR action", 400)
    if not awb or not comments.strip():
        return _failure("A shipment AWB and action comment are required", 400)
    payload = {"action": action, "comments": comments.strip()[:500]}
    if phone:
        payload["phone"] = phone
    if deferred_date and action == "re-attempt":
        payload["deferred_date"] = deferred_date
    try:
        resp = requests.post(
            f"{API_BASE}/ndr/{requests.utils.quote(awb, safe='')}/action",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=20,
        )
        try:
            data = resp.json()
        except ValueError:
            data = {}
        if resp.status_code not in (200, 201):
            logger.warning("Shiprocket NDR action returned HTTP %s", resp.status_code)
            return _failure(str(data.get("message") or "Shiprocket rejected the NDR action"), resp.status_code)
        return {"status": resp.status_code, "data": data}
    except Exception as exc:
        logger.error("Shiprocket NDR action request failed: %s", type(exc).__name__)
        return _failure("Could not submit the Shiprocket NDR action")
