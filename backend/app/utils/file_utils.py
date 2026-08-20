"""File handling utilities for garment uploads and cleanup."""
import ipaddress
import os
import socket
import urllib.parse
import urllib.request
import uuid

from app.core.config import settings
from app.core.exceptions import BadRequestError


def _is_safe_url(url_str: str) -> bool:
    """Validate that the URL is public and does not point to internal/private IP ranges."""
    parsed = urllib.parse.urlparse(url_str)
    if parsed.scheme not in ("http", "https"):
        return False
    
    hostname = parsed.hostname
    if not hostname:
        return False

    try:
        addr_info = socket.getaddrinfo(hostname, None)
        for entry in addr_info:
            ip_str = entry[4][0]
            ip = ipaddress.ip_address(ip_str)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
        return True
    except (socket.gaierror, ValueError):
        return False


def resolve_garment(garment_path: str) -> tuple[str, bool]:
    """Return (local_path, is_tmp) for a garment that may be a URL or a local catalog path.

    Remote URLs are downloaded to a temp file; caller is responsible for cleanup.
    """
    if garment_path.startswith(("http://", "https://")):
        if not _is_safe_url(garment_path):
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
            with urllib.request.urlopen(req, timeout=10) as response, open(tmp, "wb") as out_file:
                out_file.write(response.read(10 * 1024 * 1024))  # 10MB limit
        except Exception as exc:
            raise BadRequestError(f"Could not download garment image: {exc}")
        return tmp, True

    # Check if direct local path exists
    if os.path.exists(garment_path):
        return os.path.abspath(garment_path), False

    # Check in virtual-try-on catalog directory
    catalog_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "virtual-try-on", "frontend", "public", garment_path.lstrip("/")))
    if os.path.exists(catalog_path):
        return catalog_path, False

    # Validate local path in upload directory
    base_dir = os.path.abspath(settings.upload_dir)
    os.makedirs(base_dir, exist_ok=True)
    local = os.path.abspath(os.path.join(base_dir, garment_path.lstrip("/")))
    
    return local, False


def try_remove(path: str | None) -> None:
    """Delete a file, ignoring errors if it does not exist."""
    if path:
        try:
            os.remove(path)
        except OSError:
            pass
