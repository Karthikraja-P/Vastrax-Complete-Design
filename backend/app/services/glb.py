"""Small GLB helpers for safe, browser-compatible model delivery."""

import base64
import json
import struct

_GLTF_MAGIC = b"glTF"
_GLTF_JSON_CHUNK = 0x4E4F534A


def normalize_embedded_image_mime(glb: bytes) -> bytes:
    """Correct data-URI MIME labels when the embedded image bytes disagree.

    Hunyuan may label JPEG texture bytes as image/png. Browsers then ignore the
    base-color map and render the garment as a plain white mesh.
    """
    if len(glb) < 20 or glb[:4] != _GLTF_MAGIC:
        raise ValueError("Not a valid GLB file")

    magic, version, declared_length = struct.unpack_from("<4sII", glb, 0)
    if version != 2 or declared_length != len(glb):
        raise ValueError("Unsupported or malformed GLB header")

    chunks: list[tuple[int, bytes]] = []
    offset = 12
    while offset < len(glb):
        if offset + 8 > len(glb):
            raise ValueError("Truncated GLB chunk header")
        chunk_length, chunk_type = struct.unpack_from("<II", glb, offset)
        offset += 8
        end = offset + chunk_length
        if end > len(glb):
            raise ValueError("Truncated GLB chunk")
        chunks.append((chunk_type, glb[offset:end]))
        offset = end

    json_index = next((i for i, (kind, _) in enumerate(chunks) if kind == _GLTF_JSON_CHUNK), None)
    if json_index is None:
        raise ValueError("GLB has no JSON chunk")

    try:
        document = json.loads(chunks[json_index][1].rstrip(b" \x00").decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("GLB JSON chunk is malformed") from exc

    changed = False
    for image in document.get("images", []):
        uri = image.get("uri")
        if not isinstance(uri, str) or not uri.startswith("data:") or ";base64," not in uri:
            continue
        header, encoded = uri.split(",", 1)
        try:
            image_bytes = base64.b64decode(encoded, validate=True)
        except (ValueError, base64.binascii.Error):
            continue

        if image_bytes.startswith(b"\xff\xd8\xff"):
            actual_mime = "image/jpeg"
        elif image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            actual_mime = "image/png"
        elif image_bytes.startswith((b"GIF87a", b"GIF89a")):
            actual_mime = "image/gif"
        elif len(image_bytes) >= 12 and image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
            actual_mime = "image/webp"
        else:
            continue

        declared_mime = header[5:].split(";", 1)[0].lower()
        if declared_mime != actual_mime:
            image["uri"] = f"data:{actual_mime};base64,{encoded}"
            changed = True

    if not changed:
        return glb

    json_bytes = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    json_bytes += b" " * ((-len(json_bytes)) % 4)
    chunks[json_index] = (_GLTF_JSON_CHUNK, json_bytes)

    body = bytearray()
    for chunk_type, chunk_data in chunks:
        body.extend(struct.pack("<II", len(chunk_data), chunk_type))
        body.extend(chunk_data)
    total_length = 12 + len(body)
    return struct.pack("<4sII", _GLTF_MAGIC, version, total_length) + body
