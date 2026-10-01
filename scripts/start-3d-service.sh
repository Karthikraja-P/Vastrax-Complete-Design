#!/usr/bin/env bash
# VASTRAX 3D Model Generator Service Startup Script
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT_3D:-8081}"
GENERATOR_3D_SECRET="$(sed -n 's/^GENERATOR_3D_SECRET=//p' "$DIR/.env" | head -n 1 | tr -d '\r')"
export GENERATOR_3D_SECRET
if [[ -z "$GENERATOR_3D_SECRET" ]]; then
    echo "GENERATOR_3D_SECRET is missing from .env" >&2
    exit 1
fi

echo "Starting VASTRAX 3D Generator on port $PORT..."

# Stop the process bound to this service port, if one is running.
fuser -k -n tcp "$PORT" >/dev/null 2>&1 || true
sleep 1

# Launch 3D server in background
nohup "$DIR/backend/.venv/bin/python" "$DIR/3d-model/server_3d.py" > "$DIR/3d-model/server_3d.log" 2>&1 &
SERVER_PID=$!

for _ in {1..20}; do
    if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
        echo "VASTRAX 3D Generator ready (PID: $SERVER_PID). Log: $DIR/3d-model/server_3d.log"
        exit 0
    fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        cat "$DIR/3d-model/server_3d.log" >&2
        exit 1
    fi
    sleep 0.5
done

echo "VASTRAX 3D Generator did not become healthy. Log: $DIR/3d-model/server_3d.log" >&2
exit 1
