"""
VastraX — Virtual Try-On Stack Launcher
Starts the FastAPI GPU backend + Cloudflare tunnel in one command.

Usage:
    python start-tryon.py              # default port 8088
    python start-tryon.py --port 9000  # custom port
"""

import subprocess
import threading
import sys
import os
import time
import re
import signal

# ── Config ────────────────────────────────────────────────────────────────────
DEFAULT_PORT = 8088

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
TUNNEL_DIR  = os.path.join(BASE_DIR, "tunnel")

# Use the backend's own venv if it exists, else fall back to current Python
_venv_python = os.path.join(BACKEND_DIR, "venv", "bin", "python")
BACKEND_PYTHON = _venv_python if os.path.isfile(_venv_python) else sys.executable

# ── Parse args ───────────────────────────────────────────────────────────────
port = DEFAULT_PORT
for i, arg in enumerate(sys.argv[1:]):
    if arg == "--port" and i + 1 < len(sys.argv[1:]):
        try:
            port = int(sys.argv[i + 2])
        except (ValueError, IndexError):
            pass

# ── Process handles ──────────────────────────────────────────────────────────
backend_proc = None
tunnel_proc  = None
shutdown      = threading.Event()


def find_cloudflared():
    candidates = [
        os.path.join(TUNNEL_DIR, "cloudflared.exe"),
        os.path.join(TUNNEL_DIR, "cloudflared"),
        "cloudflared",
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return "cloudflared"


def start_backend():
    global backend_proc
    env = os.environ.copy()
    env["PORT"] = str(port)

    print(f"[Backend] Starting FastAPI on port {port} ...")

    backend_proc = subprocess.Popen(
        [
            BACKEND_PYTHON, "-m", "uvicorn",
            "app.main:app",
            "--host", "0.0.0.0",
            "--port", str(port),
            "--reload"
        ],
        cwd=BACKEND_DIR,
        env=env
    )

    backend_proc.wait()

    if not shutdown.is_set():
        print("[Backend] Process exited unexpectedly.")
        shutdown.set()


def start_tunnel():
    global tunnel_proc

    # Give the backend a moment to bind its port
    time.sleep(3)

    if shutdown.is_set():
        return

    target_url = f"http://localhost:{port}"
    cmd = find_cloudflared()

    print(f"[Tunnel ] Starting Cloudflare tunnel → {target_url} ...")

    try:
        tunnel_proc = subprocess.Popen(
            [cmd, "tunnel", "--url", target_url],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            cwd=TUNNEL_DIR
        )
    except FileNotFoundError:
        print("\n" + "=" * 60)
        print("  ERROR: cloudflared binary not found in tunnel/ folder.")
        print("=" * 60)
        print("\n  Download cloudflared and place it inside the tunnel/ folder:")
        print("  Windows → https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe")
        print("            Rename to: tunnel/cloudflared.exe")
        print("  Linux   → https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64")
        print("            Run: chmod +x cloudflared && mv cloudflared tunnel/cloudflared")
        print("  macOS   → brew install cloudflared\n")
        shutdown.set()
        return

    url_found = False

    for line in iter(tunnel_proc.stdout.readline, ""):
        if shutdown.is_set():
            break

        cleaned = line.strip()
        if cleaned:
            print(f"  [cloudflared] {cleaned}")

        if not url_found:
            match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
            if match:
                tunnel_url = match.group(0)
                url_found  = True

                print("\n" + "=" * 60)
                print("  VastraX GPU Tunnel is LIVE")
                print(f"  Public URL : {tunnel_url}")
                print("=" * 60)
                print("\n  ➜  Paste this URL into the GPU Gateway Settings")
                print("     on the Virtual Try-On page of the webapp.\n")

    tunnel_proc.wait()

    if not shutdown.is_set():
        print("[Tunnel ] Process exited unexpectedly.")
        shutdown.set()


def cleanup(signum=None, frame=None):
    print("\n[VastraX] Shutting down...")
    shutdown.set()

    if tunnel_proc and tunnel_proc.poll() is None:
        tunnel_proc.terminate()
        try:
            tunnel_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            tunnel_proc.kill()

    if backend_proc and backend_proc.poll() is None:
        backend_proc.terminate()
        try:
            backend_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            backend_proc.kill()

    print("[VastraX] Stopped.")
    sys.exit(0)


# ── Register signals ─────────────────────────────────────────────────────────
signal.signal(signal.SIGINT,  cleanup)
signal.signal(signal.SIGTERM, cleanup)


# ── Entry point ──────────────────────────────────────────────────────────────
def build_frontend():
    """Build the React frontend so FastAPI can serve it."""
    print("[Frontend] Building React app (npm run build)...")
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=BASE_DIR,
        capture_output=False,
    )
    if result.returncode != 0:
        print("[Frontend] Build failed — backend will still start but frontend may be stale.")
    else:
        print("[Frontend] Build complete.\n")


if __name__ == "__main__":
    print("=" * 60)
    print("  VastraX — Virtual Try-On Stack")
    print(f"  Backend port : {port}")
    print("=" * 60 + "\n")

    # Verify backend directory exists
    if not os.path.isdir(BACKEND_DIR):
        print(f"ERROR: backend/ directory not found at {BACKEND_DIR}")
        sys.exit(1)

    # Build frontend so FastAPI can serve it at the same URL
    build_frontend()

    # Run backend and tunnel concurrently
    backend_thread = threading.Thread(target=start_backend, daemon=True)
    tunnel_thread  = threading.Thread(target=start_tunnel,  daemon=True)

    backend_thread.start()
    tunnel_thread.start()

    try:
        while not shutdown.is_set():
            time.sleep(0.5)
    except KeyboardInterrupt:
        cleanup()
