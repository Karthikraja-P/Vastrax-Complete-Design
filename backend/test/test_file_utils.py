from app.core.config import settings
from app.utils.file_utils import resolve_garment


def test_resolve_garment_static_upload_url(monkeypatch, tmp_path):
    image = tmp_path / "products" / "garment.webp"
    image.parent.mkdir()
    image.write_bytes(b"webp")
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))

    resolved, is_temporary = resolve_garment("/user_uploads/products/garment.webp")

    assert resolved == str(image)
    assert not is_temporary


def test_resolve_garment_upload_url_with_windows_separators(monkeypatch, tmp_path):
    image = tmp_path / "products" / "garment.webp"
    image.parent.mkdir()
    image.write_bytes(b"webp")
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))

    resolved, is_temporary = resolve_garment(r"\user_uploads\products\garment.webp")

    assert resolved == str(image)
    assert not is_temporary