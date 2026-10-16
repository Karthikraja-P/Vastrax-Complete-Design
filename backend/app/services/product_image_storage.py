"""Store uploaded product images as compact static files instead of embedding them in API JSON."""
from __future__ import annotations
import base64, hashlib, os, re
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageOps
from app.core.config import settings
from app.core.exceptions import BadRequestError

_DATA_IMAGE_RE = re.compile(r"^data:image/(png|jpeg|jpg|webp);base64,", re.IGNORECASE)
_MAX_INPUT_BYTES = 15 * 1024 * 1024
_MAX_EDGE = 1600

def store_product_image(value: str) -> str:
    """Convert base64 image data URLs into cached optimized WebP files."""
    if not value or not value.startswith("data:"):
        return value
    match = _DATA_IMAGE_RE.match(value)
    if not match:
        raise BadRequestError("Product images must be PNG, JPEG, or WebP files.")
    encoded = value[match.end():]
    if len(encoded) > ((_MAX_INPUT_BYTES * 4 // 3) + 8):
        raise BadRequestError("Product image is too large. Please use an image under 15 MB.")
    try:
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) > _MAX_INPUT_BYTES:
            raise BadRequestError("Product image is too large. Please use an image under 15 MB.")
        with Image.open(BytesIO(raw)) as source:
            image = ImageOps.exif_transpose(source)
            image.thumbnail((_MAX_EDGE, _MAX_EDGE), Image.Resampling.LANCZOS)
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
            output = BytesIO()
            image.save(output, format="WEBP", quality=82, method=5)
            optimized = output.getvalue()
    except BadRequestError:
        raise
    except Exception as exc:
        raise BadRequestError("The uploaded product image could not be processed.") from exc
    digest = hashlib.sha256(optimized).hexdigest()
    relative = Path("products") / f"{digest}.webp"
    destination = Path(settings.upload_dir) / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        temporary = destination.with_suffix(".webp.tmp")
        temporary.write_bytes(optimized)
        os.replace(temporary, destination)
    return f"/user_uploads/{relative.as_posix()}"
