#!/usr/bin/env bash
# Update / roll back stock-app inside the LXC.
#   update.sh            -> pull the tag in .env (default: latest) and restart if changed
#   update.sh 1.4.0      -> pin to version 1.4.0 (also how you roll back)
#   update.sh latest     -> go back to following latest
set -euo pipefail
cd /opt/stock-app

if [[ $# -ge 1 ]]; then
  sed -i "s/^STOCK_APP_TAG=.*/STOCK_APP_TAG=$1/" .env
fi

before=$(docker inspect -f '{{.Image}}' stock-app 2>/dev/null || true)
docker compose pull --quiet stock-app
docker compose up -d --remove-orphans
after=$(docker inspect -f '{{.Image}}' stock-app)

if [[ "$before" != "$after" ]]; then
  echo "$(date -Is) updated stock-app: ${before:0:19} -> ${after:0:19}"
  # wait for the container healthcheck
  for _ in {1..30}; do
    state=$(docker inspect -f '{{.State.Health.Status}}' stock-app)
    [[ "$state" == healthy ]] && { echo "healthy"; break; }
    sleep 2
  done
  [[ "$state" == healthy ]] || { echo "WARNING: stock-app is $state" >&2; exit 1; }
  docker image prune -f >/dev/null
else
  echo "$(date -Is) stock-app already up to date"
fi
