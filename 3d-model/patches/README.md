# Local patches for Hunyuan3D-2.1

`3d-model/Hunyuan3D-2.1` is a separate checkout. `hunyuan3d-local.patch` holds our changes to it:
raw-base64 input, background removal before reconstruction, shared-key auth, optional texture paint and
the VRAM fix (shape model moved to CPU while painting, paint pipeline released afterwards) that lets
texture painting fit on a 16 GB GPU.

Apply on a fresh checkout: `git -C 3d-model/Hunyuan3D-2.1 apply --ignore-whitespace ../patches/hunyuan3d-local.patch`
