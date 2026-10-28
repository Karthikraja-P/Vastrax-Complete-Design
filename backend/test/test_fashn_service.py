from pathlib import Path

import pytest

from app.core.config import settings
from app.services.fashn_service import run_fashn
from app.services.tryon_service import _normalize_two_piece_person_image


def test_two_piece_person_normalization_crops_square_to_portrait_and_preserves_full_height(tmp_path):
    from PIL import Image

    person = tmp_path / "square-person.png"
    Image.new("RGB", (576, 576), "white").save(person)

    _normalize_two_piece_person_image(str(person))

    with Image.open(person) as normalized:
        assert normalized.size == (432, 576)


def test_two_piece_person_normalization_leaves_portrait_photo_unchanged(tmp_path):
    from PIL import Image

    person = tmp_path / "portrait-person.png"
    Image.new("RGB", (576, 768), "white").save(person)

    _normalize_two_piece_person_image(str(person))

    with Image.open(person) as normalized:
        assert normalized.size == (576, 768)


def test_production_does_not_return_composite_when_fashn_is_unavailable(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "fashn_tryon_url", "")
    monkeypatch.setattr(settings, "fashn_venv", "/missing/fashn/python")
    monkeypatch.setattr(settings, "fashn_script", "/missing/fashn/inference.py")

    with pytest.raises(RuntimeError, match="temporarily unavailable"):
        run_fashn("/missing/person.jpg", "/missing/garment.webp")


@pytest.mark.parametrize(
    ("category", "override", "expected"),
    [("bottoms", None, "true"), ("tops", None, "false"), ("bottoms", False, "false")],
)
def test_bottoms_use_segmentation_free_by_default_but_allow_override(
    monkeypatch, tmp_path, category, override, expected
):
    import httpx

    captured = {}

    class Response:
        status_code = 200
        content = b"generated image"

        @staticmethod
        def json():
            return {"result_image_url": "/results/generated.png"}

    class Client:
        def __init__(self, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        @staticmethod
        def post(url, files, data, headers):
            captured["data"] = data
            return Response()

        @staticmethod
        def get(url):
            return Response()

    person = tmp_path / "person.jpg"
    garment = tmp_path / "garment.webp"
    person.write_bytes(b"person")
    garment.write_bytes(b"garment")
    monkeypatch.setattr(settings, "fashn_tryon_url", "http://gpu.test")
    monkeypatch.setenv("GENERATOR_3D_SECRET", "test-only")
    monkeypatch.setattr(httpx, "Client", Client)

    result = run_fashn(
        str(person),
        str(garment),
        garment_type=category,
        results_dir=str(tmp_path / "results"),
        garment_photo_type="flat-lay",
        segmentation_free=override,
        num_timesteps=50,
        guidance_scale=1.5,
    )

    assert captured["data"]["segmentation_free"] == expected
    assert captured["data"]["garment_photo_type"] == "flat-lay"
    assert captured["data"]["num_timesteps"] == "50"
    assert captured["data"]["guidance_scale"] == "1.5"
    assert Path(result).read_bytes() == Response.content
