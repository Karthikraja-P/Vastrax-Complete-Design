"""
VastraX Cloudflare Tunnel
Exposes the local GPU backend (port 8088) as a public trycloudflare.com URL.
Run: python tunnel/tunnel.py
"""

import subprocess
import threading
import re
import time
import os
import sys

try:
    import pyperclip
except ImportError:
    pyperclip = None

process      = None
process_lock = threading.Lock()
shutdown_event = threading.Event()

DEFAULT_PORT = 8088


def find_cloudflared():
    tunnel_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(tunnel_dir, "cloudflared.exe"),
        os.path.join(tunnel_dir, "cloudflared"),
        "cloudflared",
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return "cloudflared"


def monitor_tunnel(target_url: str):
    global process

    cmd = find_cloudflared()

    while not shutdown_event.is_set():
        with process_lock:
            process = None

        print(f"\n[VastraX Tunnel] Starting → {target_url}")

        try:
            p = subprocess.Popen(
                [cmd, "tunnel", "--url", target_url],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            with process_lock:
                process = p

        except FileNotFoundError:
            print("\n" + "=" * 60)
            print("  ERROR: cloudflared binary not found.")
            print("=" * 60)
            print("\nDownload it and place it inside the tunnel/ folder:")
            print("  Windows : https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe")
            print("            Rename to cloudflared.exe")
            print("  Linux   : https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64")
            print("            chmod +x cloudflared && mv cloudflared tunnel/cloudflared")
            print("  macOS   : brew install cloudflared\n")
            shutdown_event.set()
            break
        except Exception as e:
            print(f"[ERROR] {e}")
            shutdown_event.set()
            break

        url_found = False

        try:
            for line in iter(p.stdout.readline, ""):
                if shutdown_event.is_set():
                    break

                cleaned = line.strip()
                if cleaned:
                    print(f"  [cloudflared] {cleaned}")

                if not url_found:
                    match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
                    if match:
                        url = match.group(0)
                        url_found = True

                        print("\n" + "=" * 60)
                        print("  VastraX GPU Tunnel is LIVE")
                        print(f"  Public URL : {url}")
                        print("=" * 60)
                        print("\n  → Paste this URL into the GPU Gateway Settings")
                        print("    in the VastraX webapp (Try-On page).\n")

                        if pyperclip:
                            try:
                                pyperclip.copy(url)
                                print("  [INFO] URL copied to clipboard.\n")
                            except Exception:
                                pass

        except Exception as read_err:
            if not shutdown_event.is_set():
                print(f"[DEBUG] Read error: {read_err}")

        exit_code = p.wait()

        if shutdown_event.is_set():
            break

        print(f"\n[WARNING] Tunnel terminated (exit {exit_code}). Restarting in 5s...")
        if shutdown_event.wait(5):
            break


def main():
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        arg = sys.argv[1].strip()
        port = int(arg) if arg.isdigit() else DEFAULT_PORT

    target_url = f"http://localhost:{port}"

    print("=" * 60)
    print("  VastraX — GPU Backend Tunnel")
    print(f"  Tunnelling {target_url} via Cloudflare")
    print("=" * 60)

    thread = threading.Thread(target=monitor_tunnel, args=(target_url,), daemon=True)
    thread.start()

    try:
        while not shutdown_event.is_set() and thread.is_alive():
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n[INFO] Shutting down tunnel...")
    finally:
        shutdown_event.set()
        with process_lock:
            if process and process.poll() is None:
                try:
                    process.terminate()
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
        print("[INFO] Tunnel closed.")


if __name__ == "__main__":
    main()
