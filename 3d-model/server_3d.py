import os
import sys
import uuid
import shutil
import asyncio
import logging
import struct
import json
import io
import secrets
import signal
import subprocess
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("3d_garment_generator")

app = FastAPI(title="VASTRAX 3D Garment Generator", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "public", "models", "3d"))
UPLOADS_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "backend", "user_uploads"))

os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Mount models directory as static
app.mount("/models/3d", StaticFiles(directory=MODELS_DIR), name="models_3d")

lock = asyncio.Lock()


def hunyuan_hosts() -> list[str]:
    """Find the Windows host from WSL without relying on a changing IP address."""
    hosts = [os.environ.get("HUNYUAN_API_URL", "").rstrip("/"), "http://127.0.0.1:8082", "http://host.docker.internal:8082"]
    try:
        with open("/proc/net/route", encoding="ascii") as routes:
            next(routes)
            for route in routes:
                fields = route.split()
                if fields[1] == "00000000":
                    gateway = struct.pack("<L", int(fields[2], 16))
                    hosts.append(f"http://{'.'.join(str(octet) for octet in gateway)}:8082")
                    break
    except (OSError, ValueError, IndexError, StopIteration):
        pass
    return list(dict.fromkeys(host for host in hosts if host))


FASHN_DIR = os.environ.get("FASHN_SERVICE_DIR", "/home/pkr/fashn-tryon")


def pause_fashn() -> bool:
    """Free GPU memory for Hunyuan after verifying the listener is FASHN."""
    output = subprocess.check_output(["lsof", "-t", "-iTCP:8001", "-sTCP:LISTEN"], text=True)
    pids = [int(value) for value in output.split()]
    if not pids:
        return False
    for pid in pids:
        command = open(f"/proc/{pid}/cmdline", "rb").read()
        if os.path.join(FASHN_DIR, "server.py").encode() not in command:
            raise RuntimeError("Port 8001 is not owned by the expected FASHN service")
    for pid in pids:
        os.kill(pid, signal.SIGTERM)
    return True


async def resume_fashn() -> None:
    """Restore virtual try-on after the 3D request releases the GPU."""
    import httpx

    python = os.path.join(FASHN_DIR, "venv", "bin", "python")
    server = os.path.join(FASHN_DIR, "server.py")
    with open(os.path.join(FASHN_DIR, "server.log"), "ab") as output:
        subprocess.Popen([python, server], stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
    async with httpx.AsyncClient(timeout=2.0) as client:
        for _ in range(30):
            try:
                response = await client.get("http://127.0.0.1:8001/health")
                if response.status_code == 200 and response.json().get("model_loaded"):
                    return
            except (httpx.RequestError, ValueError):
                pass
            await asyncio.sleep(1)
    logger.error("FASHN did not become healthy after 3D generation")


def bake_garment_texture_atlas(front_path: str, back_path: str = None, side_path: str = None, is_dress: bool = False) -> bytes:
    """
    Composites uploaded multi-view photos (front, back, side) into a high-res 2048x1024
    PBR diffuse texture atlas aligned with 3D mesh UV coordinates.
    """
    from PIL import Image, ImageOps, ImageChops

    front = Image.open(front_path).convert("RGBA")
    atlas_w, atlas_h = 2048, 1024
    quad_w, quad_h = 1024, 1024

    def auto_crop(img: Image.Image) -> Image.Image:
        try:
            corner_pixel = img.getpixel((0, 0))
            bg = Image.new(img.mode, img.size, corner_pixel)
            diff = ImageChops.difference(img, bg)
            bbox = diff.getbbox()
            if bbox:
                bw = bbox[2] - bbox[0]
                bh = bbox[3] - bbox[1]
                if bw > 100 and bh > 100:
                    return img.crop(bbox)
        except Exception:
            pass
        return img

    front = auto_crop(front)
    fw, fh = front.size

    # Sample garment primary color
    cx1, cy1 = int(fw * 0.35), int(fh * 0.35)
    cx2, cy2 = max(cx1 + 1, int(fw * 0.65)), max(cy1 + 1, int(fh * 0.65))
    center_sample = front.crop((cx1, cy1, cx2, cy2)).convert("RGB")
    stat = center_sample.resize((1, 1), Image.Resampling.LANCZOS)
    primary_color = stat.getpixel((0, 0))

    canvas = Image.new("RGBA", (atlas_w, atlas_h), (*primary_color, 255))

    def fit_quadrant(img: Image.Image, full_bleed: bool = False) -> Image.Image:
        iw, ih = img.size
        if full_bleed:
            # Full bleed coverage for dresses/gowns
            ratio = max(quad_w / iw, quad_h / ih)
            rw, rh = max(1, int(iw * ratio)), max(1, int(ih * ratio))
            resized = img.resize((rw, rh), Image.Resampling.LANCZOS)
            quad = Image.new("RGBA", (quad_w, quad_h), (*primary_color, 255))
            px = (quad_w - rw) // 2
            py = (quad_h - rh) // 2
            quad.paste(resized, (px, py), resized if resized.mode == "RGBA" else None)
            return quad
        else:
            target_w, target_h = 1000, 1000
            ratio = min(target_w / iw, target_h / ih)
            rw, rh = max(1, int(iw * ratio)), max(1, int(ih * ratio))
            resized = img.resize((rw, rh), Image.Resampling.LANCZOS)
            quad = Image.new("RGBA", (quad_w, quad_h), (*primary_color, 255))
            px = (quad_w - rw) // 2
            py = (quad_h - rh) // 2
            quad.paste(resized, (px, py), resized if resized.mode == "RGBA" else None)
            return quad

    # Front view on Left quadrant (0..1024)
    front_quad = fit_quadrant(front, full_bleed=is_dress)
    canvas.paste(front_quad, (0, 0))

    # Back view on Right quadrant (1024..2048)
    if back_path and os.path.exists(back_path):
        back = auto_crop(Image.open(back_path).convert("RGBA"))
        back_quad = fit_quadrant(back, full_bleed=is_dress)
    else:
        back_quad = ImageOps.mirror(front_quad)
    canvas.paste(back_quad, (quad_w, 0))

    # Side view accents if provided
    if side_path and os.path.exists(side_path):
        side = auto_crop(Image.open(side_path).convert("RGBA"))
        side_strip = side.resize((60, quad_h), Image.Resampling.LANCZOS)
        canvas.paste(side_strip, (0, 0), side_strip if side_strip.mode == "RGBA" else None)
        canvas.paste(side_strip, (quad_w - 60, 0), side_strip if side_strip.mode == "RGBA" else None)
        canvas.paste(side_strip, (quad_w, 0), side_strip if side_strip.mode == "RGBA" else None)
        canvas.paste(side_strip, (atlas_w - 60, 0), side_strip if side_strip.mode == "RGBA" else None)

    buf = io.BytesIO()
    canvas.convert("RGB").save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def replace_glb_texture(input_glb_path: str, output_glb_path: str, new_image_bytes: bytes, image_index: int = 0) -> None:
    """
    Directly injects the baked texture into a GLB file, maintaining 100% glTF 2.0 binary conformance.
    """
    with open(input_glb_path, "rb") as f:
        data = f.read()

    magic, version, total_len = struct.unpack("<4sII", data[:12])
    if magic != b"glTF":
        raise ValueError("Invalid GLB binary header")

    chunk0_len, _ = struct.unpack("<II", data[12:20])
    json_bytes = data[20:20 + chunk0_len]
    gltf = json.loads(json_bytes.decode("utf-8"))

    bin_header_offset = 20 + chunk0_len
    chunk1_len, _ = struct.unpack("<II", data[bin_header_offset : bin_header_offset + 8])
    bin_data_offset = bin_header_offset + 8
    bin_data = bytearray(data[bin_data_offset : bin_data_offset + chunk1_len])

    target_img = gltf["images"][image_index]
    bv_idx = target_img["bufferView"]
    bv = gltf["bufferViews"][bv_idx]

    old_offset = bv.get("byteOffset", 0)
    old_length = bv["byteLength"]

    # Align new image to 4 bytes
    pad_len = (4 - (len(new_image_bytes) % 4)) % 4
    new_padded_image = new_image_bytes + (b"\x00" * pad_len)
    new_len = len(new_image_bytes)
    delta = len(new_padded_image) - (old_length + ((4 - (old_length % 4)) % 4))

    new_bin = bytearray()
    new_bin.extend(bin_data[:old_offset])
    new_bin.extend(new_padded_image)
    new_bin.extend(bin_data[old_offset + old_length + ((4 - (old_length % 4)) % 4):])

    bv["byteLength"] = new_len
    for i, other_bv in enumerate(gltf["bufferViews"]):
        if i != bv_idx and other_bv.get("byteOffset", 0) > old_offset:
            other_bv["byteOffset"] += delta

    if "buffers" in gltf and len(gltf["buffers"]) > 0:
        gltf["buffers"][0]["byteLength"] = len(new_bin)

    new_json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_pad = (4 - (len(new_json_bytes) % 4)) % 4
    new_json_bytes += b" " * json_pad
    new_chunk0_len = len(new_json_bytes)

    bin_pad = (4 - (len(new_bin) % 4)) % 4
    new_bin += b"\x00" * bin_pad
    new_chunk1_len = len(new_bin)

    new_total_len = 12 + 8 + new_chunk0_len + 8 + new_chunk1_len
    header = struct.pack("<4sII", b"glTF", 2, new_total_len)
    chunk0_header = struct.pack("<II", new_chunk0_len, 0x4E4F534A)
    chunk1_header = struct.pack("<II", new_chunk1_len, 0x004E4942)

    with open(output_glb_path, "wb") as out_f:
        out_f.write(header)
        out_f.write(chunk0_header)
        out_f.write(new_json_bytes)
        out_f.write(chunk1_header)
        out_f.write(new_bin)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "3d_garment_generator",
        "port": 8081,
        "models_dir": MODELS_DIR,
    }


@app.post("/generate")
@app.post("/api/v1/3d/generate")
async def generate_3d(
    product_id: str = Form(None),
    category_id: str = Form(None),
    product_name: str = Form(None),
    front_image: UploadFile = File(...),
    side_image: UploadFile = File(None),
    back_image: UploadFile = File(None),
    x_generator_key: str | None = Header(None),
):
    """
    Accepts multi-view 2D garment photos (front, side, back)
    and produces a tailored, custom-textured .glb 3D mesh matching the uploaded garment.
    """
    import httpx
    import base64

    expected_key = os.environ.get("GENERATOR_3D_SECRET", "")
    if not expected_key:
        raise HTTPException(status_code=503, detail="Generator key is not configured")
    if not x_generator_key or not secrets.compare_digest(x_generator_key, expected_key):
        raise HTTPException(status_code=403, detail="Forbidden")

    job_id = f"vtx_3d_{uuid.uuid4().hex[:8]}"
    out_filename = f"{job_id}.glb"
    dest_path = os.path.join(MODELS_DIR, out_filename)

    async with lock:
        try:
            # 1. Save uploaded photos
            front_ext = os.path.splitext(front_image.filename or "front.jpg")[1] or ".jpg"
            front_path = os.path.join(UPLOADS_DIR, f"{job_id}_front{front_ext}")
            with open(front_path, "wb") as f:
                f.write(await front_image.read())

            side_path = None
            if side_image:
                side_ext = os.path.splitext(side_image.filename or "side.jpg")[1] or ".jpg"
                side_path = os.path.join(UPLOADS_DIR, f"{job_id}_side{side_ext}")
                with open(side_path, "wb") as f:
                    f.write(await side_image.read())

            back_path = None
            if back_image:
                back_ext = os.path.splitext(back_image.filename or "back.jpg")[1] or ".jpg"
                back_path = os.path.join(UPLOADS_DIR, f"{job_id}_back{back_ext}")
                with open(back_path, "wb") as f:
                    f.write(await back_image.read())

            logger.info(f"[{job_id}] Received photos for 3D reconstruction (category: {category_id}, name: {product_name}).")

            # 2. Check for active Hunyuan3D neural service on port 8082
            generated = False
            try:
                async with httpx.AsyncClient(timeout=1200.0) as hy_client:
                    with open(front_path, "rb") as f_in:
                        b64_str = base64.b64encode(f_in.read()).decode("utf-8")
                    payload = {
                        "image": b64_str,
                        "texture": os.environ.get("HUNYUAN_TEXTURE", "true").lower() == "true",
                        "type": "glb"
                    }
                    hy_host = None
                    for candidate in hunyuan_hosts():
                        try:
                            ready = await hy_client.get(f"{candidate}/health", timeout=3.0)
                            if ready.status_code == 200 and ready.json().get("status") == "healthy":
                                hy_host = candidate
                                break
                        except Exception:
                            continue

                    hy_res = None
                    if hy_host:
                        fashn_paused = False
                        try:
                            try:
                                fashn_health = await hy_client.get("http://127.0.0.1:8001/health", timeout=2.0)
                                if fashn_health.status_code == 200 and fashn_health.json().get("model_loaded"):
                                    fashn_paused = pause_fashn()
                                    if not fashn_paused:
                                        raise RuntimeError("FASHN could not be paused for 3D generation")
                                    await asyncio.sleep(2)
                            except httpx.RequestError:
                                pass
                            hy_res = await hy_client.post(
                                f"{hy_host}/generate",
                                json=payload,
                                headers={"X-Generator-Key": expected_key},
                            )
                        finally:
                            if fashn_paused:
                                await resume_fashn()

                    if hy_res and hy_res.status_code == 200:
                        generation_mode = hy_res.headers.get("X-Generation-Mode", "hunyuan_untextured")
                        if generation_mode == "hunyuan_textured" and hy_res.content.startswith(b"glTF"):
                            with open(dest_path, "wb") as out_f:
                                out_f.write(hy_res.content)
                            generated = True
                            logger.info(f"[{job_id}] Hunyuan3D GPU service generated textured mesh: {dest_path}")
                        else:
                            generation_mode = "unverified"
                            logger.warning(f"[{job_id}] Hunyuan3D returned an untextured or invalid model; refusing to attach it")
            except Exception as hy_err:
                logger.info(f"[{job_id}] Hunyuan3D 8082 unavailable ({hy_err}); generic templates are disabled.")

            # Never return a generic template as a successful reconstruction: it can
            # look like a different garment and then be permanently attached to a product.
            if not generated or not os.path.isfile(dest_path) or os.path.getsize(dest_path) < 20:
                logger.error(f"[{job_id}] Neural reconstruction unavailable; refusing generic garment fallback")
                raise HTTPException(
                    status_code=503,
                    detail="3D garment reconstruction is temporarily unavailable. No model was attached; please retry later.",
                )

            return {
                "status": "success",
                "job_id": job_id,
                "model_url": f"/models/3d/{out_filename}",
                "filename": out_filename,
                "generation_mode": generation_mode,
                "message": "Hunyuan neural garment reconstruction generated"
            }
        except HTTPException:
            raise
        except Exception as err:
            logger.error(f"[{job_id}] 3D reconstruction failed: {err}")
            raise HTTPException(status_code=500, detail=str(err))


if __name__ == "__main__":
    port = int(os.environ.get("PORT_3D", 8081))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
