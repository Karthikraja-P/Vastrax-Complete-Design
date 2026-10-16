# Vastrax deployment (home PC, RTX 5070 Ti)

## Layout
| Service | Where | Port |
|---|---|---|
| Frontend (Next.js) | Docker | 127.0.0.1:3000 |
| Backend (FastAPI, single uvicorn worker, SQLite volume) | Docker | 127.0.0.1:8090 |
| 3D gateway `3d-model/server_3d.py` | Docker internal network | 8081 |
| Hunyuan3D-2.1 worker (`--low_vram_mode`) | Windows | 8082 |
| FASHN try-on worker | WSL | 8001 |

Internal calls use `X-Generator-Key` = `GENERATOR_3D_SECRET` (`.env`, git-ignored).
GPU jobs (3D + try-on) go through the backend priority queue (`GET /api/v1/gpu/queue`, admin). It is in-process, so keep ONE uvicorn worker.

## Start / auto-start
- `scripts/start-all.sh` waits for Docker, starts the app and internal 3D gateway, launches Hunyuan on Windows, starts FASHN, and health-checks the stack.
- Windows scheduled tasks: **Vastrax Stack** (at logon) and **Vastrax Backup** (daily 03:30). Remove with `Unregister-ScheduledTask`.
- Containers use `restart: unless-stopped` and healthchecks.

## Backups
`scripts/backup.sh` -> `~/vastrax-backups` (SQLite online backup + uploads + 3D models, 14-day retention).

## Public HTTPS (Cloudflare Tunnel)
1. Create a tunnel in Cloudflare Zero Trust; copy its token.
2. Put `CLOUDFLARE_TUNNEL_TOKEN=...` in `.env`.
3. Add a public hostname -> `http://frontend:3000`.
4. `docker compose --profile tunnel up -d`.

## Schema
`create_all` plus `app/db/ensure_schema.py` (additive columns) run at startup; alembic head is the category-fields migration.

## Ops notes
- Rotate secrets that were hard-coded in older git history (Shiprocket password, old JWT default).
- `HUNYUAN_TEXTURE=false` disables texture painting if VRAM is needed elsewhere.

## Monitoring
`scripts/healthcheck.sh` runs every 5 min (Windows task **Vastrax Health**): probes all five services, restarts Docker containers if the frontend/backend are down, flags disk >= 90%, logs state changes to `~/vastrax-health.log`. Optional `.env` keys: `HEALTHCHECK_PING_URL` (dead-man's-switch such as healthchecks.io; it alerts you when the PC itself goes offline) and `ALERT_WEBHOOK_URL`.
Backups are integrity-checked; set `BACKUP_SYNC_CMD` (e.g. an rclone copy) for an off-machine copy.

## Pre-launch data cleanup
`scripts/cleanup_test_data.py` (dry-run by default; `--apply` backs up first and rotates the admin password into `~/vastrax-admin-credentials.txt`).

## Production env
`APP_ENV=production`, `ALLOWED_ORIGINS=https://vastrax.ai`, real `RAZORPAY_*` keys incl. webhook secret, `NEXT_PUBLIC_SITE_URL`.

### Public-launch gates
- SMS/phone OTP is intentionally deferred for the initial launch. Do not present a phone number as verified unless an SMS provider is configured and its challenge-bound send/verify flow has passed tests. Before enabling it later, add provider credentials, consent copy, rate limits, abuse monitoring, and delivery/failure tests.
- Configure and verify live Razorpay keys and webhook signing secret before accepting real payments. Keep test mode for pre-launch checkout tests.
- Configure Shiprocket credentials before enabling live label/fulfilment actions; until then, verify the manual fulfilment path and avoid implying that a shipment was booked.
- Configure the transactional email provider, test order and account emails, and confirm failure handling.
- Confirm production secrets are unique and rotated, off-machine backups restore successfully, the host has recovery/monitoring procedures, and public checkout/admin flows have passed mobile and desktop end-to-end tests.
- The current local build and automated tests do not update the publicly hosted PC. Deploy only after these external credentials and operational gates are complete.
