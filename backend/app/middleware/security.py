"""Per-IP rate limits and baseline security headers."""
import re

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.rate_limit import client_ip, hit

# (method, path regex, limit, window seconds)
RULES = [
    ("POST", r"^/api/v1/otp/send$", 5, 600),
    ("POST", r"^/api/v1/otp/verify$", 15, 600),
    ("POST", r"^/api/v1/auth/(login|register|verify-2fa|verify-registration|forgot-password|reset-password)$", 10, 600),
    ("POST", r"^/(api/)?(v1/)?(tryon|try-on)", 20, 3600),
    ("POST", r"^/api/v1/(3d|products/[^/]+/(reconstruct|model))", 10, 3600),
    ("POST", r"^/api/(v1/)?chat", 30, 60),
    ("*", r"^/api/v1/shipping/", 30, 60),
    ("*", r"^/api/v1/payments/(initiate|verify)$", 20, 60),
]
SKIP = ("/api/v1/payments/webhook", "/health", "/api/v1/health")
DEFAULT = (300, 60)

_compiled = [(m, re.compile(p), n, w) for m, p, n, w in RULES]


def setup_security(app: FastAPI) -> None:
    @app.middleware("http")
    async def guard(request: Request, call_next):
        path = request.url.path
        if request.method != "OPTIONS" and path not in SKIP:
            ip = client_ip(request)
            for i, (m, rx, n, w) in enumerate(_compiled):
                if m in ("*", request.method) and rx.search(path):
                    if retry := hit(f"{i}:{ip}", n, w):
                        return JSONResponse({"detail": "Too many requests. Please try again later."}, 429, headers={"Retry-After": str(retry)})
            if retry := hit(f"all:{ip}", *DEFAULT):
                return JSONResponse({"detail": "Too many requests. Please try again later."}, 429, headers={"Retry-After": str(retry)})
        resp = await call_next(request)
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        resp.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        if request.headers.get("x-forwarded-proto") == "https":
            resp.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return resp
