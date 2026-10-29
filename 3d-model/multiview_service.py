from __future__ import annotations

import argparse
import base64
import importlib
import io
import logging
import os
import secrets
import sys
import time
import types
import uuid
from pathlib import Path
from typing import Any

import torch
import trimesh
import uvicorn
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from PIL import Image

ROOT = Path(__file__).resolve().parent
MODEL_ROOT = ROOT / "Hunyuan3D-2.1"
for path in (MODEL_ROOT, MODEL_ROOT / "hy3dshape", MODEL_ROOT / "hy3dpaint"):
    sys.path.insert(0, str(path))

from hy3dshape import pipelines as shape_pipelines
from hy3dshape import Hunyuan3DDiTFlowMatchingPipeline
from hy3dshape.pipelines import export_to_trimesh
from hy3dshape.rembg import BackgroundRemover

# BasicSR bundled with Hunyuan Paint imports a torchvision helper removed in newer releases.
# Preserve its expected API using the supported functional implementation.
try:
    from torchvision.transforms import functional as _tv_functional
    _functional_tensor = types.ModuleType("torchvision.transforms.functional_tensor")
    _functional_tensor.rgb_to_grayscale = _tv_functional.rgb_to_grayscale
    sys.modules.setdefault("torchvision.transforms.functional_tensor", _functional_tensor)
except ImportError:
    pass

import textureGenPipeline as paint_module
from textureGenPipeline import Hunyuan3DPaintConfig, Hunyuan3DPaintPipeline
from hy3dpaint.convert_utils import create_glb_with_pbr_materials

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("vastrax_multiview_3d")

# Hunyuan3D-2mv ships config targets under the original hy3dgen namespace.
_TARGET_ALIASES = {
    "hy3dgen.shapegen.models.Hunyuan3DDiT": "hy3dshape.models.denoisers.hunyuan3ddit.Hunyuan3DDiT",
    "hy3dgen.shapegen.models.ShapeVAE": "hy3dshape.models.autoencoders.model.ShapeVAE",
    "hy3dgen.shapegen.models.SingleImageEncoder": "hy3dshape.models.conditioner.SingleImageEncoder",
    "hy3dgen.shapegen.schedulers.FlowMatchEulerDiscreteScheduler": "hy3dshape.schedulers.FlowMatchEulerDiscreteScheduler",
    "hy3dgen.shapegen.schedulers.ConsistencyFlowMatchEulerDiscreteScheduler": "hy3dshape.schedulers.ConsistencyFlowMatchEulerDiscreteScheduler",
    "hy3dgen.shapegen.preprocessors.MVImageProcessorV2": "hy3dshape.preprocessors.MVImageProcessorV2",
}
_original_get_obj = shape_pipelines.get_obj_from_str

def _resolve_model_target(target: str, reload: bool = False):
    target = _TARGET_ALIASES.get(target, target)
    return _original_get_obj(target, reload=reload)

shape_pipelines.get_obj_from_str = _resolve_model_target

# Fetch only the selected fp16 checkpoint rather than both 5 GB weight formats.
def _load_selected_mv_checkpoint(model_path, subfolder, use_safetensors, variant):
    base_dir = os.environ.get("HY3DGEN_MODELS", "~/.cache/hy3dgen")
    model_dir = Path(os.path.expanduser(os.path.join(base_dir, model_path)))
    weights_name = f"model{'.' + variant if variant else ''}.{'safetensors' if use_safetensors else 'ckpt'}"
    target_dir = model_dir / subfolder
    config_path = target_dir / "config.yaml"
    weights_path = target_dir / weights_name
    if not (config_path.is_file() and weights_path.is_file()):
        from huggingface_hub import snapshot_download
        snapshot_download(
            repo_id=model_path,
            allow_patterns=[f"{subfolder}/config.yaml", f"{subfolder}/{weights_name}"],
            local_dir=str(model_dir),
        )
    if not (config_path.is_file() and weights_path.is_file()):
        raise FileNotFoundError(f"Multi-view checkpoint files are incomplete under {target_dir}")
    return str(config_path), str(weights_path)

shape_pipelines.smart_load_model = _load_selected_mv_checkpoint
_original_prepare_image = Hunyuan3DDiTFlowMatchingPipeline.prepare_image

def _multiview_prepare_image(self, image, mask=None):
    if isinstance(image, dict):
        if not getattr(self.image_processor, "return_view_idx", False):
            raise RuntimeError("The loaded shape model is not configured for multi-view input")
        # MVImageProcessorV2 returns a flat tuple, but DinoImageEncoderMV expects one index list per batch element.
        prepared = self.image_processor(image)
        prepared["view_idxs"] = [tuple(prepared["view_idxs"])]
        return prepared
    return _original_prepare_image(self, image, mask)

Hunyuan3DDiTFlowMatchingPipeline.prepare_image = _multiview_prepare_image


def _texture_with_view_references(paint: Hunyuan3DPaintPipeline, mesh_path: str,
                                  images: list[Image.Image], output_obj: str) -> str:
    """Use the front, side and back photos as texture references, not just the front."""
    if not images:
        raise ValueError("At least one texture reference is required")
    path = os.path.dirname(mesh_path)
    processed_mesh_path = os.path.join(path, "white_mesh_remesh.obj")
    paint_module.remesh_mesh(mesh_path, processed_mesh_path)
    mesh = trimesh.load(processed_mesh_path)
    mesh = paint_module.mesh_uv_wrap(mesh)
    paint.render.load_mesh(mesh=mesh)
    selected_elevs, selected_azims, selected_weights = paint.view_processor.bake_view_selection(
        paint.config.candidate_camera_elevs, paint.config.candidate_camera_azims,
        paint.config.candidate_view_weights, paint.config.max_selected_view_num,
    )
    normal_maps = paint.view_processor.render_normal_multiview(selected_elevs, selected_azims, use_abs_coor=True)
    position_maps = paint.view_processor.render_position_multiview(selected_elevs, selected_azims)
    style_images = []
    for image in images:
        image = image.resize((512, 512))
        if image.mode == "RGBA":
            white = Image.new("RGB", image.size, "white")
            white.paste(image, mask=image.getchannel("A"))
            image = white
        style_images.append(image.convert("RGB"))
    generated = paint.models["multiview_model"](
        style_images, normal_maps + position_maps, prompt="high quality",
        custom_view_size=paint.config.resolution, resize_input=True,
    )
    enhanced = {key: [paint.models["super_model"](img) for img in generated[key]] for key in ("albedo", "mr")}
    for key in enhanced:
        enhanced[key] = [img.resize((paint.config.render_size, paint.config.render_size)) for img in enhanced[key]]
    texture, mask = paint.view_processor.bake_from_multiview(
        enhanced["albedo"], selected_elevs, selected_azims, selected_weights,
    )
    mask_np = (mask.squeeze(-1).cpu().numpy() * 255).astype("uint8")
    texture_mr, mask_mr = paint.view_processor.bake_from_multiview(
        enhanced["mr"], selected_elevs, selected_azims, selected_weights,
    )
    mask_mr_np = (mask_mr.squeeze(-1).cpu().numpy() * 255).astype("uint8")
    paint.render.set_texture(paint.view_processor.texture_inpaint(texture, mask_np), force_set=True)
    paint.render.set_texture_mr(paint.view_processor.texture_inpaint(texture_mr, mask_mr_np))
    paint.render.save_mesh(output_obj, downsample=True)
    return output_obj


class MultiViewWorker:
    def __init__(self, model_path: str, subfolder: str, cache_dir: Path, steps: int, octree_resolution: int):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        if self.device != "cuda":
            raise RuntimeError("Multi-view 3D reconstruction requires a CUDA GPU")
        self.cache_dir = cache_dir
        self.steps = steps
        self.octree_resolution = octree_resolution
        cache_dir.mkdir(parents=True, exist_ok=True)
        self.rembg = BackgroundRemover()
        self.shape = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
            model_path, subfolder=subfolder, variant="fp16", use_safetensors=False,
        )
        self.shape.to(self.device)
        if not getattr(self.shape.image_processor, "return_view_idx", False):
            raise RuntimeError("Configured Hunyuan checkpoint is not a multi-view model")
        self.paint: Hunyuan3DPaintPipeline | None = None

    def _prepare_views(self, encoded: dict[str, str]) -> dict[str, Image.Image]:
        if not {"front", "back", "left"}.issubset(encoded):
            raise ValueError("Front, back and side views are required for multi-view reconstruction")
        views = {}
        for name in ("front", "left", "back", "right"):
            if name not in encoded:
                continue
            raw = base64.b64decode(encoded[name], validate=True)
            image = Image.open(io.BytesIO(raw)).convert("RGBA")
            if image.getchannel("A").getextrema() == (255, 255):
                image = self.rembg(image.convert("RGB"))
            views[name] = image
        return views

    @torch.inference_mode()
    def generate(self, payload: dict[str, Any], job_id: str) -> Path:
        views = self._prepare_views(payload.get("images") or {})
        started = time.time()
        self.shape.to(self.device)
        output = self.shape(
            image=views, num_inference_steps=self.steps, guidance_scale=5.0,
            octree_resolution=self.octree_resolution, num_chunks=20000, output_type="mesh",
        )
        mesh = export_to_trimesh(output)[0]
        shape_path = self.cache_dir / f"{job_id}_shape.glb"
        mesh.export(shape_path)
        if not payload.get("texture", True):
            raise ValueError("Textured output is required; refusing to attach an untextured model")
        self.shape.to("cpu")
        del mesh, output
        import gc
        gc.collect()
        torch.cuda.empty_cache()

        try:
            if self.paint is None:
                config = Hunyuan3DPaintConfig(6, 512)
                config.realesrgan_ckpt_path = "hy3dpaint/ckpt/RealESRGAN_x4plus.pth"
                config.multiview_cfg_path = "hy3dpaint/cfgs/hunyuan-paint-pbr.yaml"
                config.custom_pipeline = "hy3dpaint/hunyuanpaintpbr"
                self.paint = Hunyuan3DPaintPipeline(config)
            paint = self.paint
            output_obj = str(self.cache_dir / f"{job_id}_textured.obj")
            _texture_with_view_references(paint, str(shape_path), [views[key] for key in ("front", "left", "back")], output_obj)
            final_path = self.cache_dir / f"{job_id}.glb"
            create_glb_with_pbr_materials(output_obj, {
                "albedo": output_obj.replace(".obj", ".jpg"),
                "metallic": output_obj.replace(".obj", "_metallic.jpg"),
                "roughness": output_obj.replace(".obj", "_roughness.jpg"),
            }, str(final_path))
            if not final_path.is_file() or final_path.stat().st_size < 20:
                raise RuntimeError("Textured multi-view GLB export failed")
        finally:
            # Texture models consume most of the GPU; release them after each admin job
            # so virtual try-on and the next queued task have room to run.
            import gc
            self.paint = None
            gc.collect()
            torch.cuda.empty_cache()
        log.info("Generated multi-view model %s in %.1fs", final_path.name, time.time() - started)
        return final_path


parser = argparse.ArgumentParser()
parser.add_argument("--host", default="0.0.0.0")
parser.add_argument("--port", type=int, default=8082)
parser.add_argument("--model_path", default="tencent/Hunyuan3D-2mv")
parser.add_argument("--subfolder", default="hunyuan3d-dit-v2-mv")
parser.add_argument("--steps", type=int, default=30)
parser.add_argument("--octree-resolution", type=int, default=380)
parser.add_argument("--cache-path", default=os.path.join(os.environ.get("LOCALAPPDATA", "."), "Temp", "vastrax-hunyuan-cache"))
args = parser.parse_args()
worker = MultiViewWorker(args.model_path, args.subfolder, Path(args.cache_path), args.steps, args.octree_resolution)
app = FastAPI(title="VASTRAX Multi-view Hunyuan3D Service")


def _auth(value: str | None):
    expected = os.environ.get("GENERATOR_3D_SECRET", "")
    if not expected or not value or not secrets.compare_digest(value, expected):
        raise HTTPException(status_code=403, detail="Forbidden")


@app.get("/health")
def health():
    return {"status": "healthy", "worker_id": "vastrax-mv", "capabilities": {"multiview": True, "textured": True}}


@app.post("/generate")
def generate(payload: dict[str, Any], x_generator_key: str | None = Header(None)):
    _auth(x_generator_key)
    job_id = f"vtx_3d_{uuid.uuid4().hex[:8]}"
    try:
        path = worker.generate(payload, job_id)
    except Exception as exc:
        log.exception("Multi-view generation failed")
        raise HTTPException(status_code=500, detail=f"Multi-view reconstruction failed: {exc}") from exc
    return FileResponse(path, media_type="model/gltf-binary", headers={"X-Generation-Mode": "hunyuan_multiview_textured"})


if __name__ == "__main__":
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
