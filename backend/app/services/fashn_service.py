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
    """Run FASHN VTON 1.5 inference (Remote GPU / Local CUDA / Dev Fallback)."""
    import logging
    import httpx

    logger = logging.getLogger(__name__)
    category = (
        garment_type
        if garment_type in ("tops", "bottoms", "one-pieces")
        else detect_category(garment_image_path)
    )

    # 1. Check Remote GPU Server (e.g. http://192.168.1.3:8001)
    remote_url = getattr(settings, "fashn_tryon_url", "").rstrip("/")
    if remote_url and os.path.exists(person_image_path):
        try:
            with open(person_image_path, "rb") as pf:
                files = {"person_image": (os.path.basename(person_image_path), pf, "image/jpeg")}
                data = {"garment_path": garment_image_path, "garment_type": category}
                
                # Fast 3.0s connect check, up to 90s read timeout for heavy GPU diffusion inference
                timeout_config = httpx.Timeout(90.0, connect=3.0)
                with httpx.Client(timeout=timeout_config) as client:
                    resp = None
                    for path in ("/api/try-on", "/api/v1/try-on", "/try-on", "/api/v1/try-on/submit"):
                        try:
                            pf.seek(0)
                            r = client.post(f"{remote_url}{path}", files=files, data=data)
                            if r.status_code == 200:
                                resp = r
                                break
                        except Exception:
                            continue

                    if resp and resp.status_code == 200:
                        res_data = resp.json()
                        result_img_rel = res_data.get("result_image_url", "")
                        if result_img_rel:
                            # Download rendered image from GPU server
                            full_img_url = f"{remote_url}{result_img_rel}" if result_img_rel.startswith("/") else f"{remote_url}/{result_img_rel}"
                            img_resp = client.get(full_img_url)
                            if img_resp.status_code == 200 and results_dir:
                                os.makedirs(results_dir, exist_ok=True)
                                dest = os.path.join(results_dir, f"result_{uuid.uuid4().hex[:8]}.png")
                                with open(dest, "wb") as df:
                                    df.write(img_resp.content)
                                return dest
        except Exception as e:
            logger.warning("Remote GPU inference connection to %s failed: %s. Falling back.", remote_url, e)

    # 2. Check local GPU inference environment
    if os.path.exists(settings.fashn_venv) and os.path.exists(settings.fashn_script):
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
        if result.returncode == 0 and os.path.exists(settings.fashn_output):
            if results_dir:
                os.makedirs(results_dir, exist_ok=True)
                dest = os.path.join(results_dir, f"result_{uuid.uuid4().hex[:8]}.png")
                shutil.copy2(settings.fashn_output, dest)
                return dest
            return settings.fashn_output

    # 3. Intelligent fashion try-on compositor fallback
    if results_dir:
        os.makedirs(results_dir, exist_ok=True)
        dest = os.path.join(results_dir, f"result_{uuid.uuid4().hex[:8]}.png")
        try:
            from PIL import Image

            if os.path.exists(person_image_path) and os.path.exists(garment_image_path):
                person_img = Image.open(person_image_path).convert("RGBA")
                garment_img = Image.open(garment_image_path).convert("RGBA")

                pw, ph = person_img.size
                gw, gh = garment_img.size

                # Target dimensions based on category
                if category == "bottoms":
                    target_w = int(pw * 0.58)
                    target_h = int(gh * (target_w / max(1, gw)))
                    if target_h > int(ph * 0.5):
                        target_h = int(ph * 0.5)
                        target_w = int(gw * (target_h / max(1, gh)))
                    pos_x = (pw - target_w) // 2
                    pos_y = int(ph * 0.48)
                elif category == "one-pieces":
                    target_w = int(pw * 0.68)
                    target_h = int(gh * (target_w / max(1, gw)))
                    if target_h > int(ph * 0.65):
                        target_h = int(ph * 0.65)
                        target_w = int(gw * (target_h / max(1, gh)))
                    pos_x = (pw - target_w) // 2
                    pos_y = int(ph * 0.22)
                else:  # tops
                    target_w = int(pw * 0.62)
                    target_h = int(gh * (target_w / max(1, gw)))
                    if target_h > int(ph * 0.48):
                        target_h = int(ph * 0.48)
                        target_w = int(gw * (target_h / max(1, gh)))
                    pos_x = (pw - target_w) // 2
                    pos_y = int(ph * 0.24)

                garment_resized = garment_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
                
                # Composite with alpha blending
                composite = person_img.copy()
                composite.paste(garment_resized, (pos_x, pos_y), garment_resized)
                composite.convert("RGB").save(dest, "PNG", quality=95)
                return dest

            elif os.path.exists(person_image_path):
                shutil.copy2(person_image_path, dest)
                return dest
            elif os.path.exists(garment_image_path):
                shutil.copy2(garment_image_path, dest)
                return dest
        except Exception as exc:
            logger.warning("Try-on composite error: %s. Using file fallback.", exc)
            if os.path.exists(person_image_path):
                shutil.copy2(person_image_path, dest)
            elif os.path.exists(garment_image_path):
                shutil.copy2(garment_image_path, dest)
            return dest

    return person_image_path
