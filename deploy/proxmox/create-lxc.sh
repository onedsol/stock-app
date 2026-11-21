#!/usr/bin/env bash
# Run ON A PROXMOX NODE as root. Creates an unprivileged Debian 12 LXC running
# stock-app with Docker, plus a systemd timer that pulls new images.
#
#   ./create-lxc.sh                      # defaults below
#   CTID=210 IMAGE=ghcr.io/me/stock-app SEC_USER_AGENT="StockDashboard/1.0 you@example.com" ./create-lxc.sh
#
# Expects compose.yml and update.sh next to it (copy the deploy/ folder +
# compose.yml to the node, e.g. scp -r deploy compose.yml root@pve1:/root/stock-app/).
set -euo pipefail

CTID=${CTID:-210}
HOSTNAME=${HOSTNAME_CT:-stock-app}
STORAGE=${STORAGE:-local-lvm}          # rootfs storage
TPL_STORAGE=${TPL_STORAGE:-local}      # where templates live
BRIDGE=${BRIDGE:-vmbr0}
IP=${IP:-dhcp}                         # or e.g. 10.0.0.40/24
GW=${GW:-}                             # required if IP is static
CORES=${CORES:-2}
MEMORY=${MEMORY:-1024}
DISK=${DISK:-8}
IMAGE=${IMAGE:-ghcr.io/OWNER/stock-app}
TAG=${TAG:-latest}
AUTO_UPDATE=${AUTO_UPDATE:-1}          # 1 = timer pulls every 15 min
SEC_USER_AGENT=${SEC_USER_AGENT:?set SEC_USER_AGENT, e.g. "StockDashboard/1.0 you@example.com"}
HERE=$(cd "$(dirname "$0")" && pwd)
COMPOSE=${COMPOSE:-$HERE/../../compose.yml}
UPDATE=${UPDATE:-$HERE/../update.sh}

[[ -f $COMPOSE && -f $UPDATE ]] || { echo "compose.yml / update.sh not found" >&2; exit 1; }
pct status "$CTID" &>/dev/null && { echo "CT $CTID already exists" >&2; exit 1; }

# --- 1. Template ---------------------------------------------------------
pveam update >/dev/null
TPL=$(pveam available --section system | awk '/debian-12-standard/ {print $2}' | sort -V | tail -1)
pveam list "$TPL_STORAGE" | grep -q "$TPL" || pveam download "$TPL_STORAGE" "$TPL"

# --- 2. Container (unprivileged + nesting/keyctl for Docker) -------------
NET="name=eth0,bridge=$BRIDGE,ip=$IP"
[[ -n $GW ]] && NET+=",gw=$GW"
pct create "$CTID" "$TPL_STORAGE:vztmpl/$TPL" \
  --hostname "$HOSTNAME" \
  --cores "$CORES" --memory "$MEMORY" --swap 512 \
  --rootfs "$STORAGE:$DISK" \
  --net0 "$NET" \
  --unprivileged 1 \
  --features nesting=1,keyctl=1 \
  --onboot 1 \
  --tags "docker;apps" \
  --description "stock-app — managed by create-lxc.sh, update with /opt/stock-app/update.sh"
pct start "$CTID"
for _ in {1..30}; do pct exec "$CTID" -- getent hosts deb.debian.org &>/dev/null && break; sleep 2; done

# --- 3. Docker (official apt repo) ---------------------------------------
pct exec "$CTID" -- bash -euo pipefail -c '
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  mkdir -p /opt/stock-app
'

# --- 4. App files --------------------------------------------------------
pct push "$CTID" "$COMPOSE" /opt/stock-app/compose.yml
pct push "$CTID" "$UPDATE"  /opt/stock-app/update.sh --perms 0755
printf 'STOCK_APP_IMAGE=%s\nSTOCK_APP_TAG=%s\nSEC_USER_AGENT="%s"\n' "$IMAGE" "$TAG" "$SEC_USER_AGENT" > /tmp/stock-app.env
pct push "$CTID" /tmp/stock-app.env /opt/stock-app/.env --perms 0600
rm -f /tmp/stock-app.env

# --- 5. Auto-update timer (optional) -------------------------------------
if [[ $AUTO_UPDATE == 1 ]]; then
  pct exec "$CTID" -- bash -euo pipefail -c '
    cat > /etc/systemd/system/stock-app-update.service <<UNIT
[Unit]
Description=Pull and redeploy stock-app
After=docker.service network-online.target
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=/opt/stock-app/update.sh
UNIT
    cat > /etc/systemd/system/stock-app-update.timer <<UNIT
[Unit]
Description=Check for new stock-app image every 15 min
[Timer]
OnBootSec=2min
OnUnitActiveSec=15min
[Install]
WantedBy=timers.target
UNIT
    systemctl daemon-reload
    systemctl enable --now stock-app-update.timer
  '
fi

# --- 6. First deploy -----------------------------------------------------
pct exec "$CTID" -- /opt/stock-app/update.sh
echo
echo "stock-app is running in CT $CTID:"
pct exec "$CTID" -- hostname -I
