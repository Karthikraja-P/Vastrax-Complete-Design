import os
import shutil
import subprocess
import uuid

from app.core.config import settings


def detect_category(garment_path: str) -> str:
    """
    Auto-detect FASHN category from garment filename or URL.
    Categories: one-pieces | bottoms | tops
    """
    path = garment_path.lower()
    if any(w in path for w in [
        "frock", "dress", "gown", "lehenga", "bodycon", "body_con", "body-con",
        "floral", "textured", "midi", "maxi", "jumpsuit", "overall",
    ]):
        return "one-pieces"
    if any(w in path for w in [
        "pant", "jean", "denim", "skirt", "trouser", "flared", "beige",
        "shorts", "palazzo", "culottes", "legging", "bottom",
    ]):
        return "bottoms"
    return "tops"


def run_fashn(
    person_image_path: str,
    garment_image_path: str,
    garment_type: str | None = None,
    results_dir: str | None = None,
) -> str:
    """Run FASHN VTON 1.5 inference. Returns local path to result image."""
    category = (
        garment_type
        if garment_type in ("tops", "bottoms", "one-pieces")
        else detect_category(garment_image_path)
    )
    cmd = [
        settings.fashn_venv,
        settings.fashn_script,
        "--weights-dir", settings.fashn_weights,
        "--person-image", person_image_path,
        "--garment-image", garment_image_path,
        "--category", category,
        "--output-dir", settings.fashn_results,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"FASHN inference error: {result.stderr[-800:]}")
    if not os.path.exists(settings.fashn_output):
        raise RuntimeError("FASHN did not produce an output image")
    if results_dir:
        os.makedirs(results_dir, exist_ok=True)
        dest = os.path.join(results_dir, f"result_{uuid.uuid4().hex[:8]}.png")
        shutil.copy2(settings.fashn_output, dest)
        return dest
    return settings.fashn_output
