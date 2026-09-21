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
    if not garment_path or garment_path.startswith("data:image"):
        return "tops"

    path = garment_path.lower()
    if any(w in path for w in [
        "frock", "dress", "gown", "lehenga", "bodycon", "body_con", "body-con",
        "floral", "textured", "midi", "maxi", "jumpsuit", "overall", "one-piece",
    ]):
        return "one-pieces"
    if any(w in path for w in [
        "pant", "jean", "denim", "skirt", "trouser", "flared",
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
    cat_str = str(garment_type or "").lower()
    if cat_str in ("dresses", "one-pieces", "dress", "frock", "gown", "lehenga"):
        category = "one-pieces"
    elif cat_str in ("bottoms", "pants", "bottom", "skirt", "trouser", "shorts", "jeans"):
        category = "bottoms"
    elif cat_str in ("tops", "top", "shirt", "hoodie", "jacket"):
        category = "tops"
    else:
        category = detect_category(garment_image_path)

    # 1. Check Remote GPU Server (e.g. http://192.168.1.3:8001)
    remote_url = getattr(settings, "fashn_tryon_url", "").rstrip("/")
    if remote_url and os.path.exists(person_image_path):
        try:
            has_garment_file = os.path.exists(garment_image_path)
            with open(person_image_path, "rb") as pf:
                files = {"person_image": (os.path.basename(person_image_path), pf, "image/jpeg")}
                data = {"garment_path": garment_image_path, "garment_type": category}

                gf = open(garment_image_path, "rb") if has_garment_file else None
                try:
                    if gf:
                        files["garment_image"] = (os.path.basename(garment_image_path), gf, "image/jpeg")

                    timeout_config = httpx.Timeout(120.0, connect=5.0)
                    with httpx.Client(timeout=timeout_config) as client:
                        resp = None
                        for path in ("/try-on", "/api/try-on", "/api/v1/try-on"):
                            try:
                                pf.seek(0)
                                if gf:
                                    gf.seek(0)
                                r = client.post(f"{remote_url}{path}", files=files, data=data)
                                if r.status_code == 200:
                                    resp = r
                                    break
                            except Exception as err:
                                logger.debug("GPU endpoint %s failed: %s", path, err)
                                continue

                        if resp and resp.status_code == 200:
                            res_data = resp.json()
                            result_img_rel = res_data.get("result_image_url", "")
                            if result_img_rel:
                                filename = os.path.basename(result_img_rel)
                                out_dir = results_dir or settings.results_dir
                                local_dest = os.path.join(out_dir, filename)
                                if os.path.exists(local_dest) and os.path.getsize(local_dest) > 0:
                                    return local_dest

                                full_img_url = f"{remote_url}{result_img_rel}" if result_img_rel.startswith("/") else f"{remote_url}/{result_img_rel}"
                                img_resp = client.get(full_img_url)
                                if img_resp.status_code == 200:
                                    os.makedirs(out_dir, exist_ok=True)
                                    with open(local_dest, "wb") as df:
                                        df.write(img_resp.content)
                                    return local_dest
                finally:
                    if gf:
                        gf.close()
        except Exception as e:
            logger.error("Remote GPU inference connection to %s failed: %s", remote_url, e)
            raise RuntimeError(f"GPU virtual try-on inference failed: {e}")

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
        else:
            err_msg = result.stderr[-400:] if result.stderr else f"Exit code {result.returncode}"
            logger.warning("FASHN AI GPU execution failed: %s. Falling back to visual compositing.", err_msg)
    else:
        logger.info("FASHN AI GPU environment not found at %s. Utilizing visual compositing fallback.", settings.fashn_venv)

    # 3. Fallback visual composition preview
    return _render_fallback_composite(person_image_path, garment_image_path, results_dir)


def _render_fallback_composite(
    person_image_path: str,
    garment_image_path: str,
    results_dir: str | None = None,
) -> str:
    """Seamlessly drape garment onto person as a single high-quality virtual try-on result image."""
    import logging
    from PIL import Image

    logger = logging.getLogger(__name__)
    out_dir = results_dir or settings.results_dir
    os.makedirs(out_dir, exist_ok=True)
    dest = os.path.join(out_dir, f"result_{uuid.uuid4().hex[:8]}.png")

    try:
        has_person = os.path.exists(person_image_path)
        has_garment = os.path.exists(garment_image_path)

        if has_person:
            person_img = Image.open(person_image_path).convert("RGBA")
        else:
            person_img = Image.new("RGBA", (800, 1000), (245, 245, 247, 255))

        pw, ph = person_img.size

        if has_garment:
            garment_img = Image.open(garment_image_path).convert("RGBA")
            gw, gh = garment_img.size

            # Create transparent cutout if garment has solid white/studio background
            g_data = list(garment_img.getdata())
            new_g = []
            for r, g, b, a in g_data:
                # Key out light studio background pixels (>215 RGB)
                if r > 215 and g > 215 and b > 215:
                    new_g.append((255, 255, 255, 0))
                else:
                    new_g.append((r, g, b, a))
            garment_img.putdata(new_g)

            # Scale garment to torso proportions (~60% of person width)
            target_w = int(pw * 0.60)
            target_h = int(gh * (target_w / float(gw)))

            if target_h > int(ph * 0.72):
                target_h = int(ph * 0.72)
                target_w = int(gw * (target_h / float(gh)))

            garment_resized = garment_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
            pos_x = (pw - target_w) // 2
            pos_y = int(ph * 0.20)

            composite = person_img.copy()
            composite.paste(garment_resized, (pos_x, pos_y), garment_resized)
            composite.convert("RGB").save(dest, "PNG")
            return dest

        raise RuntimeError("Garment image missing or invalid for try-on composition")
    except Exception as exc:
        logger.warning("Single-image garment drape rendering failed: %s.", exc)

    # If compositing failed, raise exception so pipeline does not deceive customer with raw photo
    raise RuntimeError(f"Virtual try-on drape rendering failed: {exc}")



