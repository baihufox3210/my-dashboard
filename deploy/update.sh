#!/usr/bin/env bash
# One-command update for the production server.
#
#   npm run deploy               pull, install, build, restart the API, refresh nginx
#   npm run deploy -- --restart  only restart the API and refresh nginx (no pull or build)
#
# Run it from anywhere inside the project directory, as the user that owns it. It asks for
# sudo only to restart the systemd service. Overrides (environment variables):
#   SERVICE=baihu-blog-api   systemd unit that runs the API
#   CONTAINER=my-dashboard   nginx container that serves dist/ and proxies the API
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

SERVICE="${SERVICE:-baihu-blog-api}"
CONTAINER="${CONTAINER:-my-dashboard}"
restart_only=false
[ "${1:-}" = "--restart" ] && restart_only=true

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
warn() { printf '\033[33m⚠ %s\033[0m\n' "$1"; }
sudo_if_needed() { if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo "$@"; fi; }
env_value() { { grep -E "^$1=" .env 2>/dev/null || true; } | tail -1 | cut -d= -f2- | tr -d "\"'"; }

api_host="$(env_value API_HOST)"
api_port="$(env_value PORT)"
api="http://${api_host:-127.0.0.1}:${api_port:-3001}"

if ! $restart_only; then
  step "Pulling the latest code"
  git pull --ff-only

  step "Installing dependencies"
  npm install --no-audit --no-fund

  step "Building the site"
  npm run build
fi

step "Restarting the API ($SERVICE)"
sudo_if_needed systemctl restart "$SERVICE"
for attempt in $(seq 1 30); do
  if curl -fsS -o /dev/null "$api/api/server-status"; then break; fi
  if [ "$attempt" -eq 30 ]; then
    echo "The API did not come back within 30 seconds. See: journalctl -u $SERVICE -n 30 --no-pager" >&2
    exit 1
  fi
  sleep 1
done
echo "API is up at $api"

step "Updating nginx in $CONTAINER"
if docker inspect "$CONTAINER" >/dev/null 2>&1; then
  docker cp deploy/nginx-default.conf "$CONTAINER:/etc/nginx/conf.d/default.conf"
  docker exec "$CONTAINER" nginx -t
  docker exec "$CONTAINER" nginx -s reload
else
  warn "Container '$CONTAINER' not found, skipping nginx (set CONTAINER=<name>)."
fi

step "Checking link previews"
article_id="$(curl -fsS "$api/api/articles" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
if [ -n "$article_id" ]; then
  short="$(printf '%s' "$article_id" | tr -d '-' | cut -c1-8)xyz"
  site="$(env_value SITE_URL)"
  for url in "$api/b/$short" ${site:+"$site/b/$short"}; do
    if curl -fsS "$url" | grep -q 'og:title'; then echo "ok    $url"; else warn "no preview tags at $url"; fi
  done
else
  echo "No articles yet, skipping."
fi

step "Checking sitemap and robots.txt"
site="$(env_value SITE_URL)"
for base in "$api" ${site:+"$site"}; do
  if curl -fsS "$base/sitemap.xml" | grep -q '<urlset'; then echo "ok    $base/sitemap.xml"; else warn "no sitemap at $base/sitemap.xml"; fi
done
if [ -n "$site" ]; then
  if curl -fsS "$site/robots.txt" | grep -qi '^Sitemap:'; then echo "ok    $site/robots.txt lists the sitemap"; else warn "robots.txt has no Sitemap line (SITE_URL must be set when running npm run build)"; fi
fi

printf '\n\033[32mDone.\033[0m\n'
