#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "          VASTRAX Cyber-Luxury Boutique Platform          "
echo "              Local PC Instant Docker Deployment          "
echo "=========================================================="

if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed or not in PATH."
    echo "Please install Docker Desktop or Docker Engine first."
    exit 1
fi

echo "[INFO] Ensuring persistent directories exist..."
mkdir -p backend/user_uploads backend/results

echo "[INFO] Starting containers in background..."
docker compose up --build -d

echo ""
echo "=========================================================="
echo "✓ VASTRAX is successfully running in Docker!"
echo ""
echo "  • Storefront:  http://localhost:3000/storefront/home"
echo "  • Admin Panel: http://localhost:3000/"
echo "  • Backend API: http://localhost:8090/health"
echo ""
echo "To view logs:   docker compose logs -f"
echo "To stop:        docker compose down"
echo "=========================================================="
