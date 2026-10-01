#!/usr/bin/env bash
# VASTRAX FASHN VTON 1.5 GPU Service Startup Script
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FASHN_DIR="/home/pkr/fashn-tryon"
GENERATOR_3D_SECRET="$(sed -n 's/^GENERATOR_3D_SECRET=//p' "$DIR/.env" | head -n 1 | tr -d '\r')"
export GENERATOR_3D_SECRET
if [[ -z "$GENERATOR_3D_SECRET" ]]; then
    echo "GENERATOR_3D_SECRET is missing from .env" >&2
    exit 1
fi

echo "Starting VASTRAX FASHN VTON 1.5 GPU Server on port 8001..."

# Stop existing instance if running
fuser -k -n tcp 8001 >/dev/null 2>&1 || true
sleep 1

# Launch FASHN GPU server in background
nohup "$FASHN_DIR/venv/bin/python" "$FASHN_DIR/server.py" > "$FASHN_DIR/server.log" 2>&1 &

echo "FASHN GPU Server started in background (PID: $!)."
echo "Log: $FASHN_DIR/server.log"
echo "Waiting for weights initialization..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8001/health | grep -q "ok"; then
        echo "✓ FASHN VTON 1.5 is online and ready on port 8001!"
        exit 0
    fi
    sleep 2
done

echo "Server process launched. Check $FASHN_DIR/server.log for startup progress."
