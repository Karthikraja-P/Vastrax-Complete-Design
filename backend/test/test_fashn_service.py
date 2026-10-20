import pytest

from app.core.config import settings
from app.services.fashn_service import run_fashn


def test_production_does_not_return_composite_when_fashn_is_unavailable(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "fashn_tryon_url", "")
    monkeypatch.setattr(settings, "fashn_venv", "/missing/fashn/python")
    monkeypatch.setattr(settings, "fashn_script", "/missing/fashn/inference.py")

    with pytest.raises(RuntimeError, match="temporarily unavailable"):
        run_fashn("/missing/person.jpg", "/missing/garment.webp")