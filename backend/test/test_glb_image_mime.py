import base64
import json
import struct

from app.services.glb import normalize_embedded_image_mime


def make_glb(uri: str) -> bytes:
    document = {"asset": {"version": "2.0"}, "images": [{"uri": uri}]}
    payload = json.dumps(document, separators=(",", ":")).encode()
    payload += b" " * ((-len(payload)) % 4)
    chunk = struct.pack("<II", len(payload), 0x4E4F534A) + payload
    return struct.pack("<4sII", b"glTF", 2, 12 + len(chunk)) + chunk


def read_uri(glb: bytes) -> str:
    chunk_len, chunk_type = struct.unpack_from("<II", glb, 12)
    assert chunk_type == 0x4E4F534A
    return json.loads(glb[20:20 + chunk_len].decode().rstrip(" "))["images"][0]["uri"]


def test_jpeg_texture_mislabeled_png_is_corrected():
    jpeg = b"\xff\xd8\xff\xe0" + b"fixture"
    uri = "data:image/png;base64," + base64.b64encode(jpeg).decode()
    fixed = normalize_embedded_image_mime(make_glb(uri))
    assert read_uri(fixed).startswith("data:image/jpeg;base64,")
    assert struct.unpack_from("<I", fixed, 8)[0] == len(fixed)


def test_correct_png_mime_is_preserved():
    png = b"\x89PNG\r\n\x1a\n" + b"fixture"
    uri = "data:image/png;base64," + base64.b64encode(png).decode()
    original = make_glb(uri)
    assert normalize_embedded_image_mime(original) == original
