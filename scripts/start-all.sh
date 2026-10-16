#!/usr/bin/env bash
# Start the whole Vastrax stack on the home PC (idempotent). Run from WSL.
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "[0/4] Waiting for Docker"
for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 5; done
printf "%-40s %s\n" "Docker 3D gateway" "$(docker inspect -f '{{.State.Health.Status}}' vastrax-3d-generator 2>/dev/null || echo unavailable)"
docker info >/dev/null 2>&1 || { echo "Docker is not available" >&2; exit 1; }

echo "[1/4] App containers (frontend, backend)"
docker compose up -d

echo "[2/4] Hunyuan3D worker (Windows GPU)"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w "$DIR/scripts/start-hunyuan-service.ps1")" | tr -d '\r'

echo "[3/4] 3D gateway (Docker service)"
docker compose up -d generator3d backend frontend

echo "[4/4] FASHN try-on worker"
"$DIR/scripts/start-tryon-service.sh"

WIN_HOST="$(ip route | awk '/default/{print $3}')"
echo "== health"
for url in "http://localhost:3000/health" "http://localhost:8090/health" "http://$WIN_HOST:8082/health" "http://localhost:8001/health"; do
    printf '%-40s %s\n' "$url" "$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$url")"
done
