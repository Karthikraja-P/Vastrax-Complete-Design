from io import BytesIO
from pathlib import Path
import uuid

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.core.config import settings
from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.main import app
from app.models.user import User


@pytest.fixture
def client():
    return TestClient(app)


def _png_bytes():
    buffer = BytesIO()
    Image.new("RGB", (64, 96), (224, 128, 168)).save(buffer, format="PNG")
    return buffer.getvalue()


def _admin_headers():
    db = SessionLocal()
    user = User(email=f"admin-tryon-{uuid.uuid4().hex}@example.test", hashed_password="unused", role="admin", is_active=True)
    db.add(user)
    db.commit()
    token = create_access_token({"sub": user.id})
    db.close()
    return {"Authorization": f"Bearer {token}"}


def test_admin_model_library_exposes_three_neutral_model_templates(client):
    response = client.get("/api/v1/try-on/admin-models")
    assert response.status_code == 200
    models = response.json()
    assert [model["id"] for model in models] == ["aanya", "meera", "kavya"]
    for model in models:
        image = client.get(model["image_url"])
        assert image.status_code == 200
        assert image.headers["content-type"].startswith("image/webp")


def test_admin_preview_requires_admin(client):
    response = client.post(
        "/api/v1/try-on/admin-preview",
        data={"model_id": "aanya", "garment_type": "tops"},
        files={"garment_image": ("garment.png", _png_bytes(), "image/png")},
    )
    assert response.status_code == 401


def test_admin_preview_runs_model_and_returns_gallery_usable_url(client, monkeypatch, tmp_path):
    upload_dir = tmp_path / "uploads"
    results_dir = tmp_path / "results"
    monkeypatch.setattr(settings, "upload_dir", str(upload_dir))
    monkeypatch.setattr(settings, "results_dir", str(results_dir))

    def fake_run_fashn(person_image_path, garment_image_path, garment_type, results_dir):
        assert Path(person_image_path).is_file()
        assert Path(garment_image_path).is_file()
        assert garment_type == "tops"
        result = Path(results_dir) / "generated.webp"
        result.parent.mkdir(parents=True, exist_ok=True)
        result.write_bytes(b"test-image")
        return str(result)

    monkeypatch.setattr("app.services.fashn_service.run_fashn", fake_run_fashn)
    response = client.post(
        "/api/v1/try-on/admin-preview",
        headers=_admin_headers(),
        data={"model_id": "aanya", "garment_type": "tops"},
        files={"garment_image": ("garment.png", _png_bytes(), "image/png")},
    )
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("image/png")
    assert response.content == b"test-image"
    assert list(upload_dir.iterdir()) == []
    assert list(results_dir.iterdir()) == []
