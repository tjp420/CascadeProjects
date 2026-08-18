#!/usr/bin/env bash
# install-systemd-units.sh
# Installs systemd units and drop-ins for the agent capabilities server
# Usage: sudo ./tools/install-systemd-units.sh
set -euo pipefail
UNIT_DIR=/etc/systemd/system
SERVICE_FILES=(
  tools/agent-capabilities.service
  tools/agent-capabilities-helper.service
  tools/agent-capabilities-docker.service
)
DROPINS=(
  tools/agent-capabilities.service.d.env.conf
  tools/agent-capabilities-helper.override.conf
)

if [ "$EUID" -ne 0 ]; then
  echo "This script requires root. Run with sudo." >&2
  exit 2
fi

for f in "${SERVICE_FILES[@]}"; do
  if [ -f "$f" ]; then
    echo "Installing $f -> $UNIT_DIR/$(basename $f)"
    cp "$f" "$UNIT_DIR/$(basename $f)"
    chmod 644 "$UNIT_DIR/$(basename $f)"
  else
    echo "Warning: $f not found, skipping"
  fi
done

for d in "${DROPINS[@]}"; do
  if [ -f "$d" ]; then
    svc=$(basename "$d" | sed 's/\.//; s/_//g')
    # determine target service name from file name pattern
    if [[ "$d" == *"agent-capabilities.service.d."* ]]; then
      mkdir -p "$UNIT_DIR/agent-capabilities.service.d"
      cp "$d" "$UNIT_DIR/agent-capabilities.service.d/override.conf"
      chmod 644 "$UNIT_DIR/agent-capabilities.service.d/override.conf"
    elif [[ "$d" == *"agent-capabilities-helper.override.conf"* ]]; then
      mkdir -p "$UNIT_DIR/agent-capabilities-helper.service.d"
      cp "$d" "$UNIT_DIR/agent-capabilities-helper.service.d/override.conf"
      chmod 644 "$UNIT_DIR/agent-capabilities-helper.service.d/override.conf"
    fi
  fi
done

echo "Reloading systemd and enabling services..."
systemctl daemon-reload
systemctl enable --now agent-capabilities-helper.service || true
systemctl enable --now agent-capabilities.service || true
systemctl enable --now agent-capabilities-docker.service || true

echo "Installation complete. Check status with:"
echo "  sudo systemctl status agent-capabilities-helper agent-capabilities agent-capabilities-docker"
