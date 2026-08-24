"""File handling utilities for garment uploads and cleanup."""
import contextlib
import ipaddress
import os
import socket
import threading
import urllib.parse
import urllib.request
import uuid

from app.core.config import settings
from app.core.exceptions import BadRequestError

_dns_pin_lock = threading.Lock()


def _resolve_safe_ip(hostname: str) -> str | None:
    """Resolve a hostname and return one public, non-internal IP literal, or None if unsafe."""
    try:
        addr_info = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return None

    for entry in addr_info:
        ip_str = entry[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            continue
        return ip_str
    return None


def _is_safe_url(url_str: str) -> bool:
    """Validate that the URL scheme is http(s) and its host resolves to a public address."""
    parsed = urllib.parse.urlparse(url_str)
    if parsed.scheme not in ("http", "https"):
        return False

    hostname = parsed.hostname
    if not hostname:
        return False

    return _resolve_safe_ip(hostname) is not None


@contextlib.contextmanager
def _pinned_dns(hostname: str, ip: str):
    """Force any DNS resolution of `hostname` during this block to return the pre-validated `ip`.

    Prevents DNS-rebinding TOCTOU between the safety check and the actual connection: without
    this, a short-TTL attacker domain could resolve to a public IP at check time and to an
    internal/metadata address at request time.
    """
    original_getaddrinfo = socket.getaddrinfo

    def _pinned_getaddrinfo(host, *args, **kwargs):
        if host == hostname:
            host = ip
        return original_getaddrinfo(host, *args, **kwargs)

    with _dns_pin_lock:
        socket.getaddrinfo = _pinned_getaddrinfo
        try:
            yield
        finally:
            socket.getaddrinfo = original_getaddrinfo


def resolve_garment(garment_path: str) -> tuple[str, bool]:
    """Return (local_path, is_tmp) for a garment that may be a URL, base64 data, or a local catalog path.

    Remote URLs and base64 strings are saved to a temp file; caller is responsible for cleanup.
    """
    if garment_path.startswith("data:image"):
        import base64
        try:
            header, encoded = garment_path.split(",", 1)
            ext = ".png" if "png" in header else ".jpg"
            os.makedirs(settings.upload_dir, exist_ok=True)
            tmp = os.path.join(settings.upload_dir, f"garment_{uuid.uuid4().hex[:8]}{ext}")
            with open(tmp, "wb") as out_file:
                out_file.write(base64.b64decode(encoded))
            return tmp, True
        except Exception as exc:
            raise BadRequestError(f"Could not parse base64 garment image: {exc}")

    if garment_path.startswith(("http://", "https://")):
        parsed = urllib.parse.urlparse(garment_path)
        hostname = parsed.hostname
        pinned_ip = _resolve_safe_ip(hostname) if hostname else None
        if parsed.scheme not in ("http", "https") or not pinned_ip:
            raise BadRequestError("Invalid or restricted garment image URL")

        ext = os.path.splitext(garment_path.split("?")[0])[1] or ".jpg"
        if ext.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            ext = ".jpg"

        os.makedirs(settings.upload_dir, exist_ok=True)
        tmp = os.path.join(settings.upload_dir, f"garment_{uuid.uuid4().hex[:8]}{ext}")
        try:
            req = urllib.request.Request(
                garment_path,
                headers={"User-Agent": "VastraX-VTON/1.0"}
            )
            with _pinned_dns(hostname, pinned_ip):
                with urllib.request.urlopen(req, timeout=10) as response, open(tmp, "wb") as out_file:
                    out_file.write(response.read(10 * 1024 * 1024))  # 10MB limit
        except Exception as exc:
            raise BadRequestError(f"Could not download garment image: {exc}")
        return tmp, True

    # Local catalog / upload-directory path only — reject anything that escapes those roots
    # (no direct-filesystem-path branch: that used to accept any existing absolute path verbatim)
    candidate = garment_path.lstrip("/")

    catalog_root = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "virtual-try-on", "frontend", "public")
    )
    catalog_path = os.path.abspath(os.path.join(catalog_root, candidate))
    if catalog_path == catalog_root or catalog_path.startswith(catalog_root + os.sep):
        if os.path.exists(catalog_path):
            return catalog_path, False

    base_dir = os.path.abspath(settings.upload_dir)
    os.makedirs(base_dir, exist_ok=True)
    local = os.path.abspath(os.path.join(base_dir, candidate))
    if local != base_dir and not local.startswith(base_dir + os.sep):
        raise BadRequestError("Invalid garment path")

    return local, False


def try_remove(path: str | None) -> None:
    """Delete a file, ignoring errors if it does not exist."""
    if path:
        try:
            os.remove(path)
        except OSError:
            pass
