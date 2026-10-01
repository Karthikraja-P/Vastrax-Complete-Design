# Vastrax deployment (home PC, RTX 5070 Ti)

## Layout
| Service | Where | Port |
|---|---|---|
| Frontend (Next.js) | Docker | 127.0.0.1:3000 |
| Backend (FastAPI, single uvicorn worker, SQLite volume) | Docker | 127.0.0.1:8090 |
| 3D gateway `3d-model/server_3d.py` | WSL | 8081 |
| Hunyuan3D-2.1 worker (`--low_vram_mode`) | Windows | 8082 |
| FASHN try-on worker | WSL | 8001 |

Internal calls use `X-Generator-Key` = `GENERATOR_3D_SECRET` (`.env`, git-ignored).
GPU jobs (3D + try-on) go through the backend priority queue (`GET /api/v1/gpu/queue`, admin). It is in-process, so keep ONE uvicorn worker.

## Start / auto-start
- `scripts/start-all.sh` waits for Docker, runs `docker compose up -d`, then starts Hunyuan, the 3D gateway and FASHN and health-checks them.
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
