#!/usr/bin/env bash
# Probes every service, self-heals Docker containers, logs state changes, optional ping to an uptime monitor.
# Optional env (in .env): HEALTHCHECK_PING_URL (e.g. healthchecks.io), ALERT_WEBHOOK_URL (Slack/Discord/ntfy-style POST).
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$HOME/vastrax-health.log"; STATE="$HOME/.vastrax-health.state"
[ -f "$DIR/.env" ] && set -a && . "$DIR/.env" 2>/dev/null; set +a
WIN_HOST="$(ip route | awk '/default/ {print $3; exit}')"
declare -A URLS=([frontend]=http://localhost:3000/health [backend]=http://localhost:8090/health [hunyuan]=http://$WIN_HOST:8082/health [tryon]=http://localhost:8001/health)
bad=()
for n in "${!URLS[@]}"; do
  [ "$(curl -s -o /dev/null -m 8 -w '%{http_code}' "${URLS[$n]}")" = 200 ] || bad+=("$n")
done
[ "$(docker inspect -f '{{.State.Health.Status}}' vastrax-3d-generator 2>/dev/null)" = healthy ] || bad+=(gateway3d)
case " ${bad[*]} " in *" frontend "*|*" backend "*) (cd "$DIR" && docker compose up -d >/dev/null 2>&1) ;; esac
df_pct=$(df -P "$DIR" | awk 'NR==2 {gsub("%",""); print $5}'); [ "${df_pct:-0}" -ge 90 ] && bad+=("disk-${df_pct}pct")
now="${bad[*]:-ok}"; prev="$(cat "$STATE" 2>/dev/null)"
if [ "$now" != "$prev" ]; then
  echo "$(date -Is) $now" >> "$LOG"; echo "$now" > "$STATE"
  [ -n "${ALERT_WEBHOOK_URL:-}" ] && curl -s -m 10 -X POST -d "Vastrax health: $now" "$ALERT_WEBHOOK_URL" >/dev/null
fi
[ -s "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 2000 ] && tail -n 1000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
[ "$now" = ok ] && [ -n "${HEALTHCHECK_PING_URL:-}" ] && curl -s -m 10 "$HEALTHCHECK_PING_URL" >/dev/null
exit 0
