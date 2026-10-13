from app.services import shiprocket_service as service


def test_production_serviceability_does_not_invent_carriers(monkeypatch):
    monkeypatch.setattr(service, "_get_credentials", lambda: ("", "", "625706"))
    monkeypatch.setattr(service, "get_token", lambda: None)
    monkeypatch.setattr(service, "_mock_shipping_enabled", lambda: False)

    result = service.check_serviceability("600001")

    assert result["status"] == 503
    assert "could not be verified" in result["message"]


def test_production_does_not_create_fake_shipments(monkeypatch):
    monkeypatch.setattr(service, "_get_credentials", lambda: ("", "", "625706"))
    monkeypatch.setattr(service, "get_token", lambda: None)
    monkeypatch.setattr(service, "_mock_shipping_enabled", lambda: False)

    assert service.create_shipment_order("order-1", {}, [], 100) is None
    assert service.create_return_shipment("order-1", {})["status"] == 503


def test_production_tracking_and_fulfilment_actions_fail_closed(monkeypatch):
    monkeypatch.setattr(service, "get_token", lambda: None)
    monkeypatch.setattr(service, "_mock_shipping_enabled", lambda: False)

    assert service.track_shipment("MOCK-123")["status"] == 503
    assert service.generate_label("MOCK-123")["status"] == 503
    assert service.schedule_pickup("MOCK-123", "2026-10-15")["status"] == 503
    assert service.cancel_shipment_by_awb("MOCK-SR123")["status"] == 503
