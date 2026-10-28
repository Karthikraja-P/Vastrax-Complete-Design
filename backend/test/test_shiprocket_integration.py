import pytest

from app.services import shiprocket_service as shiprocket


def test_production_never_fabricates_rates_or_shipment(monkeypatch):
    monkeypatch.setattr(shiprocket, "_is_production", lambda: True)
    monkeypatch.setattr(shiprocket, "get_token", lambda: None)

    rates = shiprocket.check_serviceability("625001")
    shipment = shiprocket.create_shipment_order(
        "VX-2026-TEST", {"pincode": "625001"}, [{"name": "Dress", "unit_price": 1000, "quantity": 1}], 1000
    )
    awb = shiprocket.assign_awb("123456")
    tracking = shiprocket.track_shipment("123456")

    assert rates["status"] == 503 and rates.get("error")
    assert shipment["status"] == 503 and shipment.get("error")
    assert awb["status"] == 503 and awb.get("error")
    assert tracking["status"] == 503 and tracking.get("error")


def test_development_rates_are_marked_as_mock(monkeypatch):
    monkeypatch.setattr(shiprocket, "_is_production", lambda: False)
    monkeypatch.setattr(shiprocket, "get_token", lambda: None)

    result = shiprocket.check_serviceability("625001")
    quote = shiprocket.select_shipping_quote(result)

    assert result["mock"] is True
    assert quote["courier_id"] == 25
    assert quote["rate"] >= 0
    assert shiprocket.check_serviceability("10001")["status"] == 400


def test_awb_assigns_selected_courier_and_normalizes_provider_response(monkeypatch):
    class Response:
        status_code = 200
        def json(self):
            return {"response": {"data": {"awb_code": "AWB123", "courier_name": "Courier X"}}}

    captured = {}
    monkeypatch.setattr(shiprocket, "get_token", lambda: "token")
    monkeypatch.setattr(shiprocket, "_is_production", lambda: True)
    def fake_post(url, **kwargs):
        captured.update(url=url, **kwargs)
        return Response()
    monkeypatch.setattr(shiprocket.requests, "post", fake_post)

    result = shiprocket.assign_awb("12345", courier_id=25)

    assert captured["json"] == {"shipment_id": 12345, "courier_id": 25}
    assert result["awb_code"] == "AWB123"
    assert result["courier_name"] == "Courier X"


def test_manifest_uses_shiprocket_api_and_requires_provider_manifest_url(monkeypatch):
    class Response:
        status_code = 200
        def json(self):
            return {"status": 1, "manifest_url": "https://shiprocket.example/manifest.pdf"}

    captured = {}
    monkeypatch.setattr(shiprocket, "get_token", lambda: "token")
    monkeypatch.setattr(shiprocket.requests, "post", lambda url, **kwargs: (captured.update(url=url, **kwargs) or Response()))

    result = shiprocket.generate_manifest("12345")

    assert captured["url"].endswith("/manifests/generate")
    assert captured["json"] == {"shipment_id": [12345]}
    assert result["status"] == 1
    assert result["status_code"] == 200


def test_shipment_payload_uses_cod_and_items_subtotal(monkeypatch):
    class Response:
        status_code = 201
        def json(self):
            return {"order_id": 42, "shipment_id": 12345}

    captured = {}
    monkeypatch.setattr(shiprocket, "get_token", lambda: "token")
    monkeypatch.setattr(shiprocket.requests, "post", lambda url, **kwargs: (captured.update(url=url, **kwargs) or Response()))

    result = shiprocket.create_shipment_order(
        "VX-2026-ORDER",
        {"name": "Test Customer", "address": "12 Main Street", "city": "Madurai", "state": "Tamil Nadu", "pincode": "625001", "email": "test@example.com", "phone": "9876543210"},
        [{"name": "Pink Coord", "variant_id": "variant-1", "sku": "VTX-CS-PCS-PNK-S", "quantity": 2, "unit_price": 1000}],
        total_amount=2400,
        payment_method="COD",
        weight=1.0,
    )

    assert result["shipment_id"] == 12345
    assert captured["json"]["payment_method"] == "COD"
    assert captured["json"]["order_items"][0]["sku"] == "VTX-CS-PCS-PNK-S"
    assert captured["json"]["sub_total"] == 2000
    assert captured["json"]["billing_pincode"] == "625001"
    assert captured["json"]["weight"] == 1.0
