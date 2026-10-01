#!/usr/bin/env bash
# Start the whole Vastrax stack on the home PC (idempotent). Run from WSL.
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "[1/4] App containers (frontend, backend)"
docker compose up -d

echo "[2/4] Hunyuan3D worker (Windows GPU)"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w "$DIR/scripts/start-hunyuan-service.ps1")" | tr -d '\r'

echo "[3/4] 3D gateway"
"$DIR/scripts/start-3d-service.sh"

echo "[4/4] FASHN try-on worker"
"$DIR/scripts/start-tryon-service.sh"

WIN_HOST="$(ip route | awk '/default/{print $3}')"
echo "== health"
for url in "http://localhost:3000/health" "http://localhost:8090/health" "http://localhost:8081/health" "http://$WIN_HOST:8082/health" "http://localhost:8001/health"; do
    printf '%-40s %s\n' "$url" "$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$url")"
done
